import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import {
  isDefinitelyHidden, previewColor, previewFontSize, previewFontWeight,
  previewHorizontalAlign, previewIsChecked, previewItalic, previewKind,
  previewText, previewTextDecoration, previewVerticalAlign
} from "./previewAppearance";

function control(type: string, properties: Record<string, unknown> = {}): CanvasControl {
  return {
    id: "demo", name: "Demo", controlType: type, properties, children: [],
    sourceFile: "Src/Demo.pa.yaml", sourcePath: "Screens/Demo/Demo",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
}

describe("semantic preview classification", () => {
  it("distinguishes common Power Apps controls", () => {
    expect(previewKind("Classic/Button@2.2.0")).toBe("button");
    expect(previewKind("TextInput")).toBe("input");
    expect(previewKind("ComboBox")).toBe("select");
    expect(previewKind("Gallery")).toBe("gallery");
    expect(previewKind("GroupContainer")).toBe("container");
    expect(previewKind("DataCard")).toBe("form");
    expect(previewKind("Checkbox")).toBe("checkbox");
    expect(previewKind("Toggle")).toBe("toggle");
    expect(previewKind("Camera")).toBe("unknown");
  });

  it("only paints statically known colors", () => {
    expect(previewColor("=Color.White")).toBe("#ffffff");
    expect(previewColor("=Color.Transparent")).toBe("transparent");
    expect(previewColor('=ColorValue("#abcdef")')).toBe("#abcdef");
    expect(previewColor("=RGBA(1, 2, 3, 0.5)")).toBe("rgba(1,2,3,0.5)");
    expect(previewColor("=If(varDark, Color.Black, Color.White)")).toBeNull();
    expect(previewColor('=ColorValue("url(https://test.example)")')).toBeNull();
  });

  it("does not make up dynamic labels", () => {
    expect(previewText(control("Label", { Text: '="Welcome"' }))).toBe("Welcome");
    expect(previewText(control("Label", { Text: "=varTitle" }))).toBeNull();
    expect(previewText(control("TextInput", { HintText: '="Search"' }))).toBe("Search");
    expect(previewFontSize(control("Label", { Size: "=72" }))).toBe(72);
  });

  it("honors only resolved false visibility", () => {
    expect(isDefinitelyHidden(control("Label", { Visible: "=false" }))).toBe(true);
    expect(isDefinitelyHidden(control("Label", { Visible: "=true" }))).toBe(false);
    expect(isDefinitelyHidden(control("Label", { Visible: "=varVisible" }))).toBe(false);
  });

  it("resolves viewport-dependent visibility without guessing runtime variables", () => {
    const symbols = { "App.Width": 1366, "App.Height": 768, "Parent.Width": 1200 };
    expect(isDefinitelyHidden(control("Label", { Visible: "=App.Width < 1000" }), symbols)).toBe(true);
    expect(isDefinitelyHidden(control("Label", { Visible: "=App.Width >= 1000" }), symbols)).toBe(false);
    expect(isDefinitelyHidden(control("Label", { Visible: "=varIsAdmin && App.Width >= 1000" }), symbols)).toBe(false);
    expect(isDefinitelyHidden(control("Label", { Visible: "=false//App.Width >= 1000" }), symbols)).toBe(true);
  });

  it("respects explicit serialized typography and alignment", () => {
    const label = control("Label", {
      Align: "=Align.Right",
      VerticalAlign: "=VerticalAlign.Top",
      FontWeight: "=FontWeight.Bold",
      Italic: "=true",
      Underline: "=true",
      Strikethrough: "=false",
      Size: "=24"
    });
    expect(previewHorizontalAlign(label)).toBe("end");
    expect(previewVerticalAlign(label)).toBe("top");
    expect(previewFontWeight(label)).toBe(700);
    expect(previewItalic(label)).toBe(true);
    expect(previewTextDecoration(label)).toBe("underline");
    expect(previewFontSize(label)).toBe(24);
  });

  it("does not guess unsupported dynamic style formulas", () => {
    const label = control("Label", {
      Align: "=If(varCentered, Align.Center, Align.Left)",
      VerticalAlign: "=varPosition",
      FontWeight: "=If(varBold, FontWeight.Bold, FontWeight.Regular)",
      Italic: "=varItalic",
      Size: "=varSize"
    });
    expect(previewHorizontalAlign(label)).toBeNull();
    expect(previewVerticalAlign(label)).toBeNull();
    expect(previewFontWeight(label)).toBeUndefined();
    expect(previewItalic(label)).toBe(false);
    expect(previewFontSize(label)).toBe(14);
  });

  it("resolves serialized checkbox and toggle state", () => {
    expect(previewIsChecked(control("Toggle", { Default: "=true" }))).toBe(true);
    expect(previewIsChecked(control("Checkbox", { Checked: "=false" }))).toBe(false);
  });
});
