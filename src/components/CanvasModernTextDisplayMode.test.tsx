import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { CanvasVisualControl } from "./CanvasVisualControl";

function render(
  controlType: string,
  displayMode: string,
  properties: Record<string, unknown> = {}
): string {
  const control: CanvasControl = {
    id: "synthetic-text", name: "SyntheticText", controlType,
    properties: {
      Text: '="Verified heading"',
      Fill: "=Color.Blue",
      DisabledFill: "=Color.Red",
      Color: "=Color.Green",
      DisabledColor: "=Color.Red",
      DisplayMode: displayMode,
      ...properties
    },
    children: [], sourceFile: "Src/Synthetic.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticText",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={10} y={20} width={180} height={48}
    clipId="modern-text-display-mode-test"
  /></svg>);
}

describe("ModernText legacy DisplayMode compatibility", () => {
  it("does not dim a modern Text control with ignored Disabled mode", () => {
    const html = render("ModernText@1.0.0", "=DisplayMode.Disabled");
    expect(html).toContain('opacity="1"');
    expect(html).toContain('fill="#0000ff"');
    expect(html).toContain('fill="#008000"');
    expect(html).not.toContain('opacity="0.66"');
    expect(html).not.toContain('fill="#ff0000"');
    expect(html).toContain("Verified heading");
  });

  it("does not invent an unknown permission for ignored runtime DisplayMode", () => {
    const html = render(
      "ModernText@1.0.0",
      "=If(varSqlAuthorized, DisplayMode.Edit, DisplayMode.Disabled)"
    );
    expect(html).toContain('opacity="1"');
    expect(html).not.toContain('data-preview-display-mode-state="unknown"');
    expect(html).not.toContain("interaction permissions are not verified");
    expect(html).not.toContain("varSqlAuthorized");
  });

  it("also recognizes the normalized ModernText control family", () => {
    const html = render("ModernText", "=DisplayMode.View");
    expect(html).toContain('opacity="1"');
    expect(html).not.toContain('opacity="0.86"');
  });

  it("preserves classic Label DisplayMode semantics", () => {
    const disabled = render("Classic/Label@2.5.1", "=DisplayMode.Disabled");
    const unknown = render("Classic/Label@2.5.1", "=varSqlMode");
    expect(disabled).toContain('opacity="0.66"');
    expect(disabled).toContain('fill="#ff0000"');
    expect(unknown).toContain('data-preview-display-mode-state="unknown"');
  });
});
