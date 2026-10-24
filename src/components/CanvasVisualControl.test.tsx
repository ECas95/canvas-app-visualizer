import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { CanvasVisualControl } from "./CanvasVisualControl";

function label(properties: Record<string, unknown>): CanvasControl {
  return {
    id: "synthetic-label", name: "SyntheticLabel",
    controlType: "Classic/Label@2.5.1", properties, children: [],
    sourceFile: "Src/Synthetic.pa.yaml", sourcePath: "Screens/Synthetic/SyntheticLabel",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
}

function render(properties: Record<string, unknown>, symbols?: Record<string, string | number | boolean>) {
  return renderToStaticMarkup(
    <CanvasVisualControl control={label(properties)} x={10} y={20}
      width={140} height={64} clipId="test-label-clip" simulationSymbols={symbols} />
  );
}

describe("source-faithful Canvas label wrapping", () => {
  it("wraps only when the serialized Wrap property resolves true", () => {
    const html = render({
      Text: '="A label with enough words to wrap across several lines"',
      Wrap: "=true"
    });
    expect(html).toContain("<foreignObject");
    expect(html).toContain("white-space:pre-wrap");
    expect(html).toContain("overflow-wrap:break-word");
    expect(html).toContain("A label with enough words");
  });

  it("preserves single-line SVG behavior for false and unresolved Wrap", () => {
    const base = { Text: '="Source label"' };
    expect(render({ ...base, Wrap: "=false" })).not.toContain("<foreignObject");
    expect(render({ ...base, Wrap: "=varRuntimeWrap" })).not.toContain("<foreignObject");
    expect(render(base)).not.toContain("<foreignObject");
    expect(render({ ...base, Wrap: "=false" })).toContain("<text");
  });

  it("reacts to known viewport dimensions without inventing runtime variables", () => {
    const properties = {
      Text: '="Responsive heading with wrapping"',
      Wrap: "=App.Width < 720",
      Size: "=If(App.Width < 720, 20, 24)"
    };
    const phone = render(properties, { "App.Width": 390 });
    const desktop = render(properties, { "App.Width": 1366 });
    expect(phone).toContain("<foreignObject");
    expect(phone).toContain("font-size:20px");
    expect(desktop).not.toContain("<foreignObject");
    expect(desktop).toContain('font-size="24"');
  });

  it("uses known source padding and text alignment for wrapped labels", () => {
    const html = render({
      Text: '="Aligned"', Wrap: "=true",
      Align: "=Align.Right", VerticalAlign: "=VerticalAlign.Bottom",
      PaddingTop: "=3", PaddingRight: "=6",
      PaddingBottom: "=7", PaddingLeft: "=12"
    });
    expect(html).toContain("padding-top:3px");
    expect(html).toContain("padding-right:6px");
    expect(html).toContain("padding-bottom:7px");
    expect(html).toContain("padding-left:12px");
    expect(html).toContain("align-items:flex-end");
    expect(html).toContain("text-align:right");
  });

  it("keeps unresolved data-source text absent and never synthesizes gallery rows", () => {
    const html = render({ Text: "=ThisItem.Name", Wrap: "=true" });
    expect(html).not.toContain("<foreignObject");
    expect(html).not.toContain("ThisItem.Name");
  });

  it("escapes imported label text instead of interpreting it as HTML", () => {
    const html = render({ Text: '="A <script>alert(1)</script> & B"', Wrap: "=true" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; B");
  });

  it("does not cut normal wrapped text at the old 240-character limit", () => {
    const text = "W".repeat(300);
    const html = render({ Text: '="' + text + '"', Wrap: "=true" });
    expect(html).toContain(text);
  });
});
