import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { CanvasVisualControl } from "./CanvasVisualControl";

function renderInput(type: string, properties: Record<string, unknown>): string {
  const control: CanvasControl = {
    id: "SyntheticInput", name: "SyntheticInput", controlType: type,
    properties, children: [], zIndex: 1,
    sourceFile: "Src/SyntheticInput.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticInput",
    sourceFormat: "pa-yaml-v3"
  };
  return renderToStaticMarkup(
    <svg><CanvasVisualControl control={control} x={10} y={20}
      width={240} height={44} clipId="synthetic-input-clip" /></svg>
  );
}

describe("Canvas source-only input placeholders", () => {
  it("does not display a hint when a serialized input value depends on runtime state", () => {
    for (const type of ["Classic/TextInput@2.3.2", "ModernTextInput@1.0.0"]) {
      const html = renderInput(type, {
        Default: "=varFromRuntime", HintText: '="Search records"'
      });
      expect(html).not.toContain("Search records");
      expect(html).toContain("…");
    }
  });

  it("renders a hint only for a known empty input, and literal values otherwise", () => {
    const type = "Classic/TextInput@2.3.2";
    expect(renderInput(type, {
      Default: '=""', HintText: '="Search records"'
    })).toContain("Search records");
    const filled = renderInput(type, {
      Default: '="Verified literal"', HintText: '="Search records"'
    });
    expect(filled).toContain("Verified literal");
    expect(filled).not.toContain("Search records");
  });
});
