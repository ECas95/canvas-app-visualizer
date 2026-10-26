import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { previewBoundedText } from "../core/layout/previewTextBounds";
import { buildCanvasModel } from "../core/model/normalize";
import { CanvasVisualControl } from "./CanvasVisualControl";

function synthetic(properties: Record<string, unknown>, controlType = "Classic/Label@2.5.1"): CanvasControl {
  return {
    id: "synthetic-text", name: "SyntheticText", controlType, properties,
    children: [], sourceFile: "Src/SyntheticText.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticText",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
}

function render(control: CanvasControl, viewport = 1366): string {
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={0} y={0} width={240} height={80}
    clipId="bounded-text-clip" simulationSymbols={{ "App.Width": viewport }}
  /></svg>);
}

describe("bounded, source-faithful preview text", () => {
  it("preserves absent, empty and exact-boundary values", () => {
    expect(previewBoundedText(null)).toEqual({ text: undefined, truncated: false });
    expect(previewBoundedText(undefined)).toEqual({ text: undefined, truncated: false });
    expect(previewBoundedText("", 2)).toEqual({ text: "", truncated: false });
    expect(previewBoundedText("ab", 2)).toEqual({ text: "ab", truncated: false });
    expect(previewBoundedText("abc", 2)).toEqual({ text: "ab", truncated: true });
  });

  it("does not split a Unicode surrogate pair at the limit", () => {
    expect(previewBoundedText("A🙂B", 2)).toEqual({ text: "A🙂", truncated: true });
    expect(previewBoundedText("🙂🙂", 1)).toEqual({ text: "🙂", truncated: true });
    expect(previewBoundedText("🙂", 1)).toEqual({ text: "🙂", truncated: false });
  });

  it("uses the safe default for an invalid limit", () => {
    const text = "x".repeat(4097);
    expect(previewBoundedText(text, -1)).toEqual({
      text: "x".repeat(4096), truncated: true
    });
  });

  it("marks a long verified Label as truncated, never as runtime unknown", () => {
    const source = "A".repeat(4097);
    const html = render(synthetic({ Text: '="' + source + '"', Wrap: "=false" }));
    expect(html).toContain('data-preview-text-state="truncated"');
    expect(html).toContain("Text preview truncated after 4096 Unicode characters");
    expect(html).toContain("A".repeat(4096));
    expect(html).not.toContain("A".repeat(4097));
    expect(html).not.toContain("Text unknown");
  });

  it("keeps exactly 4096 characters without a truncation warning", () => {
    const html = render(synthetic({ Text: '="' + "B".repeat(4096) + '"' }));
    expect(html).not.toContain('data-preview-text-state="truncated"');
    expect(html).not.toContain("Text preview truncated");
  });

  it("never cuts an emoji in half in rendered Canvas text", () => {
    const html = render(synthetic({ Text: '="' + "C".repeat(4095) + "🙂" + "D" + '"' }));
    expect(html).toContain('data-preview-text-state="truncated"');
    expect(html).toContain("C".repeat(4095) + "🙂");
    expect(html).not.toContain("C".repeat(4095) + "🙂D");
    expect(html).not.toContain("�");
  });

  it.each([390, 768, 1366])(
    "reports truncated browser-wrapped labels at viewport %i", viewport => {
      const html = render(synthetic({
        Text: '="' + "Wrapped ".repeat(600) + '"',
        Wrap: "=App.Width < 1500",
        Size: "=If(App.Width < 720, 16, 20)"
      }), viewport);
      expect(html).toContain("<foreignObject");
      expect(html).toContain('data-preview-text-state="truncated"');
      expect(html).toContain("Text preview truncated");
    }
  );

  it("does not replace an unresolved SQL/runtime label with truncated text", () => {
    const html = render(synthetic({
      Text: '=If(varSqlAuthorized, "Authorized", "Denied")',
      Wrap: "=true"
    }));
    expect(html).toContain('data-preview-text-state="unknown"');
    expect(html).not.toContain('data-preview-text-state="truncated"');
    expect(html).not.toContain("Authorized</span>");
    expect(html).not.toContain("Denied</span>");
  });

  it("reports a truncated button label without changing its interaction semantics", () => {
    const html = render(synthetic({
      Text: '="' + "Click".repeat(850) + '"'
    }, "Classic/Button@2.2.0"));
    expect(html).toContain('data-preview-text-state="truncated"');
    expect(html).toContain("Text preview truncated");
    expect(html).not.toContain("OnSelect");
  });

  it("works with a generic imported .pa.yaml file, not a private Canvas fixture", () => {
    const source = "Synthetic ".repeat(460);
    const yaml = [
      "Screens:",
      "  Generic:",
      "    Children:",
      "      - LongLabel:",
      "          Control: Classic/Label@2.5.1",
      "          Properties:",
      '            Text: ="' + source + '"',
      "            Wrap: =true"
    ].join("\n");
    const model = buildCanvasModel([{
      path: "Src/GenericLongLabel.pa.yaml", name: "GenericLongLabel.pa.yaml",
      content: yaml, origin: "yaml", format: "pa-yaml-v3"
    }], "yaml");
    const html = render(model.screens[0].children[0]);
    expect(html).toContain('data-preview-text-state="truncated"');
    expect(html).not.toContain("Text unknown");
  });
});
