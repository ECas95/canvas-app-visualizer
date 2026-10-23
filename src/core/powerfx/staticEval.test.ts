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

  it("matches Microsoft Power Fx rounding for negative numbers and ties", () => {
    // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-round
    expect(staticNumber("=Round(-7.5, 0)")).toBe(-8);
    expect(staticNumber("=Round(-7.1, 0)")).toBe(-7);
    expect(staticNumber("=RoundUp(-7.1, 0)")).toBe(-8);
    expect(staticNumber("=RoundDown(-7.9, 0)")).toBe(-7);
    expect(staticNumber("=Round(7.5, 0)")).toBe(8);
    expect(staticNumber("=RoundUp(7.1, 0)")).toBe(8);
    expect(staticNumber("=RoundDown(7.9, 0)")).toBe(7);
  });

  it("rounds fractional and negative decimal places without binary drift", () => {
    expect(staticNumber("=Round(430.125, 2)")).toBe(430.13);
    expect(staticNumber("=Round(1.005, 2)")).toBe(1.01);
    expect(staticNumber("=Round(-1.005, 2)")).toBe(-1.01);
    expect(staticNumber("=Round(450, -2)")).toBe(500);
    expect(staticNumber("=Round(-450, -2)")).toBe(-500);
    expect(staticNumber("=RoundDown(-450, -2)")).toBe(-400);
    expect(staticNumber("=RoundUp(-430.123, -2)")).toBe(-500);
  });

  it("does not guess invalid or unsafe rounding arguments", () => {
    expect(staticNumber("=Round(2.5)")).toBeNull();
    expect(staticNumber("=Round(2.5, 0, 1)")).toBeNull();
    expect(staticNumber('=Round(2.5, "0")')).toBeNull();
    expect(staticNumber("=Round(2.5, 0.5)")).toBeNull();
    expect(staticNumber("=Round(2.5, 20)")).toBeNull();
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

  it("does not treat qualified connector or namespace calls as pure built-ins", () => {
    // Namespaced functions are not interchangeable with Power Fx built-ins.
    expect(evaluateStaticPowerFx("=SQL.If(true, 1, 2)")).toBeNull();
    expect(evaluateStaticPowerFx("=Connector.Max(10, 20)")).toBeNull();
    expect(evaluateStaticPowerFx("=Service.Abs(-3)")).toBeNull();
    // Unqualified, supported pure functions still resolve normally.
    expect(staticNumber("=Max(10, 20)")).toBe(20);
    expect(staticNumber("=Abs(-3)")).toBe(3);
  });

  it("handles multi-condition If in documented first-match order", () => {
    expect(staticString('=If(false, "first", true, "second", "default")')).toBe("second");
    expect(staticString('=If(false, "first", false, "second", "default")')).toBe("default");
    expect(staticString('=If(true, "first", true, "second", "default")')).toBe("first");
    expect(staticString('=If(false, "first", true, "second")')).toBe("second");
  });

  it("keeps unresolved conditions and omitted defaults unknown", () => {
    expect(staticString('=If(false, "first", varUnknown, "second", "default")')).toBeNull();
    expect(staticString('=If(false, "first", false, "second")')).toBeNull();
    expect(staticBoolean("=If(false, true)")).toBeNull();
    expect(staticString('=If(true, "first", varUnknown, "second")')).toBe("first");
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
