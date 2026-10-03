import { describe, expect, it } from "vitest";
import { analyzePowerFx, countFunction, hasIdentifier } from "./facts";
import { lexPowerFx, significantTokens } from "./lexer";

describe("Power Fx lexer", () => {
  it("does not treat function names inside strings or comments as calls", () => {
    const facts = analyzePowerFx(
      '=With({x: "LookUp(Data, true)"}, // Patch(Data)\n LookUp(Data, ID = 1))'
    );

    expect(countFunction(facts, "LookUp")).toBe(1);
    expect(countFunction(facts, "Patch")).toBe(0);
    expect(countFunction(facts, "With")).toBe(1);
  });

  it("supports doubled quotes and quoted identifiers", () => {
    const result = lexPowerFx(
      '="He said ""hello""" & \'Sales Team\'.DisplayName'
    );
    const tokens = significantTokens(result.tokens);

    expect(result.diagnostics).toEqual([]);
    expect(tokens.some(token => token.kind === "quotedIdentifier")).toBe(true);
  });

  it("recognizes qualified component function calls", () => {
    const facts = analyzePowerFx(
      "=GeoUtils_1.TwoPoints(txtLat1.Text, txtLng1.Text, txtLat2.Text, txtLng2.Text).distance"
    );

    expect(facts.functions).toContain("GeoUtils_1.TwoPoints");
  });

  it("recognizes record and table delimiters without lexical errors", () => {
    const facts = analyzePowerFx(
      '=With({Status: "Open"}, Filter([1,2,3], Value > 1))'
    );

    expect(facts.delimiterError).toBeUndefined();
    expect(countFunction(facts, "With")).toBe(1);
    expect(countFunction(facts, "Filter")).toBe(1);
  });

  it("recognizes in and exactin as identifiers for static delegation review", () => {
    const facts = analyzePowerFx(
      '=Filter(Accounts, "a" in Name || "B" exactin Code)'
    );

    expect(hasIdentifier(facts, "in")).toBe(true);
    expect(hasIdentifier(facts, "exactin")).toBe(true);
  });

  it("reports unterminated text, identifier, and block comment tokens", () => {
    expect(analyzePowerFx('="hello').delimiterError).toContain(
      "Unterminated text literal"
    );
    expect(analyzePowerFx("='Account Name").delimiterError).toContain(
      "Unterminated quoted identifier"
    );
    expect(analyzePowerFx("=1 + /* comment").delimiterError).toContain(
      "Unterminated block comment"
    );
  });

  it("tracks function and delimiter nesting as structural facts", () => {
    const facts = analyzePowerFx(
      "=If(true, With({x: 1}, Sum([x, 2], Value)), Blank())"
    );

    expect(facts.functions).toEqual(
      expect.arrayContaining(["If", "With", "Sum", "Blank"])
    );
    expect(facts.maxNesting).toBeGreaterThanOrEqual(3);
  });
  it("lexes formulas inside interpolated strings without treating literal text as code", () => {
    const facts = analyzePowerFx(
      '=With({value: 42}, $"LookUp(Data) is text; result={Text(value)}")'
    );

    expect(facts.delimiterError).toBeUndefined();
    expect(countFunction(facts, "With")).toBe(1);
    expect(countFunction(facts, "Text")).toBe(1);
    expect(countFunction(facts, "LookUp")).toBe(0);
    expect(hasIdentifier(facts, "value")).toBe(true);
  });

  it("supports escaped braces and nested string interpolation", () => {
    const formula =
      '=$"literal {{brace}} {Coalesce(Name, $"user={UserName}")}"';
    const facts = analyzePowerFx(formula);

    expect(facts.delimiterError).toBeUndefined();
    expect(countFunction(facts, "Coalesce")).toBe(1);
    expect(hasIdentifier(facts, "UserName")).toBe(true);
  });

  it("parses the data-uri interpolation shape observed in current Microsoft Canvas source", () => {
    const facts = analyzePowerFx(
      '=$"data:application/octet-stream;base64,{locAttachmentData}"'
    );

    expect(facts.delimiterError).toBeUndefined();
    expect(hasIdentifier(facts, "locAttachmentData")).toBe(true);
    expect(facts.diagnostics).toEqual([]);
  });

  it("reports malformed interpolation islands", () => {
    const facts = analyzePowerFx('=$"value={If(true, 1, 2)"');
    expect(facts.delimiterError).toContain("Unterminated");
  });

});
