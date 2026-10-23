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

  // The official parser sees the expression without the Canvas '=' prefix.
  // Strip preceding whitespace as well: every parser span can then be mapped
  // back to the original source by adding the same offset.
  return {
    expression: formula.slice(firstNonWhitespace + 1),
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

  return findingsFromOfficialBatch(refs, response);
}

/**
 * A partial or malformed WASM response must never be treated as a complete
 * authoritative parse: App.tsx can then retain the provisional TS findings.
 * Results are keyed by their original formula index, not by array order.
 */
export function findingsFromOfficialBatch(
  refs: FormulaRef[],
  response: ParseBatchResponse
): Finding[] {
  if (response.hostError) {
    throw new Error(response.hostError);
  }

  const invalidBatch = () =>
    new Error("The local Microsoft Power Fx parser returned an incomplete or invalid batch response.");

  if (
    response.engine !== "Microsoft.PowerFx" ||
    response.mode !== "parseBatch" ||
    response.success !== true ||
    !Array.isArray(response.results) ||
    response.results.length !== refs.length
  ) {
    throw invalidBatch();
  }

  const seen = new Set<number>();
  const findings: Finding[] = [];

  for (const item of response.results) {
    if (
      !item ||
      typeof item.id !== "string" ||
      !/^(0|[1-9]\d*)$/u.test(item.id)
    ) {
      throw invalidBatch();
    }

    const index = Number(item.id);
    if (
      !Number.isSafeInteger(index) ||
      index >= refs.length ||
      seen.has(index) ||
      !item.result ||
      typeof item.result.success !== "boolean" ||
      !Array.isArray(item.result.errors) ||
      (!item.result.success && item.result.errors.length === 0)
    ) {
      throw invalidBatch();
    }

    seen.add(index);
    const ref = refs[index];
    const normalized = normalizeCanvasFormula(ref.formula);

    // Power Fx can return warnings even when the parse succeeds.
    for (const [diagnosticIndex, diagnostic] of item.result.errors.entries()) {
      if (!diagnostic || typeof diagnostic.message !== "string") {
        throw invalidBatch();
      }

      // .NET Power Fx spans use UTF-16 offsets, like JavaScript strings.
      // Never publish misleading positions or suppress the lexical fallback
      // if the host returns incomplete or out-of-bounds span metadata.
      const { start, end } = diagnostic;
      if (start != null || end != null) {
        if (
          typeof start !== "number" ||
          typeof end !== "number" ||
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start < 0 ||
          end < start ||
          end > normalized.expression.length
        ) {
          throw invalidBatch();
        }
      }
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

/**
 * Once the official parser has returned a complete analysis, its syntax
 * diagnostics replace the TypeScript lexer's provisional syntax finding.
 * Keep all non-syntax static review hints. If the runtime is unavailable,
 * preserve the lexical fallback instead of hiding potential errors.
 *
 * Canvas .pa.yaml formulas are source expressions, not permission or
 * connector-runtime evidence. This merge only affects diagnostics.
 */
export function mergeOfficialPowerFxFindings(
  staticFindings: Finding[],
  officialFindings: Finding[],
  officialReady: boolean
): Finding[] {
  const fallback = officialReady
    ? staticFindings.filter(
        finding => finding.ruleId !== "powerfx.syntax.lexical-structure"
      )
    : staticFindings;
  const rank: Record<Finding["severity"], number> = {
    error: 0,
    warning: 1,
    info: 2
  };
  return [...officialFindings, ...fallback].sort(
    (a, b) => rank[a.severity] - rank[b.severity] || a.ruleId.localeCompare(b.ruleId)
  );
}
