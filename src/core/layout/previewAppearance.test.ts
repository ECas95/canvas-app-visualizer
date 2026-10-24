import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import {
  isDefinitelyHidden, previewVisibility, previewCanRunOnSelect, previewBorderStyle, previewDropShadow, previewDropShadowFilter, previewColor, previewColorWithSymbols, previewDisplayMode, previewFontFamily, PREVIEW_DEFAULT_FONT, previewFontSize, previewFontWeight,
  previewHorizontalAlign, previewIsChecked, previewItalic, previewKind,
  previewText, previewTextDecoration, previewVerticalAlign, previewSelectionBehaviorGate
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

  it("does not mistake unavailable security or gallery state for Visible=true", () => {
    expect(previewVisibility(control("GroupContainer", {
      Visible: "=varReady && varAuthorized"
    }))).toBe("unknown");
    expect(previewVisibility(control("GroupContainer", {
      Visible: "=varReady && varAuthorized"
    }), { varReady: false })).toBe("hidden");
    expect(previewVisibility(control("GroupContainer", {
      Visible: "=varReady && varAuthorized"
    }), { varReady: true, varAuthorized: true })).toBe("visible");
    expect(previewVisibility(control("GroupContainer", {
      Visible: "=varReady && IsEmpty(Gallery1.AllItems)"
    }), { varReady: true })).toBe("unknown");
    expect(previewVisibility(control("GroupContainer", {
      Visible: "=false// outdated design visibility"
    }))).toBe("hidden");
    expect(previewVisibility(control("Label"))).toBe("visible");
  });

  it("resolves viewport-dependent visibility without guessing runtime variables", () => {
    const symbols = { "App.Width": 1366, "App.Height": 768, "Parent.Width": 1200 };
    expect(isDefinitelyHidden(control("Label", { Visible: "=App.Width < 1000" }), symbols)).toBe(true);
    expect(isDefinitelyHidden(control("Label", { Visible: "=App.Width >= 1000" }), symbols)).toBe(false);
    expect(isDefinitelyHidden(control("Label", { Visible: "=varIsAdmin && App.Width >= 1000" }), symbols)).toBe(false);
    expect(isDefinitelyHidden(control("Label", { Visible: "=false//App.Width >= 1000" }), symbols)).toBe(true);
  });

  it("uses explicit Canvas Font enums and quoted families without guessing", () => {
    expect(previewFontFamily(control("Label", { Font: "=Font.Arial" })))
      .toBe("Arial,sans-serif");
    expect(previewFontFamily(control("Label", { Font: "=Font.'Segoe UI'" })))
      .toBe(PREVIEW_DEFAULT_FONT);
    expect(previewFontFamily(control("Label", { Font: "=Font.'Courier New'" })))
      .toBe('"Courier New",monospace');
    expect(previewFontFamily(control("Label", { Font: '="Georgia"' })))
      .toBe("Georgia,serif");
  });

  it("keeps unknown, dynamic and unsafe fonts on a local fallback", () => {
    expect(previewFontFamily(control("Label"))).toBe(PREVIEW_DEFAULT_FONT);
    expect(previewFontFamily(control("Label", { Font: "=varRuntimeFont" })))
      .toBe(PREVIEW_DEFAULT_FONT);
    expect(previewFontFamily(control("Label", { Font: "=If(varReady, Font.Arial, Font.Verdana)" })))
      .toBe(PREVIEW_DEFAULT_FONT);
    expect(previewFontFamily(control("Label", { Font: '="Arial; background:url(evil)"' })))
      .toBe(PREVIEW_DEFAULT_FONT);
  });

  it("uses the source-responsive font Size instead of a fixed fallback", () => {
    const heading = control("Label", {
      Size: "=If(App.Width < 720, 20, 24)",
      Text: '="Workspace"'
    });
    expect(previewFontSize(heading, { "App.Width": 1366 })).toBe(24);
    expect(previewFontSize(heading, { "App.Width": 390 })).toBe(20);
    expect(previewFontSize(heading)).toBe(14);
    expect(previewFontSize(control("Label", { FontSize: "=Parent.Width / 20" }),
      { "Parent.Width": 600 })).toBe(30);
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

  it("only runs simulated OnSelect for a confirmed editable DisplayMode", () => {
    const action = (mode?: string) => control("Classic/Button@2.2.0", {
      OnSelect: "=Set(clicked, true)",
      ...(mode === undefined ? {} : { DisplayMode: mode })
    });
    // YAML omits properties at their defaults.
    expect(previewCanRunOnSelect(action())).toBe(true);
    expect(previewCanRunOnSelect(action("=DisplayMode.Edit"))).toBe(true);
    expect(previewCanRunOnSelect(action("=DisplayMode.Disabled"))).toBe(false);
    expect(previewCanRunOnSelect(action("=DisplayMode.View"))).toBe(false);
    expect(previewCanRunOnSelect(action("=varMode"))).toBe(false);
    expect(previewCanRunOnSelect(action("=If(varReady, DisplayMode.Edit, DisplayMode.Disabled)"), {varReady: true})).toBe(true);
    expect(previewCanRunOnSelect(action("=If(varReady, DisplayMode.Edit, DisplayMode.Disabled)"), {varReady: false})).toBe(false);
    expect(previewCanRunOnSelect(action("=If(varReady, DisplayMode.Edit, DisplayMode.Disabled)"))).toBe(false);
    expect(previewCanRunOnSelect(action("=If(true, DisplayMode.Edit, DisplayMode.Disabled)"))).toBe(true);
    expect(previewCanRunOnSelect(action("=Connector.DisplayMode()"))).toBe(false);
  });
  it("renders variable-dependent Fill using the source-selected If branch", () => {
    const raw = '=If(varActive, Color.Green, Color.Gray)';
    expect(previewColorWithSymbols(raw, { varActive: true })).toBe("#008000");
    expect(previewColorWithSymbols(raw, { varActive: false })).toBe("#808080");
    expect(previewColorWithSymbols(raw, {})).toBeNull();
  });

  it("supports nested and multi-condition color branches without guessing data", () => {
    const formula = '=If(varLoading, Color.Orange, varReady, RGBA(10, 20, 30, 0.5), Color.Red)';
    expect(previewColorWithSymbols(formula, { varLoading: false, varReady: true }))
      .toBe("rgba(10,20,30,0.5)");
    expect(previewColorWithSymbols(formula, { varLoading: false, varReady: false }))
      .toBe("#ff0000");
    expect(previewColorWithSymbols(formula, { varLoading: true, varReady: false }))
      .toBe("#ffa500");
    expect(previewColorWithSymbols(formula, { varLoading: false })).toBeNull();
  });

  it("accepts only validated hex values from a local color string", () => {
    expect(previewColorWithSymbols("=ColorValue(varHex)", { varHex: "#369abc" }))
      .toBe("#369abc");
    expect(previewColorWithSymbols("=varHex", { varHex: "#abc" })).toBe("#abc");
    expect(previewColorWithSymbols("=varHex", { varHex: "url(https://example.com)" }))
      .toBeNull();
    expect(previewColorWithSymbols("=ColorValue(varHex)", { varHex: "red;background:evil" }))
      .toBeNull();
  });

  it("distinguishes known and unresolved display modes for visual state", () => {
    expect(previewDisplayMode(undefined)).toBe("edit");
    expect(previewDisplayMode("=DisplayMode.Disabled")).toBe("disabled");
    expect(previewDisplayMode("=DisplayMode.View")).toBe("view");
    expect(previewDisplayMode("=If(varReady, DisplayMode.Edit, DisplayMode.Disabled)", { varReady: true }))
      .toBe("edit");
    expect(previewDisplayMode("=If(varReady, DisplayMode.Edit, DisplayMode.Disabled)", { varReady: false }))
      .toBe("disabled");
    expect(previewDisplayMode("=If(varReady, DisplayMode.Edit, DisplayMode.Disabled)", {}))
      .toBe("unresolved");
  });


  it("recognizes only explicit Canvas border style enums", () => {
    expect(previewBorderStyle("=BorderStyle.Dashed")).toBe("dashed");
    expect(previewBorderStyle("= BorderStyle.Dotted ")).toBe("dotted");
    expect(previewBorderStyle("=BorderStyle.Solid")).toBe("solid");
    expect(previewBorderStyle("=BorderStyle.None")).toBe("none");
    expect(previewBorderStyle("=If(varReady, BorderStyle.Dashed, BorderStyle.None)")).toBeNull();
    expect(previewBorderStyle("=varBorderStyle")).toBeNull();
    expect(previewBorderStyle("=BorderStyle.Unknown")).toBeNull();
  });

});


describe("local OnSelect preview safety gate", () => {
  const action = (properties: Record<string, unknown> = {}) =>
    control("Classic/Button@2.2.0", { OnSelect: "=Set(clicked, true)", ...properties });

  it("permits explicit local behavior only with confirmed visibility and edit mode", () => {
    expect(previewSelectionBehaviorGate(action(), {})).toBe("allowed");
    expect(previewSelectionBehaviorGate(action({ Visible: "=varReady" }), { varReady: true }))
      .toBe("allowed");
    expect(previewSelectionBehaviorGate(action({ DisplayMode: "=DisplayMode.Disabled" }), {}))
      .toBe("display-mode-unverified");
  });

  it("blocks unknown or hidden Visible, including unverified ancestors", () => {
    expect(previewSelectionBehaviorGate(action({ Visible: "=varAuthorized" }), {}))
      .toBe("visibility-unverified");
    expect(previewSelectionBehaviorGate(action({ Visible: "=false" }), {}))
      .toBe("visibility-unverified");
    expect(previewSelectionBehaviorGate(action(), {}, { ancestorVisibilityUnknown: true }))
      .toBe("visibility-unverified");
    expect(previewSelectionBehaviorGate(action({ Visible: "=varAuthorized" }), { varAuthorized: true },
      { ancestorVisibilityUnknown: true })).toBe("visibility-unverified");
  });

  it("never treats unknown gallery records as permission to simulate actions", () => {
    expect(previewSelectionBehaviorGate(action(), {}, { runtimeGalleryStateUnknown: true }))
      .toBe("gallery-unverified");
    expect(previewSelectionBehaviorGate(action(), {}, { galleryRecordsUnknown: true }))
      .toBe("gallery-unverified");
  });

  it("keeps a simulated local variable from overriding unknown ancestor visibility", () => {
    expect(previewSelectionBehaviorGate(action({ Visible: "=varLocalReady" }),
      { varLocalReady: true }, { ancestorVisibilityUnknown: true }))
      .toBe("visibility-unverified");
  });
});

describe("Canvas container DropShadow source parsing", () => {
  it("recognizes only explicit supported Power Fx enum values", () => {
    for (const level of ["None", "Light", "Semilight", "Regular", "Semibold", "Bold", "ExtraBold"]) {
      expect(previewDropShadow("=DropShadow." + level)).toBe(level.toLowerCase());
    }
    expect(previewDropShadow("= DropShadow.Regular ")).toBe("regular");
  });

  it("does not infer a shadow from runtime-dependent or unsupported formulas", () => {
    expect(previewDropShadow("=varShadow")).toBeNull();
    expect(previewDropShadow("=If(varReady, DropShadow.Bold, DropShadow.None)")).toBeNull();
    expect(previewDropShadow("=DropShadow.Unknown")).toBeNull();
    expect(previewDropShadow('="Bold"')).toBeNull();
    expect(previewDropShadowFilter("=varShadow")).toBeUndefined();
  });

  it("keeps None unshadowed and uses fixed, source-independent CSS filters", () => {
    expect(previewDropShadowFilter("=DropShadow.None")).toBeUndefined();
    expect(previewDropShadowFilter("=DropShadow.Light")).toContain("drop-shadow(");
    expect(previewDropShadowFilter("=DropShadow.Bold")).toContain("drop-shadow(");
    expect(previewDropShadowFilter("=DropShadow.Bold")).not.toContain("var(");
  });
});
