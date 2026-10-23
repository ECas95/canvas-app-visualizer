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
    return value;
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
    const op = this.peek()?.value;

    if (!op || !["=", "==", "<>", "<", ">", "<=", ">="].includes(op)) {
      return left;
    }

    this.take();
    const right = this.parseConcat();
    if (left === null || right === null) return null;

    switch (op) {
      case "=":
      case "==":
        return left === right;
      case "<>":
        return left !== right;
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
      left = op === "+" ? left + right : left - right;
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

      if (op === "*") left *= right;
      else left /= right;
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
      left = Math.pow(left, right);
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
      return token.value === "-" ? -value : value;
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
      value /= 100;
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

    if (firstLower === "true") return true;
    if (firstLower === "false") return false;

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

      return this.evaluateFunction(qualified, args);
    }

    const symbol = this.symbols.get(qualified.toLowerCase());
    if (symbol !== undefined) return symbol;

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

    if (args.some(value => value === null)) return null;

    const values = args as StaticPowerFxValue[];
    const numbers = values.filter(
      (value): value is number => typeof value === "number"
    );

    if (["min", "max"].includes(name) && numbers.length === values.length) {
      if (numbers.length === 0) return this.fail();
      return name === "min" ? Math.min(...numbers) : Math.max(...numbers);
    }

    if (name === "abs" && typeof values[0] === "number") {
      return Math.abs(values[0]);
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

    if (name === "coalesce") {
      return values.find(value => value !== null) ?? null;
    }

    // Unsupported pure/runtime function: preserve uncertainty, not a syntax error.
    return null;
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
