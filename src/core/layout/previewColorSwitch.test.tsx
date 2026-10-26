import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../../types/canvas";
import { CanvasVisualControl } from "../../components/CanvasVisualControl";
import { previewColorWithSymbols } from "./previewAppearance";

/** Synthetic source-only controls; no SQL rows or runtime permissions. */
function render(viewport: number, fill: string): string {
  const control: CanvasControl = {
    id: "synthetic-switch", name: "SyntheticSwitch",
    controlType: "Classic/Rectangle@2.3.0",
    properties: { Fill: fill, BorderColor: fill, BorderThickness: "=2" },
    children: [], zIndex: 1,
    sourceFile: "Src/SyntheticSwitch.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticSwitch",
    sourceFormat: "pa-yaml-v3"
  };
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={0} y={0} width={120} height={40}
    clipId="synthetic-switch-clip"
    simulationSymbols={{ "App.Width": viewport }}
  /></svg>);
}

describe("source-verifiable Power Fx Switch colors", () => {
  it.each([
    [390, "#ff0000"], [768, "#008000"], [1366, "#0000ff"]
  ] as const)("renders responsive Fill and BorderColor at %i px", (viewport, color) => {
    const formula = "=Switch(true, App.Width < 600, Color.Red, App.Width < 1024, Color.Green, Color.Blue)";
    const html = render(viewport, formula);
    expect(html).toContain(`fill="${color}"`);
    expect(html).toContain(`stroke="${color}"`);
    expect(html).not.toContain('data-preview-fill-state="unknown"');
    expect(html).not.toContain('data-preview-border-state="unknown"');
  });

  it("uses ordered matches, a default, and recursively typed color results", () => {
    expect(previewColorWithSymbols(
      "=Switch(768, 390, Color.Red, 768, If(false, Color.Blue, Color.Green), Color.Blue)"
    )).toBe("#008000");
    expect(previewColorWithSymbols(
      "=Switch(true, false, Color.Red, Color.Blue)"
    )).toBe("#0000ff");
    expect(previewColorWithSymbols(
      "=ColorFade(Switch(true, true, Color.Red, Color.Blue), 50%)"
    )).toBe("rgba(255,128,128,1)");
    expect(previewColorWithSymbols(
      "=Switch(true, true, ColorFade(Color.Blue, -50%), Color.Red)"
    )).toBe("rgba(0,0,128,1)");
  });

  it.each([
    "=Switch(varSqlRole, 1, Color.Red, Color.Blue)",
    "=Switch(true, varSqlPermission, Color.Red, Color.Blue)",
    "=Switch(true, false, Color.Red, varSqlPermission, Color.Green, Color.Blue)",
    "=Switch(true, false, Color.Red)",
    '=Switch(true, true, "Color.Red", Color.Blue)',
    "=Switch(true, true, Color.Red) & Color.Blue",
    "=Namespace.Switch(true, true, Color.Red, Color.Blue)",
    '=Switch("theme", "theme", Color.Red, Color.Blue)',
    "=Switch(true, 1, Color.Red, Color.Blue)",
    '=Switch(true, true, ColorValue("javascript:alert(1)"), Color.Blue)'
  ])("keeps unverified, malformed or runtime-dependent colors unknown: %s", formula => {
    expect(previewColorWithSymbols(formula)).toBeNull();
  });

  it("does not misrepresent runtime-only Switch colors as known paint", () => {
    const html = render(768, "=Switch(varSqlRole, 1, Color.Green, Color.Red)");
    expect(html).toContain('data-preview-fill-state="unknown"');
    expect(html).toContain('data-preview-border-state="unknown"');
  });
});
