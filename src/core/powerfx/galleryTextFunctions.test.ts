import { describe, expect, it } from "vitest";
import { staticString } from "./staticEval";

describe("bounded Power Fx ThisItem scalar text functions", () => {
  const symbols = { "ThisItem.Name": "Operations Team", "ThisItem.Code": "CA-7 CA-7 CA-7" };

  it("supports documented Left, Right and one-based Mid with known local records", () => {
    expect(staticString("=Left(ThisItem.Name, 4)", symbols)).toBe("Oper");
    expect(staticString("=Right(ThisItem.Name, 4)", symbols)).toBe("Team");
    expect(staticString("=Mid(ThisItem.Name, 12, 4)", symbols)).toBe("Team");
    expect(staticString("=Mid(ThisItem.Name, 12)", symbols)).toBe("Team");
    expect(staticString("=Left(ThisItem.Name, 500)", symbols)).toBe("Operations Team");
    expect(staticString("=Left(ThisItem.Name, 0)", symbols)).toBe("");
  });

  it("supports per-record Substitute and safe text concatenation", () => {
    expect(staticString('=Substitute(ThisItem.Code, "CA-7", "JOB")', symbols))
      .toBe("JOB JOB JOB");
    expect(staticString('=Substitute(ThisItem.Code, "CA-7", "JOB", 2)', symbols))
      .toBe("CA-7 JOB CA-7");
    expect(staticString('=Concatenate("Module: ", Left(ThisItem.Name, 10))', symbols))
      .toBe("Module: Operations");
    expect(staticString('=If(StartsWith(ThisItem.Name, "Oper"), Right(ThisItem.Name, 4), "Other")', symbols))
      .toBe("Team");
  });

  it("keeps unknown runtime and unsupported type-dependent values unresolved", () => {
    for (const expression of [
      "=Left(ThisItem.Missing, 3)", "=Right(SQL.Name, 3)",
      '=Substitute(ThisItem.Missing, "a", "b")',
      "=Mid(ThisItem.Name, -2, 3)", "=Mid(ThisItem.Name, 0, 3)",
      "=Right(ThisItem.Name, 1.5)", "=Left(ThisItem.Name)",
      '=Substitute(ThisItem.Code, "", "x")',
      '=Substitute(ThisItem.Code, "CA-7", "JOB", 0)',
      '=Concatenate(ThisItem.Name, SQL.GetResult())',
      '=Concatenate("abc", 123)',
      '=Left("café", 2)',
      '=Connector.Left("Hello", 1)'
    ]) expect(staticString(expression, symbols)).toBeNull();
  });

  it("limits input and output lengths to protect large apps", () => {
    expect(staticString('=Concatenate("' + "x".repeat(4096) + '", "y")')).toBeNull();
    expect(staticString('=Left(ThisItem.LongName, 2)', { "ThisItem.LongName": "x".repeat(4097) }))
      .toBeNull();
  });
});
