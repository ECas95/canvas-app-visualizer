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

  it("supports repeated toggles and If with known state", () => {
    const first = simulatePreviewBehavior("=Set(varOpen, !varOpen)", { varOpen: false });
    expect(first.ok).toBe(true);
    expect(first.variables.varOpen).toBe(true);
    const next = simulatePreviewBehavior('=Set(varStatus, If(varOpen, "Open", "Closed"))', first.variables);
    expect(next.variables.varStatus).toBe("Open");
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
