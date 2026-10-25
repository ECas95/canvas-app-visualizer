import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { CanvasVisualControl } from "./CanvasVisualControl";

const verifiedLines = Array.from({ length: 9 }, (_, index) => `Line ${index + 1}`).join("\n");

function render(viewport: number, height: number, text: string = verifiedLines): string {
  const control: CanvasControl = {
    id: "synthetic-multiline", name: "SyntheticMultiline",
    controlType: "Classic/Label@2.5.1",
    properties: {
      Text: '="' + text + '"',
      Wrap: "=false",
      Size: "=If(App.Width < 720, 16, 20)",
      VerticalAlign: "=VerticalAlign.Top"
    },
    children: [], sourceFile: "Src/GenericMultiline.pa.yaml",
    sourcePath: "Screens/Generic/SyntheticMultiline",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={0} y={0} width={280} height={height}
    clipId="synthetic-multiline-clip"
    simulationSymbols={{ "App.Width": viewport }}
  /></svg>);
}

describe("source-faithful multiline SVG label viewport", () => {
  it.each([390, 768, 1366])(
    "preserves nine verified source lines in a tall %i px viewport",
    viewport => {
      const html = render(viewport, 300);
      expect(html.match(/<tspan\b/g)).toHaveLength(9);
      expect(html).toContain("Line 6</tspan>");
      expect(html).toContain("Line 9</tspan>");
      expect(html).toContain(`font-size="${viewport < 720 ? 16 : 20}"`);
      expect(html).not.toContain("<foreignObject");
    }
  );

  it("bounds rendered spans when the control is short", () => {
    const html = render(1366, 24);
    expect(html.match(/<tspan\b/g)).toHaveLength(5);
    expect(html).toContain("Line 5</tspan>");
    expect(html).not.toContain("Line 9</tspan>");
  });

  it("caps pathological imported multiline text without fabricating content", () => {
    const manyLines = Array.from({ length: 220 }, (_, index) => `Item ${index}`).join("\n");
    const html = render(390, 6000, manyLines);
    expect(html.match(/<tspan\b/g)).toHaveLength(128);
    expect(html).toContain("Item 127</tspan>");
    expect(html).not.toContain("Item 128</tspan>");
  });
});
