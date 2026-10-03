import type { CanvasAppModel, Finding, FormulaRef } from "../../types/canvas";
import { collectFormulaRefs } from "../model/formulas";

interface DotnetRuntime {
  getConfig(): { mainAssemblyName: string };
  getAssemblyExports(name: string): Promise<Record<string, unknown>>;
}

interface DotnetModule {
  dotnet: {
    create(): Promise<DotnetRuntime>;
  };
}

interface OfficialDiagnostic {
  message: string;
  severity?: string;
  warning?: boolean;
  start?: number | null;
  end?: number | null;
}

interface OfficialParseResult {
  success: boolean;
  errors?: OfficialDiagnostic[];
}

interface BatchResult {
  id?: string;
  result?: OfficialParseResult;
}

interface ParseBatchResponse {
  engine?: string;
  mode?: string;
  success?: boolean;
  hostError?: string;
  results?: BatchResult[];
}

interface SemanticExports {
  ParseBatch(requestJson: string): string;
}

let enginePromise: Promise<SemanticExports> | undefined;

function semanticExports(
  exports: Record<string, unknown>
): SemanticExports | null {
  const root = exports as {
    CanvasAppVisualizer?: {
      PowerFxWasm?: {
        SemanticEngine?: Partial<SemanticExports>;
      };
    };
  };

  const engine = root.CanvasAppVisualizer?.PowerFxWasm?.SemanticEngine;
  return engine && typeof engine.ParseBatch === "function"
    ? (engine as SemanticExports)
    : null;
}

async function loadEngine(): Promise<SemanticExports> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const moduleUrl = new URL(
        "powerfx/_framework/dotnet.js",
        document.baseURI
      ).toString();

      const imported = (await import(
        /* @vite-ignore */ moduleUrl
      )) as DotnetModule;

      if (!imported.dotnet?.create) {
        throw new Error("The local Power Fx WebAssembly runtime did not expose dotnet.create().");
      }

      const runtime = await imported.dotnet.create();
      const config = runtime.getConfig();
      const exports = await runtime.getAssemblyExports(config.mainAssemblyName);
      const semantic = semanticExports(exports);

      if (!semantic) {
        throw new Error("The local Microsoft Power Fx semantic exports were not found.");
      }

      return semantic;
    })().catch(error => {
      enginePromise = undefined;
      throw error;
    });
  }

  return enginePromise;
}

export interface NormalizedCanvasFormula {
  expression: string;
  offset: number;
}

export function normalizeCanvasFormula(formula: string): NormalizedCanvasFormula {
  const firstNonWhitespace = formula.search(/\S/u);
  if (firstNonWhitespace < 0) {
    return { expression: formula, offset: 0 };
  }

  if (formula[firstNonWhitespace] !== "=") {
    return { expression: formula, offset: 0 };
  }

  return {
    expression:
      formula.slice(0, firstNonWhitespace) +
      formula.slice(firstNonWhitespace + 1),
    offset: firstNonWhitespace + 1
  };
}

function isBehaviorProperty(property: string): boolean {
  return /^On[A-Z]/u.test(property) ||
    new Set([
      "OnSelect",
      "OnChange",
      "OnVisible",
      "OnHidden",
      "OnStart",
      "OnCheck",
      "OnUncheck",
      "OnSuccess",
      "OnFailure",
      "OnReset",
      "OnTimerStart",
      "OnTimerEnd"
    ]).has(property);
}

function diagnosticToFinding(
  ref: FormulaRef,
  diagnostic: OfficialDiagnostic,
  expressionOffset: number,
  index: number
): Finding {
  const severity: Finding["severity"] = diagnostic.warning ? "warning" : "error";
  const start =
    typeof diagnostic.start === "number"
      ? diagnostic.start + expressionOffset
      : undefined;
  const end =
    typeof diagnostic.end === "number"
      ? diagnostic.end + expressionOffset
      : undefined;

  const spanText =
    start !== undefined && end !== undefined
      ? ` Character span ${start}–${end}.`
      : "";

  return {
    id: [
      "powerfx.official.syntax",
      ref.sourceFile ?? "unknown",
      ref.controlPath,
      ref.property,
      String(index)
    ].join(":"),
    ruleId: "powerfx.official.syntax",
    severity,
    category: "syntax",
    title: diagnostic.warning
      ? "Official Power Fx parser warning"
      : "Official Power Fx syntax error",
    message: diagnostic.message + spanText,
    suggestion:
      "Review this expression against the official Microsoft Power Fx parser result.",
    confidence: "high",
    sourceFile: ref.sourceFile,
    controlPath: ref.controlPath,
    property: ref.property,
    formula: ref.formula
  };
}

export async function analyzeOfficialPowerFxSyntax(
  app: CanvasAppModel,
  locale = "en-US"
): Promise<Finding[]> {
  const refs = collectFormulaRefs(app);
  if (refs.length === 0) return [];

  const engine = await loadEngine();
  const requests = refs.map((ref, index) => {
    const normalized = normalizeCanvasFormula(ref.formula);
    return {
      id: String(index),
      formula: normalized.expression,
      locale,
      allowsSideEffects: isBehaviorProperty(ref.property)
    };
  });

  const raw = engine.ParseBatch(JSON.stringify(requests));
  const response = JSON.parse(raw) as ParseBatchResponse;

  if (response.hostError) {
    throw new Error(response.hostError);
  }

  if (!response.success || !Array.isArray(response.results)) {
    throw new Error("The local Microsoft Power Fx parser returned an invalid batch response.");
  }

  const findings: Finding[] = [];

  for (const item of response.results) {
    const index = Number(item.id);
    const ref = refs[index];

    if (!ref || !item.result || item.result.success) continue;

    const normalized = normalizeCanvasFormula(ref.formula);
    for (const [diagnosticIndex, diagnostic] of (item.result.errors ?? []).entries()) {
      findings.push(
        diagnosticToFinding(
          ref,
          diagnostic,
          normalized.offset,
          diagnosticIndex
        )
      );
    }
  }

  return findings;
}
