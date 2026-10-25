import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { CanvasVisualControl } from "./CanvasVisualControl";

function renderLabel(
  lineHeight: string | undefined,
  viewport: number,
  wrap: boolean
): string {
  const control: CanvasControl = {
    id: "synthetic-line-height",
    name: "SyntheticLineHeight",
    controlType: "Classic/Label@2.5.1",
    properties: {
      Text: '="First\\nSecond\\nThird"',
      Size: "=20",
      Wrap: wrap ? "=true" : "=false",
      VerticalAlign: "=VerticalAlign.Top",
      ...(lineHeight === undefined ? {} : { LineHeight: lineHeight })
    },
    children: [],
    sourceFile: "Src/SyntheticLineHeight.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticLineHeight",
    sourceFormat: "pa-yaml-v3",
    zIndex: 1
  };
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={0} y={0} width={280} height={150}
    clipId="synthetic-line-height-clip"
    simulationSymbols={{ "App.Width": viewport }}
  /></svg>);
}

describe("source-only Canvas label LineHeight", () => {
  it.each([
    [390, 1.5, 30],
    [768, 2, 40],
    [1366, 2, 40]
  ])("uses the resolved LineHeight at viewport %i for SVG lines", (viewport, _factor, dy) => {
    const html = renderLabel("=If(App.Width < 720, 1.5, 2)", viewport, false);
    expect(html).toContain(`dy="${dy}"`);
    expect(html).not.toContain('data-preview-line-height-state="unknown"');
  });

  it.each([
    [390, "1.5"],
    [768, "2"],
    [1366, "2"]
  ])("uses the same resolved spacing for wrapped text at viewport %i", (viewport, factor) => {
    const html = renderLabel("=If(App.Width < 720, 1.5, 2)", viewport, true);
    expect(html).toContain("<foreignObject");
    expect(html).toContain(`line-height:${factor}`);
    expect(html).not.toContain('data-preview-line-height-state="unknown"');
  });

  it("preserves the existing 1.2 default when LineHeight is absent", () => {
    const html = renderLabel(undefined, 1366, false);
    expect(html).toContain('dy="24"');
    expect(html).not.toContain('data-preview-line-height-state="unknown"');
  });

  it("marks SQL/runtime-dependent spacing unknown without inventing a value", () => {
    const html = renderLabel("=varSqlLineHeight", 1366, false);
    expect(html).toContain('data-preview-line-height-state="unknown"');
    expect(html).toContain("LineHeight requires runtime state");
    expect(html).toContain('dy="24"');
  });

  it("marks unsupported nonpositive spacing unknown", () => {
    const html = renderLabel("=0", 390, true);
    expect(html).toContain('data-preview-line-height-state="unknown"');
    expect(html).toContain("line-height:1.2");
  });

  it("preserves a verifiable fractional multiplier", () => {
    const html = renderLabel("=1.75", 768, true);
    expect(html).toContain("line-height:1.75");
    expect(html).not.toContain('data-preview-line-height-state="unknown"');
  });
});
