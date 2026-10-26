import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../../types/canvas";
import { CanvasVisualControl } from "../../components/CanvasVisualControl";
import { previewColorWithSymbols } from "./previewAppearance";

/** Synthetic Canvas source only; never assumes SQL rows or runtime permissions.
 * https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-colors
 */
function render(properties: Record<string, unknown>, viewport = 768): string {
  const control: CanvasControl = {
    id: "synthetic-colorfade", name: "SyntheticColorFade",
    controlType: "Classic/Rectangle@2.3.0", properties, children: [],
    sourceFile: "Src/SyntheticColorFade.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticColorFade",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={0} y={0} width={120} height={40}
    clipId="synthetic-colorfade-clip"
    simulationSymbols={{ "App.Width": viewport }}
  /></svg>);
}

describe("verified Power Fx ColorFade in Canvas source preview", () => {
  it("lightens and darkens supported literal colors and percentages", () => {
    expect(previewColorWithSymbols("=ColorFade(Color.Red, 50%)"))
      .toBe("rgba(255,128,128,1)");
    expect(previewColorWithSymbols("=ColorFade(Color.Blue, -50%)"))
      .toBe("rgba(0,0,128,1)");
    expect(previewColorWithSymbols("=ColorFade(Color.Red, 0)"))
      .toBe("#ff0000");
    expect(previewColorWithSymbols("=ColorFade(Color.Green, -100%)"))
      .toBe("rgba(0,0,0,1)");
    expect(previewColorWithSymbols("=ColorFade(Color.Green, 100%)"))
      .toBe("rgba(255,255,255,1)");
  });

  it("preserves the alpha channel from RGBA, transparent, and 8-digit ColorValue", () => {
    expect(previewColorWithSymbols("=ColorFade(RGBA(100,150,200,25%), 50%)"))
      .toBe("rgba(178,203,228,0.25)");
    expect(previewColorWithSymbols("=ColorFade(Color.Transparent, 100%)"))
      .toBe("rgba(255,255,255,0)");
    expect(previewColorWithSymbols('=ColorFade(ColorValue("#20406080"), -50%)'))
      .toBe("rgba(16,32,48,0.5019607843137255)");
  });

  it("resolves nested If and comments without assuming unselected branches", () => {
    expect(previewColorWithSymbols(
      "=If(true, ColorFade(/* chosen */ Color.Red, 50%), Color.Blue)"
    )).toBe("rgba(255,128,128,1)");
    expect(previewColorWithSymbols(
      "=ColorFade(If(false, Color.Red, Color.Blue), -50%)"
    )).toBe("rgba(0,0,128,1)");
  });

  it.each([
    "=ColorFade(Color.Red, 101%)",
    "=ColorFade(Color.Red, -101%)",
    "=ColorFade(Color.Red, varSqlFade)",
    "=ColorFade(varSqlColor, 50%)",
    "=ColorFade(If(varPermission, Color.Red, Color.Blue), 50%)",
    "=ColorFade(Color.Red, Set(varFade, 0.5))",
    "=ColorFade(Color.Red, 50%, Color.Blue)",
    "=ColorFade(Color.Red, 50%) & Color.Blue",
    "=Namespace.ColorFade(Color.Red, 50%)",
    '="ColorFade(Color.Red, 50%)"'
  ])("does not certify unsupported or runtime-dependent color formula: %s", formula => {
    expect(previewColorWithSymbols(formula)).toBeNull();
  });

  it.each([
    [390, "rgba(255,128,128,1)"],
    [768, "rgba(0,0,128,1)"],
    [1366, "rgba(0,0,128,1)"]
  ] as const)("uses known responsive symbols for paint at %i px", (viewport, color) => {
    const html = render({
      Fill: "=If(App.Width < 720, ColorFade(Color.Red, 50%), ColorFade(Color.Blue, -50%))",
      BorderColor: "=ColorFade(Color.Blue, -50%)",
      BorderThickness: "=2"
    }, viewport);
    expect(html).toContain(`fill="${color}"`);
    expect(html).toContain('stroke="rgba(0,0,128,1)"');
    expect(html).not.toContain('data-preview-fill-state="unknown"');
    expect(html).not.toContain('data-preview-border-state="unknown"');
  });

  it("marks runtime-only colors unknown rather than fabricating a verified fill", () => {
    const html = render({ Fill: "=ColorFade(varSqlFill, 50%)" });
    expect(html).toContain('data-preview-fill-state="unknown"');
    expect(html).not.toContain('fill="rgba(255,128,128,1)"');
  });
});
