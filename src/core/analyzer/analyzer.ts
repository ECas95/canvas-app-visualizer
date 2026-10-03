import type {
  CanvasAppModel,
  CanvasControl,
  Finding,
  FormulaRef
} from "../../types/canvas";
import { collectFormulaRefs } from "../model/formulas";

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

function countMatches(input: string, pattern: RegExp): number {
  return [...input.matchAll(pattern)].length;
}

export function checkBalancedDelimiters(formula: string): string | null {
  const stack: string[] = [];
  const pairs: Record<string, string> = {
    ")": "(",
    "]": "[",
    "}": "{"
  };

  let quoted = false;

  for (let index = 0; index < formula.length; index += 1) {
    const char = formula[index];

    if (char === '"') {
      if (quoted && formula[index + 1] === '"') {
        index += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }

    if (quoted) continue;

    if ("([{".includes(char)) {
      stack.push(char);
      continue;
    }

    if (")]}".includes(char)) {
      const expected = pairs[char];
      if (stack.pop() !== expected) {
        return "Unbalanced delimiter near character " + String(index + 1) + ".";
      }
    }
  }

  if (quoted) return "Unterminated text literal.";
  if (stack.length > 0) return "One or more delimiters are not closed.";
  return null;
}

function analyzeFormula(ref: FormulaRef): Finding[] {
  const formula = ref.formula;
  const findings: Finding[] = [];
  const balanceProblem = checkBalancedDelimiters(formula);

  if (balanceProblem) {
    findings.push(
      finding(
        ref,
        "powerfx.syntax.delimiters",
        "error",
        "syntax",
        "Potential Power Fx syntax error",
        balanceProblem,
        "Validate the expression in Power Apps Studio or a Power Fx parser before deployment.",
        "high"
      )
    );
  }

  const lookupCount = countMatches(formula, /\bLookUp\s*\(/gi);
  if (lookupCount >= 3) {
    findings.push(
      finding(
        ref,
        "powerfx.performance.repeated-lookup",
        "warning",
        "performance",
        "Repeated LookUp calls",
        "This formula contains " + lookupCount + " LookUp calls. Repeated remote lookups can multiply round trips.",
        "Reuse an already retrieved record, pre-shape a small lookup dataset, or move reusable logic to a named formula when appropriate.",
        "medium"
      )
    );
  }

  if (/\bForAll\s*\(/i.test(formula) && /\bPatch\s*\(/i.test(formula)) {
    findings.push(
      finding(
        ref,
        "powerfx.performance.forall-patch",
        "warning",
        "performance",
        "ForAll + Patch requires review",
        "The formula combines ForAll and Patch. Row-oriented writes can create many server operations.",
        "Compare this implementation with a supported table-oriented write pattern and validate error semantics before changing it.",
        "medium"
      )
    );
  }

  if (/\bClearCollect\s*\(/i.test(formula)) {
    findings.push(
      finding(
        ref,
        "powerfx.delegation.clearcollect",
        "warning",
        "delegation",
        "ClearCollect can materialize data locally",
        "If the collected source is remote, only the rows actually retrieved by the client become available to later local formulas.",
        "Confirm delegation on the source query and test above the nondelegable row limit.",
        "high"
      )
    );
  }

  if (/\b(?:Search|Distinct)\s*\(/i.test(formula) || /\s+in\s+/i.test(formula)) {
    findings.push(
      finding(
        ref,
        "powerfx.delegation.connector-dependent",
        "info",
        "delegation",
        "Connector-dependent delegation",
        "This expression contains operations whose delegation behavior can depend on the connector, column type, and expression shape.",
        "Select a data-source profile and confirm the expression against current connector delegation documentation and runtime warnings.",
        "medium"
      )
    );
  }

  if (
    /\b(?:Patch|Remove|RemoveIf)\s*\(/i.test(formula) &&
    !/\bIfError\s*\(/i.test(formula)
  ) {
    findings.push(
      finding(
        ref,
        "powerfx.reliability.write-error-handling",
        "info",
        "maintainability",
        "Write operation has no local IfError wrapper",
        "A data-changing operation is present without an IfError wrapper in the same formula.",
        "Review the app's error-handling strategy. Errors might already be handled elsewhere, so this is a review hint rather than a defect.",
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
        "Consider With, named formulas, components, or server-side logic where those choices preserve behavior and improve clarity.",
        "medium"
      )
    );
  }

  if (
    ref.ownerType === "app" &&
    ref.property === "OnStart" &&
    /\bNavigate\s*\(/i.test(formula)
  ) {
    findings.push(
      finding(
        ref,
        "canvas.startup.navigate-onstart",
        "warning",
        "performance",
        "Navigation is coupled to App.OnStart",
        "Startup navigation is coupled to imperative initialization work.",
        "Review whether App.StartScreen can select the initial screen without waiting on unrelated startup work.",
        "medium"
      )
    );
  }

  if (
    ref.ownerType === "app" &&
    ref.property === "OnStart" &&
    countMatches(formula, /\b(?:ClearCollect|Collect|Patch|LookUp|Filter)\s*\(/gi) >= 4
  ) {
    findings.push(
      finding(
        ref,
        "canvas.startup.heavy-onstart",
        "warning",
        "performance",
        "Potentially heavy App.OnStart",
        "App.OnStart contains several data-oriented operations.",
        "Measure initial-screen readiness and move secondary work to lazy/on-demand loading where functional behavior allows.",
        "medium"
      )
    );
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
            "Review whether the control is decorative or needs an accessible name. Default/inherited values are not reconstructed by this tool.",
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
        "An equivalent formula appears in " + refsForFormula.length + " inspected properties.",
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
    findings.push({
      id: "source:" + problem.file + ":" + problem.message,
      ruleId: "source.yaml",
      severity: problem.severity === "error" ? "error" : "warning",
      category: "structure",
      title: problem.severity === "error" ? "YAML parse error" : "Source warning",
      message: problem.message,
      confidence: "high",
      sourceFile: problem.file
    });
  }

  return findings.sort((a, b) => {
    const rank = { error: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity] || a.ruleId.localeCompare(b.ruleId);
  });
}
