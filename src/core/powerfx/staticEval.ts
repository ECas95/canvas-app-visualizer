import { lexPowerFx, significantTokens, type PowerFxToken } from "./lexer";

export type StaticPowerFxValue = number | boolean | string;

export interface StaticPowerFxContext {
  symbols?: Record<string, StaticPowerFxValue>;
}

const ENUM_PREFIXES = new Set([
  "layoutdirection",
  "layoutalignitems",
  "layoutjustifycontent",
  "alignincontainer",
  "layoutoverflow",
  "imageposition",
  "imagerotation",
  "displaymode",
  "sortorder"
]);

function stringValue(raw: string): string {
  return raw.slice(1, -1).replaceAll('""', '"');
}

function identifierValue(token: PowerFxToken): string {
  if (token.kind === "quotedIdentifier") {
    return token.value.slice(1, -1).replaceAll("''", "'");
  }
  return token.value;
}

class Parser {
  private index = 0;
  private readonly tokens: PowerFxToken[];
  private readonly symbols: Map<string, StaticPowerFxValue>;
  private failed = false;

  constructor(formula: string, context: StaticPowerFxContext) {
    const result = lexPowerFx(formula);
    this.tokens = significantTokens(result.tokens);

    if (result.diagnostics.length > 0) this.failed = true;

    if (this.tokens[0]?.value === "=") {
      this.index = 1;
    }

    this.symbols = new Map(
      Object.entries(context.symbols ?? {}).map(([key, value]) => [
        key.toLowerCase(),
        value
      ])
    );
  }

  parse(): StaticPowerFxValue | null {
    if (this.failed) return null;
    const value = this.parseOr();
    if (this.failed || this.index !== this.tokens.length) return null;
    // JavaScript's Infinity/NaN are not verified Power Fx numeric values.
    return typeof value === "number" ? this.finite(value) : value;
  }

  private peek(offset = 0): PowerFxToken | undefined {
    return this.tokens[this.index + offset];
  }

  private take(): PowerFxToken | undefined {
    const token = this.peek();
    if (token) this.index += 1;
    return token;
  }

  private match(value: string): boolean {
    const token = this.peek();
    if (!token || token.value.toLowerCase() !== value.toLowerCase()) {
      return false;
    }
    this.index += 1;
    return true;
  }

  private parseOr(): StaticPowerFxValue | null {
    let left = this.parseAnd();

    while (
      this.peek()?.value === "||" ||
      this.peek()?.value.toLowerCase() === "or"
    ) {
      this.take();
      const right = this.parseAnd();
      if ((left !== null && typeof left !== "boolean") ||
          (right !== null && typeof right !== "boolean")) return this.fail();
      // The other branch cannot change true OR unknown.
      left = left === true || right === true ? true :
        left === null || right === null ? null : false;
    }

    return left;
  }

  private parseAnd(): StaticPowerFxValue | null {
    let left = this.parseComparison();

    while (
      this.peek()?.value === "&&" ||
      this.peek()?.value.toLowerCase() === "and"
    ) {
      this.take();
      const right = this.parseComparison();
      if ((left !== null && typeof left !== "boolean") ||
          (right !== null && typeof right !== "boolean")) return this.fail();
      // The other branch cannot change false AND unknown.
      left = left === false || right === false ? false :
        left === null || right === null ? null : true;
    }

    return left;
  }

  private parseComparison(): StaticPowerFxValue | null {
    let left = this.parseConcat();
    const op = this.peek()?.value.toLowerCase();

    if (!op || !["=", "==", "<>", "<", ">", "<=", ">=", "in", "exactin"].includes(op)) {
      return left;
    }

    this.take();
    const right = this.parseConcat();
    if (left === null || right === null) return null;

    switch (op) {
      case "in":
      case "exactin": {
        // Power Fx text membership is case-insensitive for in and
        // case-sensitive for exactin. Table/record membership and
        // locale-dependent Unicode comparisons require runtime semantics.
        // https://learn.microsoft.com/en-us/power-platform/power-fx/operators
        if (typeof left !== "string" || typeof right !== "string") return null;
        if (![left, right].every(value =>
          Array.from(value).every(char => char.charCodeAt(0) <= 0x7f))) return null;
        return op === "in" ? right.toLowerCase().includes(left.toLowerCase()) : right.includes(left);
      }
      case "=":
      case "==":
      case "<>":
        // Power Fx can reject or coerce comparisons between unlike scalar
        // types depending on its binder and host context. JavaScript strict
        // inequality would incorrectly certify a permission/Visible branch.
        // Without official type binding, preserve uncertainty instead.
        // https://learn.microsoft.com/en-us/power-platform/power-fx/operators
        if (typeof left !== typeof right) return null;
        return op === "<>" ? left !== right : left === right;
      case "<":
      case ">":
      case "<=":
      case ">=":
        if (typeof left !== "number" || typeof right !== "number") {
          return this.fail();
        }
        if (op === "<") return left < right;
        if (op === ">") return left > right;
        if (op === "<=") return left <= right;
        return left >= right;
      default:
        return this.fail();
    }
  }

  private parseConcat(): StaticPowerFxValue | null {
    let left = this.parseAdditive();

    while (this.peek()?.value === "&") {
      this.take();
      const right = this.parseAdditive();
      if (left === null || right === null) {
        left = null;
        continue;
      }
      left = String(left) + String(right);
    }

    return left;
  }

  private parseAdditive(): StaticPowerFxValue | null {
    let left = this.parseMultiplicative();

    while (this.peek()?.value === "+" || this.peek()?.value === "-") {
      const op = this.take()?.value;
      const right = this.parseMultiplicative();
      if (left === null || right === null) {
        left = null;
        continue;
      }
      if (typeof left !== "number" || typeof right !== "number") return this.fail();
      left = this.finite(op === "+" ? left + right : left - right);
    }

    return left;
  }

  private parseMultiplicative(): StaticPowerFxValue | null {
    let left = this.parsePower();

    while (
      this.peek()?.value === "*" ||
      this.peek()?.value === "/"
    ) {
      const op = this.take()?.value;
      const right = this.parsePower();
      if (left === null || right === null) {
        left = null;
        continue;
      }
      if (typeof left !== "number" || typeof right !== "number") return this.fail();

      left = this.finite(op === "*" ? left * right : left / right);
    }

    return left;
  }

  private parsePower(): StaticPowerFxValue | null {
    let left = this.parseUnary();

    if (this.peek()?.value === "^") {
      this.take();
      const right = this.parsePower();
      if (left === null || right === null) return null;
      if (typeof left !== "number" || typeof right !== "number") return this.fail();
      left = this.finite(Math.pow(left, right));
    }

    return left;
  }

  private parseUnary(): StaticPowerFxValue | null {
    const token = this.peek();

    if (token?.value === "+" || token?.value === "-") {
      this.take();
      const value = this.parseUnary();
      if (value === null) return null;
      if (typeof value !== "number") return this.fail();
      return this.finite(token.value === "-" ? -value : value);
    }

    if (token?.value === "!" || token?.value.toLowerCase() === "not") {
      this.take();
      const value = this.parseUnary();
      if (value === null) return null;
      if (typeof value !== "boolean") return this.fail();
      return !value;
    }

    return this.parsePostfix();
  }

  private parsePostfix(): StaticPowerFxValue | null {
    let value = this.parsePrimary();

    while (this.peek()?.value === "%") {
      this.take();
      if (value === null) continue;
      if (typeof value !== "number") return this.fail();
      value = this.finite(value / 100);
    }

    return value;
  }

  private parsePrimary(): StaticPowerFxValue | null {
    const token = this.take();
    if (!token) return this.fail();

    if (token.kind === "number") {
      const value = Number(token.value);
      return Number.isFinite(value) ? value : this.fail();
    }

    if (token.kind === "string") {
      return stringValue(token.value);
    }

    if (token.value === "(") {
      const value = this.parseOr();
      if (!this.match(")")) return this.fail();
      return value;
    }

    if (
      token.kind !== "identifier" &&
      token.kind !== "quotedIdentifier"
    ) {
      return this.fail();
    }

    const first = identifierValue(token);
    const firstLower = first.toLowerCase();

    // Single-quoted Power Fx names are identifiers, not Boolean literals.
    // A quoted 'true'/'false' may reference runtime state; only unquoted
    // keywords can establish a source-verified visibility/layout condition.
    // https://learn.microsoft.com/en-us/power-platform/power-fx/operators
    if (token.kind === "identifier" && firstLower === "true") return true;
    if (token.kind === "identifier" && firstLower === "false") return false;

    const segments = [first];
    while (
      this.peek()?.value === "." &&
      (this.peek(1)?.kind === "identifier" ||
        this.peek(1)?.kind === "quotedIdentifier")
    ) {
      this.take();
      const part = this.take();
      if (!part) return this.fail();
      segments.push(identifierValue(part));
    }

    const qualified = segments.join(".");

    if (this.peek()?.value === "(") {
      this.take();
      const args: Array<StaticPowerFxValue | null> = [];

      if (this.peek()?.value !== ")") {
        while (true) {
          args.push(this.parseOr());
          if (this.match(")")) break;
          if (!this.match(",")) return this.fail();
        }
      } else {
        this.take();
      }

      // Quoted names can denote user-defined functions. Even when they
      // resemble supported built-ins, never execute them as Power Fx If,
      // Max, Not, etc. without a verified function binding.
      return token.kind === "identifier" ? this.evaluateFunction(qualified, args) : null;
    }

    const symbol = this.symbols.get(qualified.toLowerCase());
    if (symbol !== undefined) {
      return typeof symbol === "number" ? this.finite(symbol) : symbol;
    }

    if (
      segments.length === 2 &&
      ENUM_PREFIXES.has(segments[0].toLowerCase())
    ) {
      return qualified;
    }

    // Unknown runtime symbol: valid expression, unresolved value.
    return null;
  }

  private evaluateFunction(
    qualifiedName: string,
    args: Array<StaticPowerFxValue | null>
  ): StaticPowerFxValue | null {
    // Qualified calls can refer to connectors or user-defined functions.
    // Never interpret Connector.If(...) or Source.Min(...) as a pure built-in.
    if (qualifiedName.includes(".")) return null;
    const name = qualifiedName.toLowerCase();

    if (name === "if") {
      // Power Fx If accepts condition/result pairs followed by an optional
      // default. Only a proven-true branch may be selected; unknown
      // conditions or missing/Blank defaults remain unresolved in preview.
      // https://learn.microsoft.com/power-platform/power-fx/reference/function-if
      if (args.length < 2) return this.fail();
      for (let i = 0; i + 1 < args.length; i += 2) {
        const condition = args[i];
        if (condition === null) return null;
        if (typeof condition !== "boolean") return this.fail();
        if (condition) return args[i + 1] ?? null;
      }
      return args.length % 2 === 1 ? args[args.length - 1] ?? null : null;
    }

    if (name === "switch") {
      // Power Fx Switch compares a single expression with ordered match/result
      // pairs. A preceding unknown match may win, so it must not be skipped.
      // With no matching pair and no default, the result is Blank (unknown
      // to this source-only scalar preview), not a fabricated zero/false.
      // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-if
      if (args.length < 3 || args[0] === null) return null;
      const selector = args[0];
      for (let i = 1; i + 1 < args.length; i += 2) {
        const match = args[i];
        if (match === null || typeof match !== typeof selector) return null;
        if (selector === match) return args[i + 1] ?? null;
      }
      return args.length % 2 === 0 ? args[args.length - 1] ?? null : null;
    }

    if (name === "coalesce") {
      // Power Fx skips both Blank and the empty string. Returning "" for
      // Coalesce("", "fallback") is incorrect and hides verified labels.
      // A null here may be an unknown SQL/runtime value, not proven Blank:
      // fail closed rather than selecting a later argument.
      // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-isblank-isempty
      if (args.length === 0) return this.fail();
      if (args.some(value => value === null)) return null;
      const known = args as StaticPowerFxValue[];
      // Microsoft requires a common argument type. Do not coerce a mixed
      // expression into a misleading source-verified preview value.
      if (new Set(known.map(value => typeof value)).size !== 1) return null;
      return known.find(value => value !== "") ?? null;
    }

    // Microsoft documents these as pure Boolean functions. Resolve only
    // type-safe local values; unknown SQL/permission conditions remain unknown.
    // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-logicals
    if (name === "not") {
      if (args.length !== 1 ||
          (args[0] !== null && typeof args[0] !== "boolean")) return null;
      return args[0] === null ? null : !args[0];
    }

    if (name === "and" || name === "or") {
      if (args.length < 2 ||
          args.some(value => value !== null && typeof value !== "boolean")) return null;
      // A proven false dominates And; a proven true dominates Or.
      // Neither case requires assuming an unknown runtime value.
      if (name === "and") {
        return args.includes(false) ? false :
          args.includes(null) ? null : true;
      }
      return args.includes(true) ? true :
        args.includes(null) ? null : false;
    }

    // IsBlank accepts a single scalar and treats only a verified empty string
    // as blank in this source-only evaluator. null also represents unknown
    // SQL/runtime state, so it cannot safely be treated as Power Fx Blank().
    // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-isblank-isempty
    if (name === "isblank") {
      if (args.length !== 1 || args[0] === null) return null;
      return args[0] === "";
    }

    // Power Fx Upper/Lower/Trim/TrimEnds are pure scalar text functions.
    // Case/space semantics for non-ASCII may depend on locale and host, so
    // only evaluate ASCII values as confirmed preview output.
    // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-lower-upper-proper
    // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-trim
    if (["upper", "lower", "trim", "trimends"].includes(name)) {
      if (args.length !== 1 || typeof args[0] !== "string") return null;
      const value = args[0];
      if (!Array.from(value).every(char => char.charCodeAt(0) <= 0x7f)) return null;
      if (name === "upper") return value.toUpperCase();
      if (name === "lower") return value.toLowerCase();
      if (name === "trim") return value.replace(/ +/g, " ").replace(/^ +| +$/g, "");
      return value.replace(/^ +| +$/g, "");
    }

    // Len on a verified text scalar can drive label-dependent geometry.
    // Tables and unresolved input/control values are intentionally unsupported.
    // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-len
    if (name === "len") {
      if (args.length !== 1 || typeof args[0] !== "string") return null;
      return Array.from(args[0]).length;
    }

    // StartsWith/EndsWith are case-insensitive for scalar text in Power Fx.
    // Only verified ASCII input is evaluated: Unicode case folding can depend
    // on the app/data-source locale, which this source-only preview lacks.
    // SQL/ThisItem text and unverified inputs must remain unknown.
    // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-startswith
    if (name === "startswith" || name === "endswith") {
      if (args.length !== 2 || args.some(value => typeof value !== "string")) return null;
      const [text, search] = args as string[];
      if (![text, search].every(value =>
        Array.from(value).every(char => char.charCodeAt(0) <= 0x7f))) return null;
      const haystack = text.toLowerCase();
      const needle = search.toLowerCase();
      return name === "startswith" ? haystack.startsWith(needle) :
        haystack.endsWith(needle);
    }

    if (args.some(value => value === null)) return null;

    const values = args as StaticPowerFxValue[];
    const numbers = values.filter(
      (value): value is number => typeof value === "number"
    );

    if (["min", "max"].includes(name) && numbers.length === values.length) {
      if (numbers.length === 0) return this.fail();
      return this.finite(name === "min" ? Math.min(...numbers) : Math.max(...numbers));
    }

    // Abs accepts exactly one number; extra arguments must not certify
    // geometry or visibility. https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-numericals
    if (name === "abs" && values.length === 1 && typeof values[0] === "number") {
      return this.finite(Math.abs(values[0]));
    }

    // Microsoft Power Fx Power(base, exponent) is equivalent to ^, while
    // Sqrt(number) returns a numeric square root for nonnegative inputs.
    // Domain errors, overflow, and unresolved runtime inputs must not
    // certify preview coordinates, sizes, or visibility.
    // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-numericals
    if (name === "power") {
      if (values.length !== 2 || numbers.length !== 2) return null;
      return this.finite(Math.pow(numbers[0], numbers[1]));
    }
    if (name === "sqrt") {
      if (values.length !== 1 || numbers.length !== 1) return null;
      return this.finite(Math.sqrt(numbers[0]));
    }

    // Power Fx Int rounds toward negative infinity; Trunc removes the
    // fractional part toward zero. These differ for negative coordinates.
    // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-round
    if (name === "int" || name === "trunc") {
      if (values.length !== 1 || typeof values[0] !== "number") return null;
      return this.finite(name === "int" ? Math.floor(values[0]) : Math.trunc(values[0]));
    }

    // Unlike JavaScript's remainder operator, Power Fx Mod takes the sign
    // of the divisor. Do not infer a geometry value from division by zero.
    // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-mod
    if (name === "mod") {
      if (values.length !== 2 || numbers.length !== 2 || values[1] === 0) return null;
      const divisor = values[1] as number;
      let remainder = (values[0] as number) % divisor;
      if (remainder !== 0 && Math.sign(remainder) !== Math.sign(divisor)) {
        remainder += divisor;
      }
      return this.finite(remainder === 0 ? 0 : remainder);
    }

    if (["round", "roundup", "rounddown"].includes(name)) {
      // Microsoft Power Fx: Round breaks .5 ties away from zero; RoundUp
      // moves away from zero and RoundDown moves toward zero for both signs.
      // DecimalPlaces is required. Decline values beyond this conservative
      // JS-number preview range rather than inventing a precise result.
      // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-round
      if (values.length !== 2 ||
          typeof values[0] !== "number" ||
          typeof values[1] !== "number" ||
          !Number.isInteger(values[1]) || Math.abs(values[1]) > 12) return null;
      const digits = values[1];
      // Decimal exponent shifting avoids common binary scaling artifacts
      // (e.g. 1.005 * 100 is slightly below 100.5 in JavaScript).
      const shift = (number: number, exponent: number): number => {
        const [coefficient, existingExponent = "0"] = String(number).split("e");
        return Number(`${coefficient}e${Number(existingExponent) + exponent}`);
      };
      const scaled = shift(values[0], digits);
      if (!Number.isFinite(scaled) ||
          Math.abs(scaled) > Number.MAX_SAFE_INTEGER) return null;
      const magnitude = Math.abs(scaled);
      const roundedMagnitude = name === "round" ? Math.round(magnitude) :
        name === "roundup" ? Math.ceil(magnitude) : Math.floor(magnitude);
      const result = shift(Math.sign(scaled) * roundedMagnitude, -digits);
      return Number.isFinite(result) ? result : null;
    }

    // Unsupported pure/runtime function: preserve uncertainty, not a syntax error.
    return null;
  }

  // Power Fx raises a numeric error for division by zero; JS instead yields
  // Infinity/NaN. Never let such a value drive geometry, If conditions,
  // visibility, colors or a permission-like preview branch.
  // https://learn.microsoft.com/en-us/power-platform/power-fx/error-handling
  private finite(value: number): number | null {
    return Number.isFinite(value) ? value : null;
  }

  private fail(): null {
    this.failed = true;
    return null;
  }
}

export function evaluateStaticPowerFx(
  formula: unknown,
  context: StaticPowerFxContext = {}
): StaticPowerFxValue | null {
  if (typeof formula === "number" || typeof formula === "boolean") {
    return formula;
  }
  if (typeof formula !== "string") return null;
  return new Parser(formula.trim(), context).parse();
}

export function staticNumber(
  formula: unknown,
  symbols?: Record<string, StaticPowerFxValue>
): number | null {
  const value = evaluateStaticPowerFx(formula, { symbols });
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function staticBoolean(
  formula: unknown,
  symbols?: Record<string, StaticPowerFxValue>
): boolean | null {
  const value = evaluateStaticPowerFx(formula, { symbols });
  return typeof value === "boolean" ? value : null;
}

export function staticString(
  formula: unknown,
  symbols?: Record<string, StaticPowerFxValue>
): string | null {
  const value = evaluateStaticPowerFx(formula, { symbols });
  return typeof value === "string" ? value : null;
}
