import { evaluateStaticPowerFx, staticBoolean, type StaticPowerFxValue } from "../powerfx/staticEval";
import { lexPowerFx, significantTokens, type PowerFxToken } from "../powerfx/lexer";

/**
 * Canvas layout properties are typed Power Fx enums, not text. In particular,
 * ="LayoutDirection.Horizontal" must never certify horizontal geometry.
 * Only a literal member or a statically selected If branch is verifiable.
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/create-responsive-layout/
 */
const MEMBERS = {
  LayoutDirection: ["horizontal", "vertical"],
  LayoutJustifyContent: ["start", "center", "end", "spacebetween"],
  LayoutAlignItems: ["start", "center", "end", "stretch"],
  AlignInContainer: ["start", "center", "end", "stretch", "setbycontainer"]
} as const;

export type PreviewLayoutEnum = keyof typeof MEMBERS;

function branchSource(source: string, tokens: PowerFxToken[]): string {
  return "=" + source.slice(tokens[0].start, tokens[tokens.length - 1].end);
}

export function previewLayoutEnum(
  raw: unknown,
  namespace: PreviewLayoutEnum,
  symbols?: Record<string, StaticPowerFxValue>,
  depth = 0
): string | null {
  if (typeof raw !== "string" || depth > 6) return null;
  const source = raw.trim();
  const lexed = lexPowerFx(source);
  if (lexed.diagnostics.length) return null;
  const tokens = significantTokens(lexed.tokens);
  if (tokens[0]?.value === "=") tokens.shift();

  // Ignore trivia (whitespace/comments) but reject quoted strings, operators,
  // unknown enum members and bare variables even if their text looks right.
  if (tokens.length === 3 &&
      tokens[0].kind === "identifier" &&
      tokens[0].value.toLowerCase() === namespace.toLowerCase() &&
      tokens[1].value === "." &&
      tokens[2].kind === "identifier") {
    const member = tokens[2].value.toLowerCase();
    return (MEMBERS[namespace] as readonly string[]).includes(member) ? member : null;
  }

  const functionName = tokens[0]?.value.toLowerCase();
  if ((functionName !== "if" && functionName !== "switch") ||
      tokens[1]?.value !== "(" ||
      tokens[tokens.length - 1]?.value !== ")") return null;
  const inner = tokens.slice(2, -1);
  const args: PowerFxToken[][] = [];
  let nesting = 0;
  let start = 0;
  for (let index = 0; index < inner.length; index += 1) {
    if (inner[index].value === "(") nesting += 1;
    else if (inner[index].value === ")") nesting -= 1;
    else if (inner[index].value === "," && nesting === 0) {
      if (index === start) return null;
      args.push(inner.slice(start, index));
      start = index + 1;
    }
    if (nesting < 0) return null;
  }
  if (nesting !== 0 || start >= inner.length) return null;
  args.push(inner.slice(start));
  if (functionName === "switch") {
    // Switch compares one scalar selector against ordered match/result pairs.
    // Preserve enum type identity by resolving only Boolean/numeric selectors:
    // the scalar evaluator represents typed enums and strings alike as text.
    // A runtime-dependent selector or preceding match cannot be skipped.
    // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-if
    if (args.length < 3) return null;
    const selector = evaluateStaticPowerFx(branchSource(source, args[0]), { symbols });
    if (selector === null || (typeof selector !== "boolean" &&
        typeof selector !== "number")) return null;
    for (let index = 1; index + 1 < args.length; index += 2) {
      const match = evaluateStaticPowerFx(branchSource(source, args[index]), { symbols });
      if (match === null || typeof match !== typeof selector) return null;
      if (selector === match) {
        return previewLayoutEnum(branchSource(source, args[index + 1]),
          namespace, symbols, depth + 1);
      }
    }
    return args.length % 2 === 0
      ? previewLayoutEnum(branchSource(source, args[args.length - 1]),
        namespace, symbols, depth + 1)
      : null;
  }

  if (args.length < 2) return null;

  for (let index = 0; index + 1 < args.length; index += 2) {
    const condition = staticBoolean(branchSource(source, args[index]), symbols);
    if (condition === null) return null;
    if (condition) {
      return previewLayoutEnum(branchSource(source, args[index + 1]),
        namespace, symbols, depth + 1);
    }
  }
  return args.length % 2 === 1
    ? previewLayoutEnum(branchSource(source, args[args.length - 1]),
      namespace, symbols, depth + 1)
    : null;
}
