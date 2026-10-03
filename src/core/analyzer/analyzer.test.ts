import { describe, expect, it } from "vitest";
import { checkBalancedDelimiters } from "./analyzer";

describe("checkBalancedDelimiters", () => {
  it("accepts balanced Power Fx", () => {
    expect(checkBalancedDelimiters('=If(x > 1, "ok", "no")')).toBeNull();
  });

  it("ignores doubled quotes inside strings", () => {
    expect(checkBalancedDelimiters('="He said ""hello"""')).toBeNull();
  });

  it("detects missing delimiters", () => {
    expect(checkBalancedDelimiters("=If(x > 1, Patch(Data, { A: 1 })")).toContain(
      "not closed"
    );
  });
});
