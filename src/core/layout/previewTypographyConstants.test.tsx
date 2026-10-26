import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../../types/canvas";
import { buildCanvasModel } from "../model/normalize";
import { CanvasVisualControl } from "../../components/CanvasVisualControl";
import {
  PREVIEW_DEFAULT_FONT, previewFontFamily, previewFontFamilyIsKnown,
  previewFontWeight, previewHorizontalAlign, previewVerticalAlign
} from "./previewAppearance";

function label(properties: Record<string, unknown>): CanvasControl {
  return {
    id: "synthetic-typography", name: "SyntheticTypography",
    controlType: "Classic/Label@2.5.1", properties, children: [],
    sourceFile: "Src/SyntheticTypography.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticTypography",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
}

describe("constant Power Fx typography without a runtime symbol table", () => {
  it("resolves a constant Font If rather than reporting an unsupported font", () => {
    const control = label({
      Font: "=If(true, Font.Arial, Font.Verdana)"
    });
    expect(previewFontFamily(control)).toBe("Arial,sans-serif");
    expect(previewFontFamilyIsKnown(control)).toBe(true);
  });

  it("resolves nested and multi-condition Font If with comments", () => {
    expect(previewFontFamily(label({
      Font: "=If(false, Font.Arial, true, If(false, Font.Verdana, Font.'Courier New'), Font.Georgia)"
    }))).toBe('"Courier New",monospace');
    expect(previewFontFamily(label({
      Font: "=If(true, Font /* selected */ . Verdana, Font.Arial)"
    }))).toBe("Verdana,sans-serif");
  });

  it("resolves constant horizontal, vertical and weight enums without symbols", () => {
    const control = label({
      Align: "=If(true, Align.Right, Align.Left)",
      VerticalAlign: "=If(false, VerticalAlign.Top, VerticalAlign.Bottom)",
      FontWeight: "=If(false, FontWeight.Bold, FontWeight.Semibold)"
    });
    expect(previewHorizontalAlign(control)).toBe("end");
    expect(previewVerticalAlign(control)).toBe("bottom");
    expect(previewFontWeight(control)).toBe(600);
  });

  it("retains fail-closed uncertainty for unknown SQL/security variables", () => {
    const control = label({
      Font: "=If(varSqlAuthorized, Font.Arial, Font.Verdana)",
      Align: "=If(varSqlAuthorized, Align.Right, Align.Left)",
      VerticalAlign: "=If(varSqlAuthorized, VerticalAlign.Top, VerticalAlign.Bottom)",
      FontWeight: "=If(varSqlAuthorized, FontWeight.Bold, FontWeight.Normal)"
    });
    expect(previewFontFamily(control)).toBe(PREVIEW_DEFAULT_FONT);
    expect(previewFontFamilyIsKnown(control)).toBe(false);
    expect(previewHorizontalAlign(control)).toBeNull();
    expect(previewVerticalAlign(control)).toBeNull();
    expect(previewFontWeight(control)).toBeUndefined();
  });

  it("does not accept text impersonating a typed enum or an absent If default", () => {
    expect(previewHorizontalAlign(label({
      Align: '=If(true, "Align.Right", Align.Left)'
    }))).toBeNull();
    expect(previewFontWeight(label({
      FontWeight: '=If(true, "FontWeight.Bold", FontWeight.Normal)'
    }))).toBeUndefined();
    expect(previewFontFamilyIsKnown(label({
      Font: "=If(false, Font.Arial)"
    }))).toBe(false);
    expect(previewHorizontalAlign(label({
      Align: "=If(false, Align.Right)"
    }))).toBeNull();
  });

  it("keeps responsive conditions tied to supplied viewport symbols", () => {
    const control = label({
      Font: "=If(App.Width < 720, Font.Arial, Font.Verdana)",
      Align: "=If(App.Width < 720, Align.Left, Align.Right)"
    });
    expect(previewFontFamilyIsKnown(control)).toBe(false);
    expect(previewHorizontalAlign(control)).toBeNull();
    expect(previewFontFamily(control, { "App.Width": 390 })).toBe("Arial,sans-serif");
    expect(previewFontFamily(control, { "App.Width": 1366 })).toBe("Verdana,sans-serif");
    expect(previewHorizontalAlign(control, { "App.Width": 1366 })).toBe("end");
  });

  it("imports a generic versioned .pa.yaml fixture and renders verified typography", () => {
    const yaml = [
      "Screens:",
      "  Synthetic:",
      "    Children:",
      "      - Caption:",
      "          Control: Classic/Label@2.5.1",
      "          Properties:",
      '            Text: =\"Safe preview\"',
      "            Font: =If(true, Font.Arial, Font.Verdana)",
      "            FontWeight: =If(false, FontWeight.Bold, FontWeight.Semibold)",
      "            Align: =If(true, Align.Right, Align.Left)",
      "            VerticalAlign: =If(true, VerticalAlign.Bottom, VerticalAlign.Top)"
    ].join("\n");
    const model = buildCanvasModel([{
      path: "Src/SyntheticTypography.pa.yaml",
      name: "SyntheticTypography.pa.yaml", content: yaml,
      origin: "yaml", format: "pa-yaml-v3"
    }], "yaml");
    const control = model.screens[0].children[0];
    const html = renderToStaticMarkup(<svg><CanvasVisualControl
      control={control} x={10} y={20} width={240} height={60}
      clipId="synthetic-typography-clip" /></svg>);
    expect(html).toContain('font-family="Arial,sans-serif"');
    expect(html).toContain('font-weight="600"');
    expect(html).toContain('text-anchor="end"');
    expect(html).not.toContain('data-preview-font-state="unknown"');
  });
});
