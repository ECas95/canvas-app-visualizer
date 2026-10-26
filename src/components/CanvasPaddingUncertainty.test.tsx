import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { buildCanvasModel } from "../core/model/normalize";
import { CanvasVisualControl } from "./CanvasVisualControl";

function synthetic(properties: Record<string, string>, controlType = "Classic/Label@2.5.1"): CanvasControl {
  return {
    id: "synthetic-padding", name: "SyntheticPadding", controlType,
    properties: { Text: '="Local sample"', ...properties },
    children: [], sourceFile: "Src/GenericPadding.pa.yaml",
    sourcePath: "Screens/Generic/SyntheticPadding",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
}

function render(control: CanvasControl, viewport = 390): string {
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={10} y={20} width={240} height={64}
    clipId="generic-padding-clip"
    simulationSymbols={{ "App.Width": viewport }}
  /></svg>);
}

describe("explicit Power Fx padding uncertainty", () => {
  it.each(["PaddingTop", "PaddingRight", "PaddingBottom", "PaddingLeft"])(
    "marks %s when its value depends on runtime SQL/security state",
    edge => {
      const html = render(synthetic({ [edge]: "=If(varSqlAuthorized, 24, 8)", Wrap: "=true" }));
      expect(html).toContain('data-preview-padding-state="unknown"');
      expect(html).toContain(`data-preview-padding-edges="${edge}"`);
      expect(html).toContain(`Text padding cannot be verified for ${edge}`);
      expect(html).not.toContain("varSqlAuthorized</");
    }
  );

  it("reports all unknown edges in a stable order", () => {
    const html = render(synthetic({
      PaddingLeft: "=varLeft",
      PaddingBottom: "=varBottom",
      PaddingTop: "=varTop"
    }));
    expect(html).toContain('data-preview-padding-edges="PaddingTop,PaddingBottom,PaddingLeft"');
  });

  it.each([[390, 12], [768, 24], [1366, 24]])(
    "uses verified responsive padding at viewport %i",
    (viewport, expected) => {
      const html = render(synthetic({
        Wrap: "=true",
        PaddingLeft: "=If(App.Width < 720, 12, 24)"
      }), viewport);
      expect(html).toContain(`padding-left:${expected}px`);
      expect(html).not.toContain("data-preview-padding-state");
    }
  );

  it("does not mistake an omitted property for a runtime dependency", () => {
    expect(render(synthetic({ Wrap: "=true" }))).not.toContain("data-preview-padding-state");
  });

  it("marks invalid negative padding as unverified rather than verified zero", () => {
    const html = render(synthetic({ PaddingTop: "=-8", Wrap: "=true" }));
    expect(html).toContain('data-preview-padding-edges="PaddingTop"');
    expect(html).toContain("padding-top:0");
  });

  it("accepts a statically selected branch without evaluating an unused runtime branch", () => {
    const html = render(synthetic({
      Wrap: "=true",
      PaddingRight: "=If(true, 18, varSqlAuthorized)"
    }));
    expect(html).toContain("padding-right:18px");
    expect(html).not.toContain("data-preview-padding-state");
  });

  it("does not report text padding on a non-text shape", () => {
    const html = render(synthetic({
      PaddingLeft: "=varSqlAuthorized"
    }, "Classic/Rectangle@2.3.0"));
    expect(html).not.toContain("data-preview-padding-state");
  });

  it("imports a generic .pa.yaml label and preserves unknown padding without inventing data", () => {
    const yaml = [
      "Screens:",
      "  Generic:",
      "    Children:",
      "      - SyntheticPadding:",
      "          Control: Classic/Label@2.5.1",
      "          Properties:",
      '            Text: ="Synthetic only"',
      "            Wrap: =true",
      "            PaddingLeft: =If(varRuntimePermission, 24, 8)",
      "            PaddingRight: =If(App.Width < 720, 4, 12)"
    ].join("\n");
    const model = buildCanvasModel([{
      path: "Src/GenericPadding.pa.yaml",
      name: "GenericPadding.pa.yaml", content: yaml,
      origin: "yaml", format: "pa-yaml-v3"
    }], "yaml");
    const html = render(model.screens[0].children[0], 390);
    expect(html).toContain('data-preview-padding-edges="PaddingLeft"');
    expect(html).toContain("padding-right:4px");
    expect(html).toContain("Synthetic only");
    expect(html).not.toContain("data-preview-padding-edges=\"PaddingRight\"");
  });
});
