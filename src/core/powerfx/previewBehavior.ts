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
// Prevent JavaScript object-prototype property names from being treated as
// writable preview variables. They can silently disappear or shadow host
// object members when stored in the plain record used by this simulator.
// This is a conservative preview restriction, not Power Fx name binding.
const RESERVED = new Set([
  "app", "self", "parent", "thisitem", "true", "false",
  "__proto__", "prototype", "constructor", "tostring", "tolocalestring",
  "valueof", "hasownproperty", "isprototypeof", "propertyisenumerable",
  "__definegetter__", "__definesetter__", "__lookupgetter__", "__lookupsetter__"
]);

// Only explicitly supported, side-effect-free calls may appear in values,
// including branches of If that would not be selected by static evaluation.
// This is a conservative validation pass, not a substitute for official
// Microsoft Power Fx AST/binding (tracked separately in PR #13).
const PURE_VALUE_FUNCTIONS = new Set([
  "if", "min", "max", "abs", "round", "roundup", "rounddown", "coalesce"
]);

function unsupportedValueFunction(tokens: PowerFxToken[]): string | null {
  for (let index = 1; index < tokens.length; index += 1) {
    if (tokens[index].value !== "(") continue;
    const callee = tokens[index - 1];
    if (callee.kind !== "identifier" && callee.kind !== "quotedIdentifier") continue;
    // Qualified calls (including connector functions named like built-ins)
    // and quoted function names are never interpreted as pure built-ins.
    if (callee.kind !== "identifier" ||
        tokens[index - 2]?.value === "." ||
        !PURE_VALUE_FUNCTIONS.has(callee.value.toLowerCase())) {
      return callee.value;
    }
  }
  return null;
}

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

/** A conservative browser-local model of Power Fx global and screen context scopes. */
export interface PreviewScopedState {
  globals: PreviewVariables;
  context: PreviewVariables;
}

export interface PreviewScopedActionResult extends PreviewActionResult {
  state: PreviewScopedState;
}

/** Context variables take precedence over same-name globals (case insensitive). */
export function previewScopedSymbols(state: PreviewScopedState): PreviewVariables {
  const symbols: PreviewVariables = { ...state.globals };
  for (const [name, value] of Object.entries(state.context)) {
    const existing = Object.keys(symbols).find(key => key.toLowerCase() === name.toLowerCase());
    if (existing) delete symbols[existing];
    symbols[name] = value;
  }
  return symbols;
}

function applyStep(
  source: string,
  tokens: PowerFxToken[],
  working: PreviewScopedState,
  changed: string[],
  batchKinds: Map<string, "set" | "updatecontext">,
  legacyCollisionGuard: boolean
): string | null {
  if (tokens.length < 5 || tokens[0].kind !== "identifier" ||
      tokens[1].value !== "(" || tokens[tokens.length - 1].value !== ")") {
    return "Only simple Set and UpdateContext calls are supported.";
  }
  const operation = tokens[0].value.toLowerCase();
  const args = split(tokens.slice(2, -1), ",");
  if (!args) return "Malformed or unsupported function arguments.";

  const updates: Array<[string, PowerFxToken[]]> = [];
  if (operation === "set") {
    if (args.length !== 2) return "Set must have exactly two arguments.";
    const name = validName(args[0]);
    if (!name) return "Set target must be a simple nonreserved variable.";
    updates.push([name, args[1]]);
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

  const target = operation === "set" ? working.globals : working.context;
  const other = operation === "set" ? working.context : working.globals;
  // Every field of a single UpdateContext record reads the same pre-call
  // snapshot; separate semicolon-delimited statements remain sequential.
  const symbols = previewScopedSymbols(working);
  const candidate = { ...target };
  const pending: Array<[string, StaticPowerFxValue]> = [];
  const seen = new Set<string>();
  for (const [name, expression] of updates) {
    const lower = name.toLowerCase();
    if (operation === "updatecontext" && seen.has(lower)) {
      return "Duplicate UpdateContext field: " + name + ".";
    }
    seen.add(lower);
    // Retain the original flat API's conservative behavior for callers that
    // have no scope metadata. The scoped API correctly represents both names.
    const earlierKind = batchKinds.get(lower);
    if (legacyCollisionGuard && earlierKind && earlierKind !== operation) {
      return "Ambiguous global/context variable " + name + "; no changes applied.";
    }
    const unsupported = unsupportedValueFunction(expression);
    if (unsupported) return "Unsupported nested function: " + unsupported + "; no changes applied.";
    const actual = canonical(name, target);
    const value = evaluateValue(source, expression, symbols);
    if (value === null) return "Unresolved value for " + name + "; no changes applied.";
    pending.push([actual, value]);
  }
  for (const [name, value] of pending) candidate[name] = value;
  if (Object.keys(candidate).length + Object.keys(other).length > MAX_VARIABLES) {
    return "Variable count limit exceeded.";
  }
  for (const [name] of pending) {
    changed.push(name);
    batchKinds.set(name.toLowerCase(), operation as "set" | "updatecontext");
  }
  Object.assign(target, candidate);
  return null;
}

/**
 * Transactional by design: an unsupported action anywhere in a behavior formula
 * rejects the complete batch. No network, browser code, formulas with effects,
 * connector calls, Patch/Collect/Navigate, or arbitrary JavaScript is run.
 */
function simulateBehavior(
  formula: unknown,
  state: PreviewScopedState,
  legacyCollisionGuard: boolean
): PreviewScopedActionResult {
  const original: PreviewScopedState = {
    globals: { ...state.globals },
    context: { ...state.context }
  };
  const rejected = (message: string): PreviewScopedActionResult => ({
    ok: false, state: original, variables: previewScopedSymbols(original),
    changes: [], message
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

  const working: PreviewScopedState = {
    globals: { ...state.globals },
    context: { ...state.context }
  };
  const changes: string[] = [];
  const batchKinds = new Map<string, "set" | "updatecontext">();
  for (const step of actions) {
    const issue = applyStep(source, step, working, changes, batchKinds, legacyCollisionGuard);
    if (issue) return rejected(issue);
  }
  const unique = [...new Set(changes)];
  return {
    ok: true, state: working, variables: previewScopedSymbols(working),
    changes: unique,
    message: unique.length ? "Simulated: " + unique.join(", ") : "No local changes."
  };
}

/** New scope-aware API for a single selected screen; no state is persisted. */
export function simulateScopedPreviewBehavior(
  formula: unknown,
  state: PreviewScopedState = { globals: {}, context: {} }
): PreviewScopedActionResult {
  return simulateBehavior(formula, state, false);
}

/** Backwards-compatible flat preview API; conservatively rejects mixed-scope writes. */
export function simulatePreviewBehavior(
  formula: unknown,
  variables: PreviewVariables = {}
): PreviewActionResult {
  const { ok, variables: next, changes, message } = simulateBehavior(
    formula, { globals: variables, context: {} }, true
  );
  return { ok, variables: next, changes, message };
}
