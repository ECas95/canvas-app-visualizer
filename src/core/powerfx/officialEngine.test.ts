import { describe, expect, it } from "vitest";
import { normalizeCanvasFormula } from "./officialEngine";

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
