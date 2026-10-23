import { describe, expect, it } from "vitest";
import type { Finding } from "../../types/canvas";
import { mergeOfficialPowerFxFindings, normalizeCanvasFormula } from "./officialEngine";

describe("normalizeCanvasFormula", () => {
  it("removes the Canvas source equals prefix", () => {
    expect(normalizeCanvasFormula("=If(true, 1, 2)")).toEqual({
      expression: "If(true, 1, 2)",
      offset: 1
    });
  });

  it("strips leading whitespace and maps parser spans back to Canvas source", () => {
    const formula = "  =Parent.Width - 24";
    const normalized = normalizeCanvasFormula(formula);
    expect(normalized).toEqual({
      expression: "Parent.Width - 24",
      offset: 3
    });
    expect(formula.slice(normalized.offset, normalized.offset + 6)).toBe(
      normalized.expression.slice(0, 6)
    );
  });

  it("handles multiline indentation before the serialized equals prefix", () => {
    const formula = "\n  =If(true, 1, 2)";
    const normalized = normalizeCanvasFormula(formula);
    expect(normalized).toEqual({ expression: "If(true, 1, 2)", offset: 4 });
    expect(formula.slice(normalized.offset)).toBe(normalized.expression);
  });

  it("leaves expressions without a Canvas source prefix unchanged", () => {
    expect(normalizeCanvasFormula("If(true, 1, 2)")).toEqual({
      expression: "If(true, 1, 2)",
      offset: 0
    });
  });

  it("leaves blank text unchanged", () => {
    expect(normalizeCanvasFormula("   ")).toEqual({
      expression: "   ",
      offset: 0
    });
  });
});


describe("mergeOfficialPowerFxFindings", () => {
  const lexical: Finding = {
    id: "lexical",
    ruleId: "powerfx.syntax.lexical-structure",
    severity: "error",
    category: "syntax",
    title: "Provisional syntax",
    message: "Unbalanced formula",
    confidence: "high"
  };
  const performance: Finding = {
    ...lexical,
    id: "performance",
    ruleId: "powerfx.performance.repeated-lookup",
    severity: "warning",
    category: "performance"
  };
  const official: Finding = {
    ...lexical,
    id: "official",
    ruleId: "powerfx.official.syntax",
    title: "Official syntax"
  };

  it("removes only the provisional lexical finding when the official parser is ready", () => {
    expect(mergeOfficialPowerFxFindings(
      [lexical, performance],
      [official],
      true
    )).toEqual([official, performance]);
  });

  it("preserves the lexical fallback when the official parser is loading or unavailable", () => {
    expect(mergeOfficialPowerFxFindings(
      [performance, lexical],
      [],
      false
    )).toEqual([lexical, performance]);
  });

  it("does not mutate static findings and retains other syntax rules", () => {
    const structural: Finding = {
      ...lexical,
      id: "source",
      ruleId: "source.pa-yaml-v3-schema"
    };
    const original = [performance, structural, lexical];
    expect(mergeOfficialPowerFxFindings(original, [], true)).toEqual([
      structural,
      performance
    ]);
    expect(original).toEqual([performance, structural, lexical]);
  });
});
