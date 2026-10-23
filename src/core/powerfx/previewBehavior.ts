import { evaluateStaticPowerFx, type StaticPowerFxValue } from "./staticEval";
import { lexPowerFx, significantTokens, type PowerFxToken } from "./lexer";

/** Deliberately tiny, reversible Power Fx *preview* model, never an interpreter. */
export type PreviewVariables = Record<string, StaticPowerFxValue>;

export interface PreviewActionResult {
  ok: boolean;
  variables: PreviewVariables;
  changes: string[];
  message: string;
}

const MAX_FORMULA_CHARS = 8000;
const MAX_STEPS = 20;
const MAX_VARIABLES = 64;
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED = new Set(["app", "self", "parent", "thisitem", "true", "false"]);

function split(tokens: PowerFxToken[], separator: string): PowerFxToken[][] | null {
  const groups: PowerFxToken[][] = [];
  let start = 0;
  const closers: string[] = [];
  const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };

  for (let i = 0; i < tokens.length; i++) {
    const value = tokens[i].value;
    if (pairs[value]) {
      closers.push(pairs[value]);
    } else if (value === ")" || value === "}" || value === "]") {
      if (closers.pop() !== value) return null;
    } else if (value === separator && closers.length === 0) {
      if (i === start) return null;
      groups.push(tokens.slice(start, i));
      start = i + 1;
    }
  }
  if (closers.length || start >= tokens.length) return null;
  groups.push(tokens.slice(start));
  return groups;
}

function textOf(source: string, tokens: PowerFxToken[]): string {
  if (!tokens.length) return "";
  return source.slice(tokens[0].start, tokens[tokens.length - 1].end);
}

function validName(tokens: PowerFxToken[]): string | null {
  if (tokens.length !== 1 || tokens[0].kind !== "identifier") return null;
  const name = tokens[0].value;
  return NAME.test(name) && !RESERVED.has(name.toLowerCase()) ? name : null;
}

function canonical(name: string, vars: PreviewVariables): string {
  return Object.keys(vars).find(key => key.toLowerCase() === name.toLowerCase()) ?? name;
}

function evaluateValue(source: string, tokens: PowerFxToken[], vars: PreviewVariables):
  StaticPowerFxValue | null {
  const value = evaluateStaticPowerFx("=" + textOf(source, tokens), { symbols: vars });
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value;
}

function applyStep(
  source: string,
  tokens: PowerFxToken[],
  working: PreviewVariables,
  changed: string[]
): string | null {
  if (tokens.length < 5 || tokens[0].kind !== "identifier" ||
      tokens[1].value !== "(" || tokens[tokens.length - 1].value !== ")") {
    return "Only simple Set and UpdateContext calls are supported.";
  }
  const operation = tokens[0].value.toLowerCase();
  const args = split(tokens.slice(2, -1), ",");
  if (!args) return "Malformed or unsupported function arguments.";

  let updates: Array<[string, PowerFxToken[]]> = [];
  if (operation === "set") {
    if (args.length !== 2) return "Set must have exactly two arguments.";
    const name = validName(args[0]);
    if (!name) return "Set target must be a simple nonreserved variable.";
    updates = [[name, args[1]]];
  } else if (operation === "updatecontext") {
    if (args.length !== 1) return "UpdateContext requires one literal record.";
    const record = args[0];
    if (record[0]?.value !== "{" || record[record.length - 1]?.value !== "}") {
      return "UpdateContext requires a literal record.";
    }
    const fields = split(record.slice(1, -1), ",");
    if (!fields) return "UpdateContext record is empty or malformed.";
    for (const field of fields) {
      if (field[1]?.value !== ":") return "UpdateContext fields require name: value.";
      const name = validName(field.slice(0, 1));
      if (!name || field.length < 3) return "Unsupported context field.";
      updates.push([name, field.slice(2)]);
    }
  } else {
    return "Blocked behavior: " + tokens[0].value + ". Only Set/UpdateContext are simulated.";
  }

  const candidate = { ...working };
  for (const [name, expression] of updates) {
    const actual = canonical(name, candidate);
    const value = evaluateValue(source, expression, candidate);
    if (value === null) return "Unresolved value for " + name + "; no changes applied.";
    candidate[actual] = value;
    if (Object.keys(candidate).length > MAX_VARIABLES) return "Variable count limit exceeded.";
  }
  for (const [name] of updates) changed.push(canonical(name, candidate));
  Object.assign(working, candidate);
  return null;
}

/**
 * Transactional by design: an unsupported action anywhere in a behavior formula
 * rejects the complete batch. No network, browser code, formulas with effects,
 * connector calls, Patch/Collect/Navigate, or arbitrary JavaScript is run.
 */
export function simulatePreviewBehavior(
  formula: unknown,
  variables: PreviewVariables = {}
): PreviewActionResult {
  const original = { ...variables };
  const rejected = (message: string): PreviewActionResult => ({
    ok: false, variables: original, changes: [], message
  });
  if (typeof formula !== "string" || !formula.trim()) return rejected("No behavior formula.");
  if (formula.length > MAX_FORMULA_CHARS) return rejected("Behavior formula is too long.");
  const source = formula.trim();
  const lexed = lexPowerFx(source);
  if (lexed.diagnostics.length) return rejected("Behavior formula has lexical errors.");
  const tokens = significantTokens(lexed.tokens);
  if (tokens[0]?.value === "=") tokens.shift();
  const actions = split(tokens, ";");
  if (!actions || actions.length > MAX_STEPS) return rejected("Invalid action sequence or step limit exceeded.");

  const working: PreviewVariables = { ...variables };
  const changes: string[] = [];
  for (const step of actions) {
    const issue = applyStep(source, step, working, changes);
    if (issue) return rejected(issue);
  }
  const unique = [...new Set(changes)];
  return {
    ok: true, variables: working, changes: unique,
    message: unique.length ? "Simulated: " + unique.join(", ") : "No local changes."
  };
}
