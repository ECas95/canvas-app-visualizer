import { describe, expect, it } from "vitest";
import { literalNumber, literalText, rgba } from "./layout";

describe("layout literal helpers", () => {
  it("parses numeric formulas", () => {
    expect(literalNumber("=40")).toBe(40);
    expect(literalNumber("=Parent.Width")).toBeNull();
  });

  it("parses string formulas", () => {
    expect(literalText('="Hello"')).toBe("Hello");
  });

  it("parses RGBA formulas", () => {
    expect(rgba("=RGBA(1, 2, 3, 0.5)")).toBe("rgba(1,2,3,0.5)");
  });
});
