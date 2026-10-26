import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../../types/canvas";
import { CanvasVisualControl } from "../../components/CanvasVisualControl";
import { buildCanvasModel } from "../model/normalize";
import { previewCheckedState, previewInputContent } from "./previewAppearance";

function control(type: string, properties: Record<string, unknown>): CanvasControl {
  return {
    id: "SyntheticOutput", name: "SyntheticOutput", controlType: type,
    properties, children: [], zIndex: 1,
    sourceFile: "Src/SyntheticOutput.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticOutput",
    sourceFormat: "pa-yaml-v3"
  };
}

function svg(control: CanvasControl): string {
  return renderToStaticMarkup(<svg><CanvasVisualControl control={control}
    x={10} y={20} width={220} height={48} clipId="synthetic-output-clip" /></svg>);
}

describe("source initial properties versus live output properties", () => {
  it("does not turn a classic TextInput.Value output into a verified initial value", () => {
    const input = control("Classic/TextInput@2.3.2", {
      Value: '="Looks like an initial value"', HintText: '="Search"'
    });
    expect(previewInputContent(input)).toEqual({ text: null, state: "unknown" });
    const html = svg(input);
    expect(html).toContain('data-preview-input-state="unknown"');
    expect(html).not.toContain("Looks like an initial value");
    expect(html).not.toContain(">Search<");
  });

  it("does not treat a modern TextInput.Text output as Default", () => {
    const input = control("ModernTextInput@1.0.0", {
      Text: '="Runtime-looking text"', Placeholder: '="Find items"'
    });
    expect(previewInputContent(input)).toEqual({ text: null, state: "unknown" });
    const html = svg(input);
    expect(html).toContain('data-preview-input-state="unknown"');
    expect(html).not.toContain("Runtime-looking text");
    expect(html).not.toContain(">Find items<");
  });

  it("honors a verified Default over conflicting output properties", () => {
    const modern = control("ModernTextInput@1.0.0", {
      Default: '="Verified initial"', Text: '="Unverified output"',
      Value: '="Unverified value"', Placeholder: '="Hint"'
    });
    expect(previewInputContent(modern)).toEqual({
      text: "Verified initial", state: "value"
    });
    expect(svg(modern)).toContain("Verified initial");
    expect(svg(modern)).not.toContain("Unverified output");
  });

  it("shows a hint when no Default or output is serialized", () => {
    const modern = control("ModernTextInput@1.0.0", {
      Placeholder: '="Safe placeholder"'
    });
    expect(previewInputContent(modern)).toEqual({
      text: "Safe placeholder", state: "hint"
    });
  });

  it("does not turn classic Toggle.Value output into a checked default", () => {
    const toggle = control("Classic/Toggle@2.1.0", { Value: "=true" });
    expect(previewCheckedState(toggle)).toBe("unknown");
    const html = svg(toggle);
    expect(html).toContain('data-preview-checked="unknown"');
    expect(html).toContain("Checked state unknown");
  });

  it("does not turn classic CheckBox.Value output into an unchecked default", () => {
    const checkbox = control("Classic/CheckBox@2.1.0", { Value: "=false" });
    expect(previewCheckedState(checkbox)).toBe("unknown");
    expect(svg(checkbox)).toContain('data-preview-checked="unknown"');
  });

  it("preserves source-controlled modern Checked and classic Default", () => {
    expect(previewCheckedState(control("Modern/Checkbox@1.0.0", {
      Checked: "=true", Value: "=false"
    }))).toBe("checked");
    expect(previewCheckedState(control("Classic/Toggle@2.1.0", {
      Default: "=false", Value: "=true"
    }))).toBe("unchecked");
    expect(previewCheckedState(control("Classic/Toggle@2.1.0", {})))
      .toBe("unchecked");
  });

  it("keeps a synthetic pa.yaml output-only input unresolved through model import", () => {
    const yaml = [
      "Screens:", "  Synthetic:", "    Children:", "      - SearchBox:",
      "          Control: ModernTextInput@1.0.0", "          Properties:",
      '            Text: ="Not a verified initial value"',
      '            Placeholder: ="Search catalog"',
      "            Width: =220", "            Height: =48"
    ].join("\n");
    const model = buildCanvasModel([{
      path: "Src/SyntheticOutput.pa.yaml", name: "SyntheticOutput.pa.yaml",
      content: yaml, origin: "yaml", format: "pa-yaml-v3"
    }], "yaml");
    const input = model.screens[0].children[0];
    expect(previewInputContent(input).state).toBe("unknown");
    const html = svg(input);
    expect(html).toContain('data-preview-input-state="unknown"');
    expect(html).not.toContain("Not a verified initial value");
    expect(html).not.toContain(">Search catalog<");
  });
});
