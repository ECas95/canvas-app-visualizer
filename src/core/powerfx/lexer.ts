export type PowerFxTokenKind =
  | "identifier"
  | "quotedIdentifier"
  | "number"
  | "string"
  | "interpolatedText"
  | "comment"
  | "operator"
  | "punctuation"
  | "whitespace"
  | "error";

export interface PowerFxToken {
  kind: PowerFxTokenKind;
  value: string;
  start: number;
  end: number;
}

export interface PowerFxLexDiagnostic {
  message: string;
  start: number;
  end: number;
}

export interface PowerFxLexResult {
  tokens: PowerFxToken[];
  diagnostics: PowerFxLexDiagnostic[];
}

const TWO_CHAR_OPERATORS = new Set([
  "<=",
  ">=",
  "<>",
  "&&",
  "||",
  ":=",
  "=="
]);

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_\u0080-\uFFFF]/u.test(char);
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_\u0080-\uFFFF]/u.test(char);
}

function push(
  tokens: PowerFxToken[],
  kind: PowerFxTokenKind,
  value: string,
  start: number,
  end: number
): void {
  tokens.push({ kind, value, start, end });
}

export function lexPowerFx(input: string): PowerFxLexResult {
  const tokens: PowerFxToken[] = [];
  const diagnostics: PowerFxLexDiagnostic[] = [];

  function scanExpression(startIndex: number, stopAtInterpolationBrace = false): number {
    let index = startIndex;

    while (index < input.length) {
      const start = index;
      const char = input[index];
      const next = input[index + 1] ?? "";

      if (stopAtInterpolationBrace && char === "}") {
        return index;
      }

      if (/\s/u.test(char)) {
        index += 1;
        while (index < input.length && /\s/u.test(input[index])) index += 1;
        push(tokens, "whitespace", input.slice(start, index), start, index);
        continue;
      }

      if (char === "/" && next === "/") {
        index += 2;
        while (index < input.length && input[index] !== "\n") index += 1;
        push(tokens, "comment", input.slice(start, index), start, index);
        continue;
      }

      if (char === "/" && next === "*") {
        index += 2;
        let terminated = false;
        while (index < input.length) {
          if (input[index] === "*" && input[index + 1] === "/") {
            index += 2;
            terminated = true;
            break;
          }
          index += 1;
        }
        push(
          tokens,
          terminated ? "comment" : "error",
          input.slice(start, index),
          start,
          index
        );
        if (!terminated) {
          diagnostics.push({
            message: "Unterminated block comment.",
            start,
            end: index
          });
        }
        continue;
      }

      if (char === "$" && next === '"') {
        index = scanInterpolatedString(index);
        continue;
      }

      if (char === '"') {
        index += 1;
        let terminated = false;

        while (index < input.length) {
          if (input[index] === '"') {
            if (input[index + 1] === '"') {
              index += 2;
              continue;
            }
            index += 1;
            terminated = true;
            break;
          }
          index += 1;
        }

        push(
          tokens,
          terminated ? "string" : "error",
          input.slice(start, index),
          start,
          index
        );
        if (!terminated) {
          diagnostics.push({
            message: "Unterminated text literal.",
            start,
            end: index
          });
        }
        continue;
      }

      if (char === "'") {
        index += 1;
        let terminated = false;

        while (index < input.length) {
          if (input[index] === "'") {
            if (input[index + 1] === "'") {
              index += 2;
              continue;
            }
            index += 1;
            terminated = true;
            break;
          }
          index += 1;
        }

        push(
          tokens,
          terminated ? "quotedIdentifier" : "error",
          input.slice(start, index),
          start,
          index
        );
        if (!terminated) {
          diagnostics.push({
            message: "Unterminated quoted identifier.",
            start,
            end: index
          });
        }
        continue;
      }

      if (/\d/u.test(char) || (char === "." && /\d/u.test(next))) {
        index += 1;
        while (index < input.length && /[0-9]/u.test(input[index])) index += 1;

        if (input[index] === ".") {
          index += 1;
          while (index < input.length && /[0-9]/u.test(input[index])) index += 1;
        }

        if (/[eE]/u.test(input[index] ?? "")) {
          const exponentStart = index;
          index += 1;
          if (/[+-]/u.test(input[index] ?? "")) index += 1;
          const digitsStart = index;
          while (index < input.length && /[0-9]/u.test(input[index])) index += 1;
          if (digitsStart === index) index = exponentStart;
        }

        push(tokens, "number", input.slice(start, index), start, index);
        continue;
      }

      if (isIdentifierStart(char)) {
        index += 1;
        while (index < input.length && isIdentifierPart(input[index])) index += 1;
        push(tokens, "identifier", input.slice(start, index), start, index);
        continue;
      }

      const pair = char + next;
      if (TWO_CHAR_OPERATORS.has(pair)) {
        index += 2;
        push(tokens, "operator", pair, start, index);
        continue;
      }

      if ("+-*/^&=<>!".includes(char)) {
        index += 1;
        push(tokens, "operator", char, start, index);
        continue;
      }

      if ("()[]{}.,;:@%".includes(char)) {
        index += 1;
        push(tokens, "punctuation", char, start, index);
        continue;
      }

      index += 1;
      push(tokens, "error", char, start, index);
      diagnostics.push({
        message: "Unrecognized character '" + char + "'.",
        start,
        end: index
      });
    }

    return index;
  }

  function scanInterpolatedString(startIndex: number): number {
    const interpolationStart = startIndex;
    let index = startIndex + 2;
    let textStart = index;

    const flushText = (end: number): void => {
      if (end > textStart) {
        push(tokens, "interpolatedText", input.slice(textStart, end), textStart, end);
      }
    };

    while (index < input.length) {
      const char = input[index];
      const next = input[index + 1] ?? "";

      if (char === '"') {
        if (next === '"') {
          index += 2;
          continue;
        }

        flushText(index);
        return index + 1;
      }

      if (char === "{" && next === "{") {
        index += 2;
        continue;
      }

      if (char === "}" && next === "}") {
        index += 2;
        continue;
      }

      if (char === "{") {
        flushText(index);
        push(tokens, "punctuation", "{", index, index + 1);
        index = scanExpression(index + 1, true);

        if (input[index] !== "}") {
          diagnostics.push({
            message: "Unterminated formula island in interpolated string.",
            start: interpolationStart,
            end: index
          });
          push(
            tokens,
            "error",
            input.slice(interpolationStart, index),
            interpolationStart,
            index
          );
          return index;
        }

        push(tokens, "punctuation", "}", index, index + 1);
        index += 1;
        textStart = index;
        continue;
      }

      if (char === "}") {
        flushText(index);
        diagnostics.push({
          message: "Unescaped closing brace in interpolated string.",
          start: index,
          end: index + 1
        });
        push(tokens, "error", "}", index, index + 1);
        index += 1;
        textStart = index;
        continue;
      }

      index += 1;
    }

    flushText(index);
    diagnostics.push({
      message: "Unterminated interpolated string.",
      start: interpolationStart,
      end: index
    });
    push(
      tokens,
      "error",
      input.slice(interpolationStart, index),
      interpolationStart,
      index
    );
    return index;
  }

  scanExpression(0);
  return { tokens, diagnostics };
}

export function significantTokens(tokens: PowerFxToken[]): PowerFxToken[] {
  return tokens.filter(
    token =>
      token.kind !== "whitespace" &&
      token.kind !== "comment" &&
      token.kind !== "interpolatedText"
  );
}
