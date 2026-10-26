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

  it("resolves documented Int, Trunc and Mod semantics for layout arithmetic", () => {
    // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-round
    // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-mod
    expect(staticNumber("=Int(4.3)")).toBe(4);
    expect(staticNumber("=Trunc(4.3)")).toBe(4);
    expect(staticNumber("=Int(-4.3)")).toBe(-5);
    expect(staticNumber("=Trunc(-4.3)")).toBe(-4);
    expect(staticNumber("=Mod(25, 4)")).toBe(1);
    expect(staticNumber("=Mod(25, -4)")).toBe(-3);
    expect(staticNumber("=Mod(-25, 4)")).toBe(3);
    expect(staticNumber("=Mod(-25, -4)")).toBe(-1);
    expect(staticNumber("=Mod(-4, 2)")).toBe(0);
  });

  it("uses verified Int/Mod values in responsive Canvas formulas", () => {
    const formula = "=If(Mod(Int(App.Width / 360), 2) = 0, 48, 24)";
    expect(staticNumber(formula, { "App.Width": 390 })).toBe(24);
    expect(staticNumber(formula, { "App.Width": 768 })).toBe(48);
    expect(staticNumber(formula, { "App.Width": 1366 })).toBe(24);
    expect(staticNumber(formula, { "App.Width": Infinity })).toBeNull();
    expect(staticNumber(formula)).toBeNull();
  });

  it("does not guess invalid, SQL-dependent or qualified numeric functions", () => {
    expect(staticNumber("=Int()")).toBeNull();
    expect(staticNumber("=Int(2, 3)")).toBeNull();
    expect(staticNumber('=Trunc("4.3")')).toBeNull();
    expect(staticNumber("=Trunc(1, 0)")).toBeNull();
    expect(staticNumber("=Mod(25)")).toBeNull();
    expect(staticNumber("=Mod(25, 0)")).toBeNull();
    expect(staticNumber('=Mod(25, "4")')).toBeNull();
    expect(staticNumber("=Mod(varSqlWidth, 4)")).toBeNull();
    expect(staticNumber("=SQL.Mod(25, 4)")).toBeNull();
    expect(staticNumber("=Connector.Int(4.3)")).toBeNull();
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

  it("does not certify division by zero, overflow or nonfinite runtime symbols", () => {
    // Power Fx propagates numeric errors; JavaScript Infinity is not a
    // source-verified value or a valid condition for Canvas layout.
    // https://learn.microsoft.com/en-us/power-platform/power-fx/error-handling
    expect(evaluateStaticPowerFx("=1/0")).toBeNull();
    expect(evaluateStaticPowerFx("=0/0")).toBeNull();
    expect(staticBoolean("=1/0 > 10")).toBeNull();
    expect(staticNumber("=If(1/0 > 10, 120, 24)")).toBeNull();
    expect(staticBoolean("=(10^1000) > 0")).toBeNull();
    expect(staticNumber("=Max(10^1000, 100)")).toBeNull();
    expect(staticBoolean("=Max(10^1000, 100) > 100")).toBeNull();
    expect(staticBoolean("=varWidth > 100", { varWidth: Infinity })).toBeNull();
    // An unselected error branch does not invalidate a known If result.
    expect(staticNumber("=If(false, 1/0, 32)")).toBe(32);
    expect(staticNumber("=If(true, 24, 1/0)")).toBe(24);
    expect(staticNumber("=1/2")).toBe(0.5);
    expect(staticNumber("=10^2")).toBe(100);
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

  it("evaluates documented Not, And and Or functions without guessing runtime state", () => {
    // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-logicals
    expect(staticBoolean("=Not(false)")).toBe(true);
    expect(staticBoolean("=Not(true)")).toBe(false);
    expect(staticBoolean("=And(true, true, false)")).toBe(false);
    expect(staticBoolean("=Or(false, false, true)")).toBe(true);
    expect(staticBoolean("=And(false, varSqlPermission)")).toBe(false);
    expect(staticBoolean("=Or(true, varSqlPermission)")).toBe(true);
    expect(staticBoolean("=And(true, varSqlPermission)")).toBeNull();
    expect(staticBoolean("=Or(false, varSqlPermission)")).toBeNull();
    expect(staticBoolean("=Not(varSqlPermission)")).toBeNull();
    expect(staticNumber("=If(And(App.Width > 700, Not(false)), 40, 20)", symbols)).toBe(40);
  });

  it("rejects invalid logical function types, arity and extra Abs arguments", () => {
    expect(staticBoolean("=Not()")).toBeNull();
    expect(staticBoolean("=Not(true, false)")).toBeNull();
    expect(staticBoolean("=Not(1)")).toBeNull();
    expect(staticBoolean("=And(true)")).toBeNull();
    expect(staticBoolean("=Or(false)")).toBeNull();
    expect(staticBoolean("=And(false, 1)")).toBeNull();
    expect(staticBoolean('=Or(true, "yes")')).toBeNull();
    expect(staticBoolean("=SQL.Not(false)")).toBeNull();
    expect(staticNumber("=Abs(-4)")).toBe(4);
    expect(staticNumber("=Abs(4, 5)")).toBeNull();
    expect(staticNumber("=Abs()")).toBeNull();
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

describe("documented Power Fx Coalesce source-only semantics", () => {
  it("skips verified empty strings instead of returning the first empty argument", () => {
    expect(staticString('=Coalesce("", "Fallback")')).toBe("Fallback");
    expect(staticString('=Coalesce("", "", "Third")')).toBe("Third");
    expect(staticString('=Coalesce("First", "Second")')).toBe("First");
  });

  it("uses known responsive fallbacks without requiring external state", () => {
    const expression = '=Coalesce("", If(App.Width < 720, "Phone", "Desktop"))';
    expect(staticString(expression, { "App.Width": 390 })).toBe("Phone");
    expect(staticString(expression, { "App.Width": 1366 })).toBe("Desktop");
  });

  it("preserves zero and false as nonblank Power Fx values", () => {
    expect(staticNumber("=Coalesce(0, 12)")).toBe(0);
    expect(staticBoolean("=Coalesce(false, true)")).toBe(false);
  });

  it("does not infer blankness or permissions for unknown runtime arguments", () => {
    expect(staticString('=Coalesce(varSqlTitle, "Fallback")')).toBeNull();
    expect(staticString('=Coalesce("", varSqlTitle, "Fallback")')).toBeNull();
    expect(staticString('=Coalesce("Known", varSqlTitle)')).toBeNull();
  });

  it("does not turn all-empty, malformed or mixed-type formulas into text", () => {
    expect(staticString('=Coalesce("", "")')).toBeNull();
    expect(staticString("=Coalesce()")).toBeNull();
    expect(evaluateStaticPowerFx('=Coalesce("", 12)')).toBeNull();
    expect(evaluateStaticPowerFx('=Coalesce("Text", false)')).toBeNull();
  });
});
