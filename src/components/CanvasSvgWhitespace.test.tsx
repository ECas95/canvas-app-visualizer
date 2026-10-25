import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { CanvasVisualControl } from "./CanvasVisualControl";

/**
 * Canvas labels preserve verified source text. SVG 2 defaults to collapsing
 * repeated and edge spaces unless white-space is specified. Wrap=false must
 * preserve those spaces without introducing soft wrapping.
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/modern-controls/modern-control-text
 * https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/white-space
 */
function render(
  controlType: string,
  properties: Record<string, unknown>,
  viewport = 768
): string {
  const control: CanvasControl = {
    id: "synthetic-space", name: "SyntheticSpace",
    controlType, properties, children: [],
    sourceFile: "Src/SyntheticSpace.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticSpace",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={4} y={8} width={280} height={64}
    clipId="synthetic-space-clip"
    simulationSymbols={{ "App.Width": viewport }}
  /></svg>);
}

describe("SVG whitespace fidelity for source-known Canvas text", () => {
  it.each([390, 768, 1366])(
    "preserves repeated and edge spaces without soft wrapping at %i px", viewport => {
      const html = render("Classic/Label@2.5.1", {
        Text: '="  Alpha   Beta  "',
        Wrap: "=false",
        Size: "=If(App.Width < 720, 14, 18)"
      }, viewport);
      expect(html).toContain('style="white-space:pre"');
      expect(html).toContain(">  Alpha   Beta  </tspan>");
      expect(html).not.toContain("white-space:pre-wrap");
    }
  );

  it("preserves source spaces on button SVG text", () => {
    const html = render("Classic/Button@2.2.0", {
      Text: '="Save   now"',
    });
    expect(html).toContain('style="white-space:pre"');
    expect(html).toContain(">Save   now</tspan>");
  });

  it("keeps explicit newlines as distinct tspans without collapsing spaces", () => {
    const html = render("Classic/Label@2.5.1", {
      Text: '="First   line\n  second   line"',
      Wrap: "=false",
      VerticalAlign: "=VerticalAlign.Top"
    });
    expect(html).toContain('style="white-space:pre"');
    expect(html).toContain(">First   line</tspan>");
    expect(html).toContain(">  second   line</tspan>");
  });

  it("retains browser wrapping when Wrap is provably true", () => {
    const html = render("Classic/Label@2.5.1", {
      Text: '="Alpha   Beta"',
      Wrap: "=true"
    });
    expect(html).toContain("white-space:pre-wrap");
    expect(html).not.toContain('style="white-space:pre"');
  });

  it("does not fabricate runtime-dependent text", () => {
    const html = render("Classic/Label@2.5.1", {
      Text: "=varSqlTitle",
      Wrap: "=false"
    });
    expect(html).toContain('data-preview-text-state="unknown"');
    expect(html).not.toContain("varSqlTitle</tspan>");
  });
});
