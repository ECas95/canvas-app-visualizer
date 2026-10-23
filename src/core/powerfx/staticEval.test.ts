import { describe, expect, it } from "vitest";
import {
  evaluateStaticPowerFx,
  staticBoolean,
  staticNumber,
  staticString
} from "./staticEval";

describe("static Power Fx evaluator", () => {
  const symbols = {
    "Parent.Width": 900,
    "Parent.Height": 600,
    "Self.Width": 300,
    "App.Width": 1366
  };

  it("evaluates arithmetic using known Canvas geometry symbols", () => {
    expect(
      staticNumber("=(Parent.Width - Self.Width) / 2", symbols)
    ).toBe(300);
  });

  it("evaluates common numeric pure functions", () => {
    expect(staticNumber("=Max(120, Parent.Width / 3)", symbols)).toBe(300);
    expect(staticNumber("=RoundDown(19.99, 0)", symbols)).toBe(19);
  });

  it("evaluates responsive If formulas when the condition is known", () => {
    expect(
      staticString(
        "=If(Parent.Width < 640, LayoutDirection.Vertical, LayoutDirection.Horizontal)",
        symbols
      )
    ).toBe("LayoutDirection.Horizontal");
  });

  it("evaluates booleans and comparisons", () => {
    expect(
      staticBoolean("=Parent.Width >= 640 && true", symbols)
    ).toBe(true);
  });

  it("implements Power Fx postfix percent semantics", () => {
    expect(staticNumber("=20%")).toBeCloseTo(0.2);
    expect(staticNumber("=-15%")).toBeCloseTo(-0.15);
    expect(staticNumber("=100 * 20%")).toBeCloseTo(20);
  });

  it("resolves known false AND unknown without guessing the variable", () => {
    expect(staticBoolean("=App.Width < 720 && varIsAdmin", symbols)).toBe(false);
    expect(staticNumber("=If(App.Width < 720 && varIsAdmin, 48, 0)", symbols)).toBe(0);
    expect(staticBoolean("=App.Width > 720 && varIsAdmin", symbols)).toBeNull();
    expect(staticBoolean("=true || varIsAdmin", symbols)).toBe(true);
    expect(staticBoolean("=false || varIsAdmin", symbols)).toBeNull();
  });

  it("keeps unsupported selected branches unknown but selects known branches", () => {
    expect(staticNumber("=If(App.Width > 700, 16, dynamicSpacing)", symbols)).toBe(16);
    expect(staticNumber("=If(App.Width > 2000, 16, dynamicSpacing)", symbols)).toBeNull();
    expect(staticNumber("=If(varCondition, 8, 16)", symbols)).toBeNull();
  });

  it("does not invent values for unknown runtime symbols", () => {
    expect(
      evaluateStaticPowerFx("=User().Email", { symbols })
    ).toBeNull();
    expect(
      staticNumber("=Header.Height + 10", symbols)
    ).toBeNull();
  });
});
