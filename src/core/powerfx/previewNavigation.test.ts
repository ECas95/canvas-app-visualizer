import { describe, expect, it } from "vitest";
import type { CanvasScreen } from "../../types/canvas";
import {
  createPreviewNavigationState, previewNavigationSymbols, runPreviewNavigation,
  selectPreviewNavigationScreen, startPreviewNavigation
} from "./previewNavigation";

function screen(name: string, properties: Record<string, unknown> = {}): CanvasScreen {
  return {
    id: name, name, properties, children: [],
    sourceFile: "Src/Synthetic.pa.yaml", sourceFormat: "pa-yaml-v3"
  };
}

describe("safe multi-screen Canvas behavior preview", () => {
  it("runs OnVisible on every visit and preserves global/per-screen contexts", () => {
    const screens = [
      screen("Home", {
        OnVisible: "=Set(gVisits, Coalesce(gVisits, 0) + 1); UpdateContext({page: \"home\"})",
        OnHidden: "=Set(gLeftHome, true)"
      }),
      screen("Details", {
        OnVisible: "=UpdateContext({visits: Coalesce(visits, 0) + 1})",
        OnHidden: "=Set(gLeftDetails, true)"
      })
    ];
    const initial = startPreviewNavigation(screens, "Home", "=Set(gVisits, 0)");
    expect(initial.ok).toBe(true);
    expect(initial.state.globals.gVisits).toBe(1);
    expect(initial.state.contexts.Home.page).toBe("home");

    const navigated = runPreviewNavigation(screens, initial.state,
      "=Navigate(Details, ScreenTransition.Fade, { selectedId: 7, visits: 0 })");
    expect(navigated.ok).toBe(true);
    expect(navigated.state.screenId).toBe("Details");
    expect(navigated.state.globals.gLeftHome).toBe(true);
    expect(navigated.state.contexts.Details.selectedId).toBe(7);
    expect(navigated.state.contexts.Details.page).toBeUndefined();
    expect(navigated.state.contexts.Details.visits).toBe(1);
    expect(navigated.state.history).toEqual(["Home"]);
    expect(initial.state.globals.gLeftHome).toBeUndefined();

    const returned = runPreviewNavigation(screens, navigated.state, "=Back()");
    expect(returned.ok).toBe(true);
    expect(returned.state.screenId).toBe("Home");
    expect(returned.state.globals.gLeftDetails).toBe(true);
    expect(returned.state.globals.gVisits).toBe(2);
    expect(returned.state.contexts.Home.page).toBe("home");
    expect(returned.state.contexts.Details.selectedId).toBe(7);
  });

  it("runs different OnVisible patterns and safely skips source connector calls", () => {
    const screens = [
      screen("Home", {
        OnVisible: '=UpdateContext({ready: true}); ClearCollect(localRecords, SQLView); Set(gReady, true); If(ready, Set(gStatus, "loaded"), Set(gStatus, "idle"))'
      })
    ];
    const started = startPreviewNavigation(screens, "Home");
    expect(started.ok).toBe(true);
    expect(started.partial).toBe(true);
    expect(started.state.contexts.Home.ready).toBe(true);
    expect(started.state.globals.gReady).toBe(true);
    expect(started.state.globals.gStatus).toBe("loaded");
    expect(started.state.notices.join(" ")).toContain("ClearCollect");
    expect(started.state.events.join(" ")).not.toContain("SQLView");
  });

  it("rejects an OnSelect with unsupported effects atomically", () => {
    const screens = [screen("Home"), screen("Details")];
    const original = createPreviewNavigationState("Home");
    const result = runPreviewNavigation(screens, original,
      "=Set(gOk, true); Patch(SQLView, Defaults(SQLView), {Name: \"x\"}); Navigate(Details)");
    expect(result.ok).toBe(false);
    expect(result.state).toBe(original);
    expect(result.state.globals.gOk).toBeUndefined();
    expect(result.state.screenId).toBe("Home");
  });

  it("executes a conditional Navigate only if its condition is locally known", () => {
    const screens = [screen("Home"), screen("Details"), screen("Fallback")];
    let state = createPreviewNavigationState("Home");
    const initialized = runPreviewNavigation(screens, state, "=Set(goDetails, true)");
    state = initialized.state;
    const selected = runPreviewNavigation(screens, state,
      "=If(goDetails, Navigate(Details), Navigate(Fallback))");
    expect(selected.state.screenId).toBe("Details");
    expect(selected.ok).toBe(true);
    const unknown = runPreviewNavigation(screens, state,
      "=If(SQLView.IsReady, Navigate(Details), Navigate(Fallback))");
    expect(unknown.ok).toBe(false);
    expect(unknown.state.screenId).toBe("Home");
  });

  it("supports explorer navigation and restarts the destination OnVisible safely", () => {
    const screens = [
      screen("Home", { OnHidden: "=Set(wentAway, true)" }),
      screen("Settings", { OnVisible: "=UpdateContext({opened: true})" })
    ];
    const selected = selectPreviewNavigationScreen(screens, createPreviewNavigationState("Home"), "Settings");
    expect(selected.ok).toBe(true);
    expect(selected.state.screenId).toBe("Settings");
    expect(previewNavigationSymbols(selected.state).opened).toBe(true);
    expect(selected.state.globals.wentAway).toBe(true);
    expect(selected.state.history).toEqual([]);
  });

  it("runs a destination OnVisible exactly once when App.OnStart performs Navigate", () => {
    const screens = [
      screen("Home"),
      screen("Next", { OnVisible: "=Set(gEntered, gEntered + 1)" })
    ];
    const started = startPreviewNavigation(screens, "Home",
      "=Set(gEntered, 0); Navigate(Next)");
    expect(started.ok).toBe(true);
    expect(started.state.screenId).toBe("Next");
    expect(started.state.globals.gEntered).toBe(1);
  });

  it("blocks unknown screens, unsafe transition/context expressions and empty Back", () => {
    const screens = [screen("Home"), screen("Settings")];
    const initial = createPreviewNavigationState("Home");
    for (const source of [
      "=Navigate(Outside)", '=Navigate("https://example.com")',
      "=Navigate(Settings, SQL.GetTransition())",
      '=Navigate(Settings, ScreenTransition.None, { x: SQL.Fetch() })',
      "=Back()"
    ]) {
      const result = runPreviewNavigation(screens, initial, source);
      expect(result.ok).toBe(false);
      expect(result.state).toBe(initial);
    }
  });

  it("caps OnVisible navigation loops and never invokes the real Power Apps runtime", () => {
    const screens = [
      screen("First", { OnVisible: "=Navigate(Second)" }),
      screen("Second", { OnVisible: "=Navigate(First)" })
    ];
    const started = startPreviewNavigation(screens, "First");
    expect(started.partial).toBe(true);
    expect(started.state.notices.join(" ")).toMatch(/limit/i);
    expect(started.state.events.length).toBeLessThan(30);
  });
});
