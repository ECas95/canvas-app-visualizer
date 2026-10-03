import type {
  CanvasAppModel,
  CanvasControl,
  Finding,
  FormulaRef
} from "../../types/canvas";
import { collectFormulaRefs } from "../model/formulas";
import {
  analyzePowerFx,
  countFunction,
  hasFunction,
  hasIdentifier
} from "../powerfx/facts";

function finding(
  ref: FormulaRef,
  ruleId: string,
  severity: Finding["severity"],
  category: Finding["category"],
  title: string,
  message: string,
  suggestion: string | undefined,
  confidence: Finding["confidence"]
): Finding {
  return {
    id: ruleId + ":" + ref.controlPath + ":" + ref.property,
    ruleId,
    severity,
    category,
    title,
    message,
    suggestion,
    confidence,
    sourceFile: ref.sourceFile,
    controlPath: ref.controlPath,
    property: ref.property,
    formula: ref.formula
  };
}

export function checkBalancedDelimiters(formula: string): string | null {
  return analyzePowerFx(formula).delimiterError ?? null;
}

function analyzeFormula(ref: FormulaRef): Finding[] {
  const formula = ref.formula;
  const facts = analyzePowerFx(formula);
  const findings: Finding[] = [];

  if (facts.delimiterError) {
    findings.push(
      finding(
        ref,
        "powerfx.syntax.lexical-structure",
        "error",
        "syntax",
        "Potential Power Fx lexical or delimiter error",
        facts.delimiterError,
        "Validate the expression with the Microsoft Power Fx parser/binder or Power Apps Studio before deployment.",
        "high"
      )
    );
  }

  const lookupCount = countFunction(facts, "LookUp");
  if (lookupCount >= 3) {
    findings.push(
      finding(
        ref,
        "powerfx.performance.repeated-lookup",
        "warning",
        "performance",
        "Repeated LookUp calls",
        "This formula contains " +
          lookupCount +
          " LookUp calls outside comments and text literals. Repeated remote lookups can multiply round trips.",
        "Reuse an already retrieved record, pre-shape a small lookup dataset, or centralize reusable logic when doing so preserves behavior.",
        "medium"
      )
    );
  }

  if (hasFunction(facts, "ForAll") && hasFunction(facts, "Patch")) {
    findings.push(
      finding(
        ref,
        "powerfx.performance.forall-patch",
        "warning",
        "performance",
        "ForAll + Patch requires review",
        "The formula combines ForAll and Patch. Depending on the source and formula shape, this can result in row-oriented server work.",
        "Compare this implementation with supported table-oriented write patterns and validate correctness, errors, and connector behavior before changing it.",
        "medium"
      )
    );
  }

  if (hasFunction(facts, "ClearCollect")) {
    findings.push(
      finding(
        ref,
        "powerfx.delegation.clearcollect",
        "warning",
        "delegation",
        "ClearCollect can materialize data locally",
        "If the collected source is remote, only the rows actually retrieved by the client become available to later local formulas.",
        "Confirm delegation on the source query and test beyond the configured nondelegable row limit.",
        "high"
      )
    );
  }

  if (
    hasFunction(facts, "Search") ||
    hasFunction(facts, "Distinct") ||
    hasIdentifier(facts, "in") ||
    hasIdentifier(facts, "exactin")
  ) {
    findings.push(
      finding(
        ref,
        "powerfx.delegation.connector-dependent",
        "info",
        "delegation",
        "Connector-dependent delegation",
        "This expression contains operations whose delegation behavior can depend on the connector, column type, and exact expression shape.",
        "Confirm the expression against the selected connector profile, current Microsoft delegation documentation, and runtime/Studio warnings.",
        "medium"
      )
    );
  }

  const hasWrite =
    hasFunction(facts, "Patch") ||
    hasFunction(facts, "Remove") ||
    hasFunction(facts, "RemoveIf") ||
    hasFunction(facts, "Update") ||
    hasFunction(facts, "UpdateIf") ||
    hasFunction(facts, "SubmitForm");

  if (hasWrite && !hasFunction(facts, "IfError")) {
    findings.push(
      finding(
        ref,
        "powerfx.reliability.write-error-handling",
        "info",
        "maintainability",
        "Write operation has no local IfError wrapper",
        "A data-changing operation is present without an IfError call in the same formula.",
        "Review the app's complete error-handling strategy. Errors might be handled elsewhere, so this is a review hint rather than a defect.",
        "low"
      )
    );
  }

  if (formula.length > 1200) {
    findings.push(
      finding(
        ref,
        "powerfx.maintainability.long-formula",
        "info",
        "maintainability",
        "Large formula",
        "This formula is over 1,200 characters, which can make review and repeated logic harder to maintain.",
        "Consider With, named formulas, user-defined functions, components, or server-side logic where those choices preserve behavior and improve clarity.",
        "medium"
      )
    );
  }

  if (facts.functions.length >= 24 || facts.maxNesting >= 10) {
    findings.push(
      finding(
        ref,
        "powerfx.maintainability.structural-complexity",
        "info",
        "maintainability",
        "Structurally complex formula",
        "Static analysis found " +
          facts.functions.length +
          " function-call expressions with maximum delimiter nesting of " +
          facts.maxNesting +
          ".",
        "Review the formula for repeated subexpressions and separable concerns. Complexity alone is not a performance defect.",
        "medium"
      )
    );
  }

  if (
    ref.ownerType === "app" &&
    ref.property === "OnStart" &&
    hasFunction(facts, "Navigate")
  ) {
    findings.push(
      finding(
        ref,
        "canvas.startup.navigate-onstart",
        "warning",
        "performance",
        "Navigation is coupled to App.OnStart",
        "App.OnStart contains Navigate. Current Canvas source guidance uses App.StartScreen for initial screen selection.",
        "Use App.StartScreen for initial navigation and keep unrelated initialization work separate.",
        "high"
      )
    );
  }

  if (ref.ownerType === "app" && ref.property === "OnStart") {
    const dataOperationCount = [
      "ClearCollect",
      "Collect",
      "Patch",
      "LookUp",
      "Filter",
      "Refresh"
    ].reduce((sum, name) => sum + countFunction(facts, name), 0);

    if (dataOperationCount >= 4) {
      findings.push(
        finding(
          ref,
          "canvas.startup.heavy-onstart",
          "warning",
          "performance",
          "Potentially heavy App.OnStart",
          "App.OnStart contains " +
            dataOperationCount +
            " data-oriented call expressions.",
          "Measure initial-screen readiness and move secondary work to lazy/on-demand loading where functional behavior allows.",
          "medium"
        )
      );
    }
  }

  return findings;
}

function walkControls(
  controls: CanvasControl[],
  visitor: (control: CanvasControl) => void
): void {
  for (const control of controls) {
    visitor(control);
    walkControls(control.children, visitor);
  }
}

function analyzeAccessibility(app: CanvasAppModel): Finding[] {
  const findings: Finding[] = [];

  for (const screen of app.screens) {
    walkControls(screen.children, control => {
      const type = control.controlType.toLowerCase();

      if (
        (type.includes("icon") || type === "image") &&
        control.properties.AccessibleLabel === undefined
      ) {
        findings.push({
          id: "canvas.accessibility.label:" + control.id,
          ruleId: "canvas.accessibility.label",
          severity: "info",
          category: "accessibility",
          title: "AccessibleLabel not serialized",
          message:
            "This visual control does not include an AccessibleLabel property in the inspected source.",
          suggestion:
            "Review whether the control is decorative or requires an accessible name. Default/inherited runtime values are not reconstructed by this tool.",
          confidence: "medium",
          sourceFile: control.sourceFile,
          controlPath: control.sourcePath
        });
      }
    });
  }

  return findings;
}

function analyzeDuplicateFormulas(refs: FormulaRef[]): Finding[] {
  const groups = new Map<string, FormulaRef[]>();

  for (const ref of refs) {
    const normalized = ref.formula.replace(/\s+/g, " ").trim();
    if (normalized.length < 80) continue;

    const group = groups.get(normalized) ?? [];
    group.push(ref);
    groups.set(normalized, group);
  }

  const findings: Finding[] = [];

  for (const refsForFormula of groups.values()) {
    if (refsForFormula.length < 3) continue;

    const ref = refsForFormula[0];
    findings.push(
      finding(
        ref,
        "powerfx.maintainability.duplicate-formula",
        "info",
        "maintainability",
        "Repeated formula",
        "An equivalent formula appears in " +
          refsForFormula.length +
          " inspected properties.",
        "Review whether the logic can be centralized without changing evaluation context or behavior.",
        "medium"
      )
    );
  }

  return findings;
}

export function analyzeCanvasApp(app: CanvasAppModel): Finding[] {
  const refs = collectFormulaRefs(app);
  const findings = [
    ...refs.flatMap(analyzeFormula),
    ...analyzeDuplicateFormulas(refs),
    ...analyzeAccessibility(app)
  ];

  for (const problem of app.problems) {
    const schema = problem.source === "schema";
    findings.push({
      id:
        "source:" +
        problem.file +
        ":" +
        (problem.path ?? "") +
        ":" +
        problem.message,
      ruleId: schema ? "source.pa-yaml-v3-schema" : "source.yaml",
      severity: problem.severity === "error" ? "error" : "warning",
      category: "structure",
      title:
        problem.severity === "error"
          ? schema
            ? "Canvas source schema error"
            : "Source parse error"
          : "Source warning",
      message: problem.message,
      confidence: "high",
      sourceFile: problem.file,
      controlPath: problem.path
    });
  }

  return findings.sort((a, b) => {
    const rank = { error: 0, warning: 1, info: 2 };
    return (
      rank[a.severity] - rank[b.severity] ||
      a.ruleId.localeCompare(b.ruleId)
    );
  });
}
