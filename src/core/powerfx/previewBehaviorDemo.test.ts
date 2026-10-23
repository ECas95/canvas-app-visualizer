import { describe, expect, it } from "vitest";
import { DEMO_FILES } from "../../sample/demo";
import { buildCanvasModel } from "../model/normalize";
import { staticBoolean, staticString } from "./staticEval";
import { previewCanRunOnSelect, previewColorWithSymbols, previewDisplayMode } from "../layout/previewAppearance";
import { simulatePreviewBehavior } from "./previewBehavior";

describe("end-to-end synthetic demo state", () => {
  it("lets OnVisible initialize a variable and OnSelect update dependent controls", () => {
    const model = buildCanvasModel(DEMO_FILES, "yaml", "Synthetic Preview");
    const screen = model.screens.find(item => item.name === "Home");
    expect(screen).toBeDefined();
    if (!screen) return;

    const toggle = screen.children.find(c => c.name === "ToggleDetailsButton");
    const hint = screen.children.find(c => c.name === "DetailsHint");
    const enabledButton = screen.children.find(c => c.name === "PreviewEnabledButton");
    expect(toggle).toBeDefined();
    expect(hint).toBeDefined();
    if (!toggle || !hint || !enabledButton) return;

    const init = simulatePreviewBehavior(screen.properties.OnVisible);
    expect(init.ok).toBe(true);
    expect(staticBoolean(hint.properties.Visible, init.variables)).toBe(false);
    expect(staticString(toggle.properties.Text, init.variables)).toBe("Show hint");
    expect(previewColorWithSymbols(toggle.properties.Fill, init.variables)).toBe("#808080");
    expect(previewDisplayMode(enabledButton.properties.DisplayMode, init.variables)).toBe("disabled");
    expect(previewCanRunOnSelect(enabledButton, init.variables)).toBe(false);

    const clicked = simulatePreviewBehavior(toggle.properties.OnSelect, init.variables);
    expect(clicked.ok).toBe(true);
    expect(staticBoolean(hint.properties.Visible, clicked.variables)).toBe(true);
    expect(staticString(toggle.properties.Text, clicked.variables)).toBe("Hide hint");
    expect(previewColorWithSymbols(toggle.properties.Fill, clicked.variables)).toBe("#008000");
    expect(previewDisplayMode(enabledButton.properties.DisplayMode, clicked.variables)).toBe("edit");
    expect(previewCanRunOnSelect(enabledButton, clicked.variables)).toBe(true);

    const again = simulatePreviewBehavior(toggle.properties.OnSelect, clicked.variables);
    expect(staticBoolean(hint.properties.Visible, again.variables)).toBe(false);
  });
});
