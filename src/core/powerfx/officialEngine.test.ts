import { describe, expect, it } from "vitest";
import { normalizeCanvasFormula } from "./officialEngine";

describe("normalizeCanvasFormula", () => {
  it("removes the Canvas source equals prefix", () => {
    expect(normalizeCanvasFormula("=If(true, 1, 2)")).toEqual({
      expression: "If(true, 1, 2)",
      offset: 1
    });
  });

  it("preserves leading whitespace and reports the source offset", () => {
    expect(normalizeCanvasFormula("  =Parent.Width - 24")).toEqual({
      expression: "  Parent.Width - 24",
      offset: 3
    });
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
