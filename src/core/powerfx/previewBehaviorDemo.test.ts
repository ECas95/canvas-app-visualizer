import { describe, expect, it } from "vitest";
import { DEMO_FILES } from "../../sample/demo";
import { buildCanvasModel } from "../model/normalize";
import { staticBoolean, staticString } from "./staticEval";
import { simulatePreviewBehavior } from "./previewBehavior";

describe("end-to-end synthetic demo state", () => {
  it("lets OnVisible initialize a variable and OnSelect update dependent controls", () => {
    const model = buildCanvasModel(DEMO_FILES, "yaml", "Synthetic Preview");
    const screen = model.screens.find(item => item.name === "Home");
    expect(screen).toBeDefined();
    if (!screen) return;

    const toggle = screen.children.find(c => c.name === "ToggleDetailsButton");
    const hint = screen.children.find(c => c.name === "DetailsHint");
    expect(toggle).toBeDefined();
    expect(hint).toBeDefined();
    if (!toggle || !hint) return;

    const init = simulatePreviewBehavior(screen.properties.OnVisible);
    expect(init.ok).toBe(true);
    expect(staticBoolean(hint.properties.Visible, init.variables)).toBe(false);
    expect(staticString(toggle.properties.Text, init.variables)).toBe("Show hint");

    const clicked = simulatePreviewBehavior(toggle.properties.OnSelect, init.variables);
    expect(clicked.ok).toBe(true);
    expect(staticBoolean(hint.properties.Visible, clicked.variables)).toBe(true);
    expect(staticString(toggle.properties.Text, clicked.variables)).toBe("Hide hint");

    const again = simulatePreviewBehavior(toggle.properties.OnSelect, clicked.variables);
    expect(staticBoolean(hint.properties.Visible, again.variables)).toBe(false);
  });
});
