import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { CanvasVisualControl } from "./CanvasVisualControl";

// Synthetic fixtures only. No private .pa.yaml, SQL rows or runtime permissions.
function render(properties: Record<string, unknown>, viewport = 768,
  controlType = "ModernText@1.0.0"): string {
  const control: CanvasControl = {
    id: "synthetic-style", name: "SyntheticStyle", controlType,
    properties: { Text: '="Local example"', ...properties }, children: [],
    sourceFile: "Src/SyntheticStyle.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticStyle",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={0} y={0} width={280} height={64}
    clipId="synthetic-style-clip"
    simulationSymbols={{ "App.Width": viewport }}
  /></svg>);
}

describe("ModernText legacy source styling and runtime uncertainty", () => {
  it("renders the legacy Weight typed enum", () => {
    const html = render({ Weight: "=FontWeight.Bold" });
    expect(html).toContain('font-weight="700"');
    expect(html).not.toContain('data-preview-text-style-state="unknown"');
  });

  it("renders an allowlisted legacy Weight text literal", () => {
    const html = render({ Weight: '="Semibold"' });
    expect(html).toContain('font-weight="600"');
  });

  it("renders legacy italic, underline and strikethrough", () => {
    const html = render({
      FontItalic: "=true", FontUnderline: "=true", FontStrikethrough: "=true"
    });
    expect(html).toContain('font-style="italic"');
    expect(html).toContain('text-decoration="underline line-through"');
    expect(html).not.toContain('data-preview-text-style-state="unknown"');
  });

  it("honors current FontWeight over a conflicting legacy Weight", () => {
    const html = render({ FontWeight: "=FontWeight.Bold", Weight: '="Normal"' });
    expect(html).toContain('font-weight="700"');
  });

  it("does not substitute a known legacy Weight for an unknown current FontWeight", () => {
    const html = render({ FontWeight: "=varRuntimeWeight", Weight: '="Bold"' });
    expect(html).toContain('data-preview-text-style-properties="FontWeight"');
    expect(html).not.toContain('font-weight="700"');
  });

  it("honors current false boolean styles over true legacy aliases", () => {
    const html = render({
      Italic: "=false", FontItalic: "=true",
      Underline: "=false", FontUnderline: "=true",
      Strikethrough: "=false", FontStrikethrough: "=true"
    });
    expect(html).not.toContain('font-style="italic"');
    expect(html).not.toContain('text-decoration="');
    expect(html).not.toContain('data-preview-text-style-state="unknown"');
  });

  it("uses legacy FontColor only when current Color is absent", () => {
    expect(render({ FontColor: "=Color.Red" })).toContain('fill="#ff0000"');
    const current = render({ Color: "=Color.Blue", FontColor: "=Color.Red" });
    expect(current).toContain('fill="#0000ff"');
    expect(current).not.toContain('fill="#ff0000"');
  });

  it("does not override an unknown current Color with a known legacy FontColor", () => {
    const html = render({ Color: "=varRuntimeColor", FontColor: "=Color.Red" });
    expect(html).toContain('data-preview-color-state="unknown"');
    expect(html).not.toContain('fill="#ff0000"');
  });

  it.each([
    [390, 700, true],
    [768, 400, false],
    [1366, 400, false]
  ])("resolves legacy viewport-dependent style at %i px", (viewport, weight, italic) => {
    const html = render({
      Weight: '=If(App.Width < 720, "Bold", "Normal")',
      FontItalic: "=App.Width < 720"
    }, viewport);
    expect(html).toContain(`font-weight="${weight}"`);
    expect(html.includes('font-style="italic"')).toBe(italic);
    expect(html).not.toContain('data-preview-text-style-state="unknown"');
  });

  it("marks unknown legacy styling rather than inventing formatting", () => {
    const html = render({
      Weight: "=varSqlWeight", FontItalic: "=varSqlItalic",
      FontUnderline: "=varSqlUnderline", FontStrikethrough: "=varSqlStrike"
    });
    expect(html).toContain('data-preview-text-style-state="unknown"');
    expect(html).toContain('data-preview-text-style-properties="FontWeight,Italic,Underline,Strikethrough"');
    expect(html).toContain("Text styling cannot be verified");
    expect(html).not.toContain('font-weight="700"');
  });

  it("marks unknown horizontal and vertical alignment without claiming a runtime value", () => {
    const html = render({
      Align: "=varRuntimeAlign", VerticalAlign: "=varRuntimeVertical"
    });
    expect(html).toContain('data-preview-text-style-properties="Align,VerticalAlign"');
  });

  it("supports older alignment aliases and flags unresolved ones", () => {
    const html = render({
      TextAlign: "=varRuntimeAlign", TextVerticalAlignment: "=varRuntimeVertical"
    });
    expect(html).toContain('data-preview-text-style-properties="Align,VerticalAlign"');
  });

  it("does not mark known alignment enums as unknown", () => {
    const html = render({
      Align: "=Align.Center", VerticalAlign: "=VerticalAlign.Bottom"
    });
    expect(html).not.toContain('data-preview-text-style-state="unknown"');
  });

  it("does not flag omitted or explicit false styles as unknown", () => {
    const html = render({
      Italic: "=false", Underline: "=false", Strikethrough: "=false"
    });
    expect(html).not.toContain('data-preview-text-style-state="unknown"');
    expect(render({})).not.toContain('data-preview-text-style-state="unknown"');
  });

  it("does not apply ModernText legacy properties to classic labels", () => {
    const html = render({
      Weight: '="Bold"', FontItalic: "=true",
      FontUnderline: "=true", FontColor: "=Color.Red"
    }, 768, "Classic/Label@2.5.1");
    expect(html).not.toContain('font-weight="700"');
    expect(html).not.toContain('font-style="italic"');
    expect(html).not.toContain('text-decoration="');
    expect(html).not.toContain('fill="#ff0000"');
  });

  it("does not accept arbitrary legacy Weight text as browser CSS", () => {
    const html = render({ Weight: '="bold;fill:red"' });
    expect(html).toContain('data-preview-text-style-properties="FontWeight"');
    expect(html).not.toContain("bold;fill:red");
  });
});
