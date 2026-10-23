import { describe, expect, it } from "vitest";
import {
  previewScopedSymbols,
  simulateScopedPreviewBehavior,
  type PreviewScopedState
} from "./previewBehavior";

describe("scope-aware, local-only Power Fx preview", () => {
  it("stores Set globally and UpdateContext in the selected screen independently", () => {
    const result = simulateScopedPreviewBehavior(
      "=Set(shared, 1); UpdateContext({shared: 2})"
    );
    expect(result.ok).toBe(true);
    expect(result.state.globals).toEqual({ shared: 1 });
    expect(result.state.context).toEqual({ shared: 2 });
    expect(result.variables).toEqual({ shared: 2 });
  });

  it("uses context precedence case-insensitively without overwriting global state", () => {
    const initial: PreviewScopedState = {
      globals: { Shared: 10, other: true },
      context: { SHARED: 20 }
    };
    expect(previewScopedSymbols(initial)).toEqual({ other: true, SHARED: 20 });
    const result = simulateScopedPreviewBehavior("=Set(shared, shared + 1)", initial);
    expect(result.ok).toBe(true);
    expect(result.state.globals.Shared).toBe(21);
    expect(result.state.context.SHARED).toBe(20);
    expect(result.variables.SHARED).toBe(20);
    expect(initial.globals.Shared).toBe(10);
  });

  it("retains scope across separate events and resolves a pre-call snapshot", () => {
    const first = simulateScopedPreviewBehavior("=Set(counter, 5)");
    const second = simulateScopedPreviewBehavior(
      "=UpdateContext({counter: counter + 1, previous: counter})", first.state
    );
    expect(second.ok).toBe(true);
    expect(second.state.globals.counter).toBe(5);
    expect(second.state.context).toEqual({ counter: 6, previous: 5 });
    const third = simulateScopedPreviewBehavior(
      "=Set(counter, counter + 10)", second.state
    );
    expect(third.state.globals.counter).toBe(16);
    expect(third.variables.counter).toBe(6);
  });

  it("rolls back both scopes when any nested effect or unknown value appears", () => {
    const initial: PreviewScopedState = {
      globals: { globalFlag: false },
      context: { localFlag: true }
    };
    const result = simulateScopedPreviewBehavior(
      "=Set(globalFlag, true); UpdateContext({localFlag: false}); Set(blocked, If(true, 1, Patch(Source, Defaults(Source), {Id:1})))",
      initial
    );
    expect(result.ok).toBe(false);
    expect(result.state).toEqual(initial);
    expect(result.changes).toEqual([]);
    expect(result.variables).toEqual({ globalFlag: false, localFlag: true });
  });

  it("keeps screen state local and resettable, with no external operations", () => {
    const initial = simulateScopedPreviewBehavior("=UpdateContext({visible: true})");
    expect(initial.variables.visible).toBe(true);
    const reset = simulateScopedPreviewBehavior(
      "=Set(ready, true)", { globals: {}, context: {} }
    );
    expect(reset.variables).toEqual({ ready: true });
    expect(reset.state.context).toEqual({});
    expect(simulateScopedPreviewBehavior("=Navigate(OtherScreen)", reset.state).ok).toBe(false);
  });
});
