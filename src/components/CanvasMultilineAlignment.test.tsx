import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { previewSvgTextWindow } from "../core/layout/previewSvgTextWindow";
import { CanvasVisualControl } from "./CanvasVisualControl";

const twelveLines = Array.from({ length: 12 }, (_, i) => "Line " + (i + 1));

function render(align: "Top" | "Middle" | "Bottom", viewport: number): string {
  const control: CanvasControl = {
    id: "synthetic-overflow", name: "SyntheticOverflow",
    controlType: "Classic/Label@2.5.1",
    properties: {
      Text: '="' + twelveLines.join("\n") + '"',
      Wrap: "=false",
      Size: "=If(App.Width < 720, 16, 20)",
      VerticalAlign: "=VerticalAlign." + align
    },
    children: [],
    sourceFile: "Src/SyntheticOverflow.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticOverflow",
    sourceFormat: "pa-yaml-v3",
    zIndex: 1
  };
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={0} y={0} width={280} height={24}
    clipId="synthetic-overflow-clip"
    simulationSymbols={{ "App.Width": viewport }}
  /></svg>);
}

describe("source-only clipped SVG multiline alignment", () => {
  it.each([390, 768, 1366])(
    "uses last verified source lines for Bottom at %i px", viewport => {
      const html = render("Bottom", viewport);
      expect(html.match(/<tspan\b/g)).toHaveLength(5);
      expect(html).toContain("Line 8</tspan>");
      expect(html).toContain("Line 12</tspan>");
      expect(html).not.toContain("Line 1</tspan>");
    }
  );

  it.each([390, 768, 1366])(
    "keeps the centered source window for Middle at %i px", viewport => {
      const html = render("Middle", viewport);
      expect(html.match(/<tspan\b/g)).toHaveLength(5);
      expect(html).toContain("Line 4</tspan>");
      expect(html).toContain("Line 8</tspan>");
      expect(html).not.toContain("Line 1</tspan>");
      expect(html).not.toContain("Line 12</tspan>");
    }
  );

  it.each([390, 768, 1366])(
    "keeps first source lines for Top at %i px", viewport => {
      const html = render("Top", viewport);
      expect(html.match(/<tspan\b/g)).toHaveLength(5);
      expect(html).toContain("Line 1</tspan>");
      expect(html).toContain("Line 5</tspan>");
      expect(html).not.toContain("Line 12</tspan>");
    }
  );

  it("keeps explicit empty lines and CRLF boundaries", () => {
    expect(previewSvgTextWindow("A\r\n\r\nC", 300, 20, "bottom")).toEqual({
      lines: ["A", "", "C"], firstIndex: 0, totalLines: 3
    });
  });

  it("caps very large bottom-aligned labels without substituting early lines", () => {
    const source = Array.from({ length: 220 }, (_, i) => "Item " + i).join("\n");
    const result = previewSvgTextWindow(source, 6000, 19.2, "bottom");
    expect(result.lines).toHaveLength(128);
    expect(result.firstIndex).toBe(92);
    expect(result.lines[0]).toBe("Item 92");
    expect(result.lines[127]).toBe("Item 219");
    expect(result.totalLines).toBe(220);
  });

  it("preserves the source count with invalid viewport metrics", () => {
    const result = previewSvgTextWindow(twelveLines.join("\n"), Number.NaN, 0, null);
    expect(result.lines).toEqual(twelveLines.slice(3, 8));
    expect(result.firstIndex).toBe(3);
    expect(result.totalLines).toBe(12);
  });
});
