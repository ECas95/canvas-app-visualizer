import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { CanvasVisualControl } from "./CanvasVisualControl";
import { previewFontSize } from "../core/layout/previewAppearance";

function label(properties: Record<string, unknown>): CanvasControl {
  return {
    id: "font-fixture", name: "FontFixture",
    controlType: "Classic/Label@2.5.1", properties, children: [],
    sourceFile: "Src/GenericFont.pa.yaml", sourcePath: "Screens/Generic/FontFixture",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
}

function render(properties: Record<string, unknown>, width = 390): string {
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={label(properties)} x={0} y={0} width={240} height={64}
    clipId="font-fixture-clip" simulationSymbols={{ "App.Width": width }}
  /></svg>);
}

describe("source-only font certainty", () => {
  it("keeps explicit Size precedence when the source needs runtime data", () => {
    const control = label({
      Text: '="Example"', Size: "=varSqlFontSize", FontSize: "=22",
      Font: "=varSqlFont"
    });
    // FontSize is not a safe substitute for an unresolved explicit Size.
    expect(previewFontSize(control, { "App.Width": 390 })).toBe(14);
    const html = render(control.properties);
    expect(html).toContain('data-preview-font-state="unknown"');
    expect(html).toContain('data-preview-font-size-state="unknown"');
    expect(html).toContain('font-size="14"');
    expect(html).not.toContain('font-size="22"');
    expect(html).toContain("Font requires runtime state");
    expect(html).toContain("Font size requires runtime state");
  });

  it.each([
    { viewport: 390, family: "Arial,sans-serif", size: 16 },
    { viewport: 768, family: "Verdana,sans-serif", size: 24 },
    { viewport: 1366, family: "Verdana,sans-serif", size: 24 }
  ])("verifies responsive fonts with known viewport at $viewport", ({ viewport, family, size }) => {
    const html = render({
      Text: '="Responsive"',
      Font: "=If(App.Width < 720, Font.Arial, Font.Verdana)",
      Size: "=If(App.Width < 720, 16, 24)"
    }, viewport);
    expect(html).toContain(`font-family="${family}"`);
    expect(html).toContain(`font-size="${size}"`);
    expect(html).not.toContain('data-preview-font-state="unknown"');
    expect(html).not.toContain('data-preview-font-size-state="unknown"');
  });

  it("does not mark omitted font properties as runtime-unknown", () => {
    const html = render({ Text: '="Default"' });
    expect(html).not.toContain('data-preview-font-state="unknown"');
    expect(html).not.toContain('data-preview-font-size-state="unknown"');
  });

  it("marks an explicit size outside the renderer limit as approximate", () => {
    const html = render({ Text: '="Large"', Size: "=999", Font: "=Font.Arial" });
    expect(html).toContain('font-size="256"');
    expect(html).toContain('data-preview-font-size-state="unknown"');
    expect(html).not.toContain('data-preview-font-state="unknown"');
  });

  it("does not treat unsupported font expressions as verified CSS", () => {
    const html = render({ Text: '="Safe"', Font: '="Arial; color:red"', Size: "=20" });
    expect(html).toContain('data-preview-font-state="unknown"');
    expect(html).toContain('font-size="20"');
    expect(html).not.toContain("color:red");
  });
});
