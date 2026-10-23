import { describe, expect, it } from "vitest";
import { simulatePreviewBehavior } from "./previewBehavior";

describe("safe local Power Fx behavior preview", () => {
  it("applies simple Set and UpdateContext with sequential local state", () => {
    const res = simulatePreviewBehavior(
      '=Set(varShown, true); UpdateContext({locOpen: varShown, clicks: 1})'
    );
    expect(res.ok).toBe(true);
    expect(res.variables).toEqual({ varShown: true, locOpen: true, clicks: 1 });
    expect(res.changes).toEqual(["varShown", "locOpen", "clicks"]);
  });

  it("evaluates every UpdateContext record field against the pre-call snapshot", () => {
    // The first field must not change the value read by the second field.
    const result = simulatePreviewBehavior(
      "=UpdateContext({first: 2, second: first + 1})",
      { first: 10, second: 0 }
    );
    expect(result.ok).toBe(true);
    expect(result.variables).toEqual({ first: 2, second: 11 });
    expect(result.changes).toEqual(["first", "second"]);
  });

  it("does not resolve a new field from another field in the same record", () => {
    const initial = { flag: false };
    const result = simulatePreviewBehavior(
      "=Set(flag, true); UpdateContext({newField: 1, derived: newField + 1})",
      initial
    );
    expect(result.ok).toBe(false);
    expect(result.variables).toEqual(initial);
    expect(result.changes).toEqual([]);
  });

  it("rejects duplicate UpdateContext field names case-insensitively", () => {
    const initial = { count: 9 };
    const result = simulatePreviewBehavior(
      "=UpdateContext({count: 1, COUNT: 2})", initial
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Duplicate UpdateContext field");
    expect(result.variables).toEqual(initial);
    expect(result.changes).toEqual([]);
  });

  it("supports repeated toggles and If with known state", () => {
    const first = simulatePreviewBehavior("=Set(varOpen, !varOpen)", { varOpen: false });
    expect(first.ok).toBe(true);
    expect(first.variables.varOpen).toBe(true);
    const next = simulatePreviewBehavior('=Set(varStatus, If(varOpen, "Open", "Closed"))', first.variables);
    expect(next.variables.varStatus).toBe("Open");
  });

  it("uses the matching branch of multi-condition If inside local Set", () => {
    const result = simulatePreviewBehavior(
      '=Set(varLabel, If(false, "wrong", true, "correct", "fallback"))'
    );
    expect(result.ok).toBe(true);
    expect(result.variables.varLabel).toBe("correct");

    const unresolved = simulatePreviewBehavior(
      '=Set(varLabel, If(false, "wrong", varUnknown, "other", "fallback"))',
      { varLabel: "original" }
    );
    expect(unresolved.ok).toBe(false);
    expect(unresolved.variables.varLabel).toBe("original");
  });

  it("keeps values case insensitive like Power Fx variables", () => {
    const res = simulatePreviewBehavior("=Set(VAROPEN, true)", { varOpen: false });
    expect(res.variables).toEqual({ varOpen: true });
  });

  it("atomically blocks entire mixed formulas if one action is unsupported", () => {
    const initial = { varOpen: false };
    const res = simulatePreviewBehavior(
      '=Set(varOpen, true); Patch(SQLTable, Defaults(SQLTable), {Name:"X"})', initial
    );
    expect(res.ok).toBe(false);
    expect(res.message).toContain("Blocked behavior: Patch");
    expect(res.variables).toEqual(initial);
    expect(res.changes).toEqual([]);
  });

  it("rejects unsupported navigation, connectors, and unknown source values", () => {
    expect(simulatePreviewBehavior("=Navigate(scrOther)").ok).toBe(false);
    expect(simulatePreviewBehavior("=ClearCollect(colApps, SQLView)").ok).toBe(false);
    expect(simulatePreviewBehavior("=Set(varAllowed, LookUp(SQLView, ID=1))").ok).toBe(false);
    expect(simulatePreviewBehavior("=Set(varAllowed, missingSymbol)").ok).toBe(false);
  });

  it("rejects connector-qualified lookalikes inside otherwise allowed Set", () => {
    const initial = { varAllowed: false };
    const res = simulatePreviewBehavior(
      "=Set(varAllowed, Connector.If(true, true, false))", initial
    );
    expect(res.ok).toBe(false);
    expect(res.variables).toEqual(initial);
    expect(res.changes).toEqual([]);
  });

  it("rejects disallowed calls in dead If branches without executing anything", () => {
    const initial = { ready: false, count: 7 };
    const formulas = [
      '=Set(ready, If(true, true, Patch(Source, Defaults(Source), {ID: 1})))',
      '=Set(ready, If(true, true, Navigate(OtherScreen)))',
      '=Set(ready, If(true, true, Connector.Max(1, 2)))',
      '=Set(ready, If(true, true, User().Email))',
      '=Set(ready, If(true, true, UnknownFunction(1)))'
    ];
    for (const formula of formulas) {
      const result = simulatePreviewBehavior(formula, initial);
      expect(result.ok, formula).toBe(false);
      expect(result.message).toContain("Unsupported nested function");
      expect(result.variables).toEqual(initial);
      expect(result.changes).toEqual([]);
    }
  });

  it("rolls back earlier actions when a later dead branch contains a blocked call", () => {
    const initial = { ready: false };
    const result = simulatePreviewBehavior(
      '=Set(ready, true); UpdateContext({count: If(true, 1, ClearCollect(x, y))})',
      initial
    );
    expect(result.ok).toBe(false);
    expect(result.variables).toEqual(initial);
    expect(result.changes).toEqual([]);
  });

  it("still allows nested pure functions and parenthesized expressions", () => {
    const result = simulatePreviewBehavior(
      '=Set(count, If(true, RoundDown(Max(2, 10 / 3), 0), (1 + 2)))'
    );
    expect(result.ok).toBe(true);
    expect(result.variables.count).toBe(3);
  });

  it("never runs a partial UpdateContext record", () => {
    const res = simulatePreviewBehavior(
      "=UpdateContext({known: true, unsupported: SQLView.Value})",
      { known: false }
    );
    expect(res.ok).toBe(false);
    expect(res.variables.known).toBe(false);
  });

  it("rejects reserved names and nested side-effect attempts", () => {
    expect(simulatePreviewBehavior("=Set(App, 3)").ok).toBe(false);
    expect(simulatePreviewBehavior("=Set(varX, Set(varY, true))").ok).toBe(false);
    expect(simulatePreviewBehavior("=Set(varX, true);;Set(varY, true)").ok).toBe(false);
  });

  it("never changes caller's original variable record", () => {
    const initial = { varFlag: false };
    const res = simulatePreviewBehavior("=Set(varFlag, true)", initial);
    expect(initial.varFlag).toBe(false);
    expect(res.variables.varFlag).toBe(true);
  });
});
