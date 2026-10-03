import {
  lexPowerFx,
  significantTokens,
  type PowerFxLexDiagnostic,
  type PowerFxToken
} from "./lexer";

export interface PowerFxFacts {
  tokens: PowerFxToken[];
  diagnostics: PowerFxLexDiagnostic[];
  functions: string[];
  identifiers: string[];
  maxNesting: number;
  chainCount: number;
  delimiterError?: string;
}

function normalizedIdentifier(token: PowerFxToken): string {
  if (token.kind === "quotedIdentifier") {
    return token.value
      .slice(1, -1)
      .replaceAll("''", "'");
  }
  return token.value;
}

function collectQualifiedName(
  tokens: PowerFxToken[],
  endIndex: number
): { name: string; startIndex: number } | null {
  const end = tokens[endIndex];
  if (
    end.kind !== "identifier" &&
    end.kind !== "quotedIdentifier"
  ) {
    return null;
  }

  const segments = [normalizedIdentifier(end)];
  let cursor = endIndex - 1;

  while (
    cursor >= 1 &&
    tokens[cursor].value === "." &&
    (tokens[cursor - 1].kind === "identifier" ||
      tokens[cursor - 1].kind === "quotedIdentifier")
  ) {
    segments.unshift(normalizedIdentifier(tokens[cursor - 1]));
    cursor -= 2;
  }

  return {
    name: segments.join("."),
    startIndex: cursor + 1
  };
}

export function analyzePowerFx(formula: string): PowerFxFacts {
  const lexed = lexPowerFx(formula);
  const tokens = significantTokens(lexed.tokens);
  const functions: string[] = [];
  const identifiers = new Set<string>();
  const stack: string[] = [];
  const pairs: Record<string, string> = {
    ")": "(",
    "]": "[",
    "}": "{"
  };

  let maxNesting = 0;
  let chainCount = 0;
  let delimiterError: string | undefined;

  tokens.forEach((token, index) => {
    if (
      token.kind === "identifier" ||
      token.kind === "quotedIdentifier"
    ) {
      identifiers.add(normalizedIdentifier(token));
    }

    if ("([{".includes(token.value)) {
      stack.push(token.value);
      maxNesting = Math.max(maxNesting, stack.length);
    } else if (")]}".includes(token.value)) {
      const expected = pairs[token.value];
      if (stack.pop() !== expected && !delimiterError) {
        delimiterError =
          "Unbalanced delimiter near character " + String(token.start + 1) + ".";
      }
    }

    if (token.value === ";") chainCount += 1;

    if (token.value === "(" && index > 0) {
      const name = collectQualifiedName(tokens, index - 1);
      if (name) functions.push(name.name);
    }
  });

  if (!delimiterError && stack.length > 0) {
    delimiterError = "One or more delimiters are not closed.";
  }

  const firstLexError = lexed.diagnostics[0]?.message;
  if (!delimiterError && firstLexError) delimiterError = firstLexError;

  return {
    tokens,
    diagnostics: lexed.diagnostics,
    functions,
    identifiers: [...identifiers],
    maxNesting,
    chainCount,
    delimiterError
  };
}

export function countFunction(
  facts: PowerFxFacts,
  functionName: string
): number {
  const target = functionName.toLowerCase();
  return facts.functions.filter(name => {
    const lastSegment = name.split(".").at(-1) ?? name;
    return lastSegment.toLowerCase() === target;
  }).length;
}

export function hasFunction(
  facts: PowerFxFacts,
  functionName: string
): boolean {
  return countFunction(facts, functionName) > 0;
}

export function hasIdentifier(
  facts: PowerFxFacts,
  identifier: string
): boolean {
  const target = identifier.toLowerCase();
  return facts.identifiers.some(value => value.toLowerCase() === target);
}
