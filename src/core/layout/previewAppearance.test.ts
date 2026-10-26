import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import {
  isDefinitelyHidden, previewVisibility, previewCanRunOnSelect, previewBorderStyle, previewDropShadow, previewDropShadowFilter, previewColor, previewColorWithSymbols, previewDisplayMode, previewFontFamily, PREVIEW_DEFAULT_FONT, previewFontSize, previewFontWeight,
  previewHorizontalAlign, previewCheckedState, previewIsChecked, previewItalic, previewKind,
  previewInputContent, previewSelectContent, previewText, previewTextDecoration, previewVerticalAlign, previewSelectionBehaviorGate
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

  it("classifies the documented ModernText control as display text, not an input", () => {
    expect(previewKind("ModernText@1.0.0")).toBe("label");
    expect(previewKind("ModernText")).toBe("label");
    expect(previewKind("ModernTextInput@1.0.0")).toBe("input");
    expect(previewKind("Classic/TextInput@2.3.2")).toBe("input");
    expect(previewKind("SomeOtherText@1.0.0")).toBe("unknown");
  });

  it("preserves explicit font size and uses the documented ModernText default", () => {
    expect(previewFontSize(control("ModernText@1.0.0"))).toBe(15);
    expect(previewFontSize(control("ModernText@1.0.0", { Size: "=22" }))).toBe(22);
    expect(previewFontSize(control("ModernText@1.0.0", { FontSize: "=18" }))).toBe(18);
    expect(previewFontSize(control("Classic/Label@2.5.1"))).toBe(14);
    expect(previewFontSize(control("ModernText@1.0.0", { Size: "=varRuntimeSize" }))).toBe(15);
  });

  it("uses logical functions for verified visibility and checkbox defaults", () => {
    expect(previewVisibility(control("Classic/Button@2.2.0", { Visible: "=Not(false)" })))
      .toBe("visible");
    expect(previewVisibility(control("Classic/Button@2.2.0", { Visible: "=And(false, varSqlAccess)" })))
      .toBe("hidden");
    expect(previewVisibility(control("Classic/Button@2.2.0", { Visible: "=Or(false, varSqlAccess)" })))
      .toBe("unknown");
    expect(previewVisibility(control("Classic/Button@2.2.0", { Visible: "=Not(true, false)" })))
      .toBe("unknown");
    expect(previewCheckedState(control("Classic/CheckBox@2.1.0", { Default: "=Not(false)" })))
      .toBe("checked");
  });

  it("only paints statically known colors", () => {
    expect(previewColor("=Color.White")).toBe("#ffffff");
    expect(previewColor("=Color.Transparent")).toBe("transparent");
    expect(previewColor('=ColorValue("#abcdef")')).toBe("#abcdef");
    expect(previewColor("=RGBA(1, 2, 3, 0.5)")).toBe("rgba(1,2,3,0.5)");
    expect(previewColor("=If(varDark, Color.Black, Color.White)")).toBeNull();
    expect(previewColor('=ColorValue("url(https://test.example)")')).toBeNull();
  });

  it("resolves constant Canvas color If branches without viewport symbols", () => {
    expect(previewColorWithSymbols("=If(true, Color.Red, Color.Blue)")).toBe("#ff0000");
    expect(previewColorWithSymbols("=If(false, Color.Red, Color.Blue)")).toBe("#0000ff");
    expect(previewColorWithSymbols(
      "=If(false, Color.Red, true, Color.Green, Color.Black)"
    )).toBe("#008000");
  });

  it("resolves nested conditional colors and selected RGBA values without runtime symbols", () => {
    expect(previewColorWithSymbols(
      '=If(true, If(false, Color.Red, ColorValue("#123456")), Color.Blue)'
    )).toBe("#123456");
    expect(previewColorWithSymbols(
      "=If(true, RGBA(10,20,30,0.5), Color.Black)"
    )).toBe("rgba(10,20,30,0.5)");
  });

  it("keeps unknown security conditions and unsupported color values unresolved", () => {
    expect(previewColorWithSymbols("=If(varAuthorized, Color.Green, Color.Red)")).toBeNull();
    expect(previewColorWithSymbols(
      "=If(false, Color.Red, varAuthorized, Color.Blue, Color.Black)"
    )).toBeNull();
    expect(previewColorWithSymbols('=If(true, "Color.Red", Color.White)')).toBeNull();
    expect(previewColorWithSymbols(
      '=If(true, ColorValue("javascript:alert(1)"), Color.White)'
    )).toBeNull();
    expect(previewColorWithSymbols("=If(varAuthorized, Color.Green, Color.Red)", {
      varAuthorized: true
    })).toBe("#008000");
  });

  it("propagates verified percentage RGBA colors into the visual preview", () => {
    expect(previewColor("=RGBA(10, 20, 30, 75%)")).toBe("rgba(10,20,30,0.75)");
    expect(previewColorWithSymbols("=If(varReady, RGBA(10,20,30,100%), Color.Red)",
      { varReady: true })).toBe("rgba(10,20,30,1)");
    expect(previewColorWithSymbols("=If(varReady, RGBA(10,20,30,101%), Color.Red)",
      { varReady: true })).toBeNull();
  });

  it("does not represent invalid RGBA formulas as known fill colors", () => {
    for (const source of [
      "=RGBA(300, 0, 0, 1)", "=RGBA(10, 20, 30, 150%)",
      "=RGBA(10, 20, 30, 2)", "=RGBA(10, 20, 30, -1)"
    ]) {
      expect(previewColor(source)).toBeNull();
    }
  });

  it("accepts only complete hexadecimal CSS colors in source formulas", () => {
    for (const hex of ["#abc", "#abcd", "#abcdef", "#abcdef80"]) {
      expect(previewColor('=ColorValue("' + hex + '")')).toBe(hex);
      expect(previewColor('="' + hex + '"')).toBe(hex);
    }
    for (const hex of ["#ab", "#abcde", "#abcdef0", "#abcdef012", "#zzzzzz"]) {
      expect(previewColor('=ColorValue("' + hex + '")')).toBeNull();
      expect(previewColor('="' + hex + '"')).toBeNull();
    }
    // Single quotes denote quoted identifiers in Power Fx, not text literals.
    expect(previewColor("=ColorValue('#abcdef')")).toBeNull();
  });

  it("rejects malformed local-only color values without executing formulas", () => {
    for (const hex of ["#12345", "#1234567", "#123456789"]) {
      expect(previewColorWithSymbols("=ColorValue(localColor)", { localColor: hex }))
        .toBeNull();
      expect(previewColorWithSymbols("=localColor", { localColor: hex }))
        .toBeNull();
    }
    expect(previewColorWithSymbols("=ColorValue(localColor)", { localColor: "#abcdef80" }))
      .toBe("#abcdef80");
  });

  it("does not make up dynamic labels", () => {
    expect(previewText(control("Label", { Text: '="Welcome"' }))).toBe("Welcome");
    expect(previewText(control("Label", { Text: "=varTitle" }))).toBeNull();
    expect(previewText(control("TextInput", { HintText: '="Search"' }))).toBe("Search");
    expect(previewFontSize(control("Label", { Size: "=72" }))).toBe(72);
  });

  it("shows HintText only when a text input is provably blank", () => {
    const type = "Classic/TextInput@2.3.2";
    const hint = { HintText: '="Search records"' };
    expect(previewText(control(type, hint))).toBe("Search records");
    expect(previewText(control(type, { ...hint, Default: '=""' }))).toBe("Search records");
    expect(previewText(control(type, { ...hint, Default: '="Known value"' }))).toBe("Known value");
    expect(previewText(control(type, { ...hint, Default: '=""', Value: '=varLiveValue' })))
      .toBe("Search records");
    expect(previewText(control(type, { Default: '=""' }))).toBe("");
  });

  it("never paints an input hint as an observed runtime value", () => {
    for (const type of ["Classic/TextInput@2.3.2", "ModernTextInput@1.0.0"]) {
      const hint = { HintText: '="Search records"' };
      expect(previewText(control(type, { ...hint, Default: "=varRuntimeText" }))).toBeNull();
      expect(previewText(control(type, { ...hint, Value: "=RemoteRecord.Title" }))).toBeNull();
      expect(previewText(control(type, {
        ...hint, Default: "=varRuntimeText", Value: '="Fallback should not override Default"'
      }))).toBeNull();
    }
  });

  it("resolves modern Placeholder separately from classic HintText", () => {
    const modern = control("ModernTextInput@1.0.0", {
      Default: '=""', Placeholder: '="Find items"'
    });
    const classic = control("Classic/TextInput@2.3.2", {
      Default: '=""', HintText: '="Find records"'
    });
    expect(previewInputContent(modern)).toEqual({ text: "Find items", state: "hint" });
    expect(previewText(modern)).toBe("Find items");
    expect(previewInputContent(classic)).toEqual({ text: "Find records", state: "hint" });
  });

  it("shows a local hint only for a verified empty Default, never unknown SQL", () => {
    const input = control("ModernTextInput@1.0.0", {
      Default: "=varSearch", Placeholder: '="Search local data"'
    });
    expect(previewInputContent(input)).toEqual({ text: null, state: "unknown" });
    expect(previewInputContent(input, { varSearch: "" }))
      .toEqual({ text: "Search local data", state: "hint" });
    expect(previewInputContent(input, { varSearch: "Ready" }))
      .toEqual({ text: "Ready", state: "value" });
    expect(previewInputContent(input, { varSearch: false }))
      .toEqual({ text: null, state: "unknown" });
    expect(previewInputContent(control("ModernTextInput@1.0.0", {
      Default: "=SqlRecord.Name", Placeholder: '="Search"'
    }), { varSearch: "" })).toEqual({ text: null, state: "unknown" });
  });

  it("keeps missing and unresolved hints distinct from confirmed empty text", () => {
    const modern = "ModernTextInput@1.0.0";
    expect(previewInputContent(control(modern, { Default: '=""' })))
      .toEqual({ text: "", state: "empty" });
    expect(previewInputContent(control(modern, {
      Default: '=""', Placeholder: "=varHint"
    }))).toEqual({ text: null, state: "unknown" });
    expect(previewInputContent(control(modern, {
      Default: '=""', Placeholder: "=varHint"
    }), { varHint: "Enter name" }))
      .toEqual({ text: "Enter name", state: "hint" });
    expect(previewInputContent(control(modern, {
      Default: '="Default wins"', Value: '="Ignored"', Placeholder: '="Ignored"'
    }))).toEqual({ text: "Default wins", state: "value" });
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

  it("accepts source Font enum trivia without changing the selected family", () => {
    expect(previewFontFamily(control("Label", {
      Font: "=Font /* font namespace */ . Arial // trailing comment"
    }))).toBe("Arial,sans-serif");
    expect(previewFontFamily(control("Label", {
      Font: "=Font. /* quoted family */ 'Courier New'"
    }))).toBe('"Courier New",monospace');
  });

  it("selects commented Font enum branches only from verified viewports", () => {
    const label = control("Label", {
      Font: "=If(App.Width < 720, Font /* mobile */ . Verdana, Font.'Courier New')"
    });
    expect(previewFontFamily(label, { "App.Width": 390 })).toBe("Verdana,sans-serif");
    expect(previewFontFamily(label, { "App.Width": 1366 }))
      .toBe('"Courier New",monospace');
    expect(previewFontFamily(label)).toBe(PREVIEW_DEFAULT_FONT);
  });

  it("rejects Font lookalike strings, operators and malformed comments", () => {
    for (const font of [
      '="Font.Arial"',
      '=Font.Arial & "extra"',
      '=Font /* unterminated',
      "=Font.'Courier'' New'"
    ]) {
      expect(previewFontFamily(control("Label", { Font: font })))
        .toBe(PREVIEW_DEFAULT_FONT);
    }
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

  it("recognizes documented Justify and Lighter enums without guessing arbitrary members", () => {
    expect(previewHorizontalAlign(control("ModernText@1.0.0", {
      Align: "=Align.Justify"
    }))).toBe("justify");
    expect(previewFontWeight(control("ModernText@1.0.0", {
      FontWeight: "=FontWeight.Lighter"
    }))).toBe(300);
    expect(previewFontWeight(control("ModernText@1.0.0", {
      FontWeight: "=FontWeight.Semibold"
    }))).toBe(600);
  });

  it("rejects unrelated Power Fx namespaces and bare identifiers as style enums", () => {
    expect(previewHorizontalAlign(control("Label", { Align: "=User.Right" }))).toBeNull();
    expect(previewHorizontalAlign(control("Label", { Align: "=Right" }))).toBeNull();
    expect(previewHorizontalAlign(control("Label", { Align: '="Align.Right"' }))).toBeNull();
    expect(previewVerticalAlign(control("Label", { VerticalAlign: "=App.Top" }))).toBeNull();
    expect(previewVerticalAlign(control("Label", { VerticalAlign: "=Top" }))).toBeNull();
    expect(previewFontWeight(control("Label", { FontWeight: "=Theme.Bold" }))).toBeUndefined();
    expect(previewFontWeight(control("Label", { FontWeight: "=Bold" }))).toBeUndefined();
    expect(previewFontWeight(control("Label", { FontWeight: "=If(varReady, FontWeight.Bold, FontWeight.Normal)" })))
      .toBeUndefined();
  });

  it("resolves multi-condition typography enums at verified phone, tablet and desktop widths", () => {
    const responsive = control("ModernText@1.0.0", {
      Align: "=If(App.Width < 600, Align.Left, App.Width < 1000, Align.Center, Align.Right)",
      VerticalAlign: "=If(App.Width < 600, VerticalAlign.Top, App.Width < 1000, VerticalAlign.Middle, VerticalAlign.Bottom)",
      FontWeight: "=If(App.Width < 600, FontWeight.Normal, App.Width < 1000, FontWeight.Semibold, FontWeight.Bold)"
    });
    const phone = { "App.Width": 390 };
    const tablet = { "App.Width": 768 };
    const desktop = { "App.Width": 1366 };
    expect(previewHorizontalAlign(responsive, phone)).toBe("start");
    expect(previewHorizontalAlign(responsive, tablet)).toBe("middle");
    expect(previewHorizontalAlign(responsive, desktop)).toBe("end");
    expect(previewVerticalAlign(responsive, phone)).toBe("top");
    expect(previewVerticalAlign(responsive, tablet)).toBe("middle");
    expect(previewVerticalAlign(responsive, desktop)).toBe("bottom");
    expect(previewFontWeight(responsive, phone)).toBe(400);
    expect(previewFontWeight(responsive, tablet)).toBe(600);
    expect(previewFontWeight(responsive, desktop)).toBe(700);
    expect(previewHorizontalAlign(responsive)).toBeNull();
  });

  it("resolves only the selected nested If branch, without assuming unknown runtime state", () => {
    const nested = control("Label", {
      Align: "=If(App.Width < 720, If(varCentered, Align.Center, Align.Left), Align.Right)",
      FontWeight: "=If(App.Width < 720, FontWeight.Bold, If(App.Width < 1000, FontWeight.Semibold, FontWeight.Normal))"
    });
    expect(previewHorizontalAlign(nested, { "App.Width": 390, varCentered: true })).toBe("middle");
    expect(previewHorizontalAlign(nested, { "App.Width": 390, varCentered: false })).toBe("start");
    expect(previewHorizontalAlign(nested, { "App.Width": 390 })).toBeNull();
    expect(previewHorizontalAlign(nested, { "App.Width": 1366 })).toBe("end");
    expect(previewFontWeight(nested, { "App.Width": 390 })).toBe(700);
    expect(previewFontWeight(nested, { "App.Width": 800 })).toBe(600);
    expect(previewFontWeight(nested, { "App.Width": 1366 })).toBe(400);
  });

  it("rejects lookalike strings, wrong namespaces and unverified multi-branch conditions", () => {
    const symbols = { "App.Width": 390 };
    expect(previewHorizontalAlign(control("Label", {
      Align: '=If(App.Width < 720, "Align.Right", Align.Left)'
    }), symbols)).toBeNull();
    expect(previewVerticalAlign(control("Label", {
      VerticalAlign: "=If(App.Width < 720, Other.Top, VerticalAlign.Bottom)"
    }), symbols)).toBeNull();
    expect(previewFontWeight(control("Label", {
      FontWeight: "=If(varPermission, FontWeight.Bold, App.Width < 720, FontWeight.Semibold, FontWeight.Normal)"
    }), symbols)).toBeUndefined();
    expect(previewHorizontalAlign(control("Label", {
      Align: "=If(App.Width < 720, Align.Left)"
    }), { "App.Width": 1366 })).toBeNull();
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


  it("does not treat text that resembles DisplayMode.Edit as an editable enum", () => {
    const action = (displayMode: string) => control("Classic/Button@2.2.0", {
      OnSelect: "=Set(clicked, true)", DisplayMode: displayMode
    });
    for (const expression of [
      '="DisplayMode.Edit"',
      '=If(true, "DisplayMode.Edit", DisplayMode.Disabled)',
      '=If(false, DisplayMode.Disabled, "DisplayMode.Edit")',
      '=If(true, "DisplayMode." & "Edit", DisplayMode.Disabled)',
      "=Connector.DisplayMode()"
    ]) {
      expect(previewDisplayMode(expression)).toBe("unresolved");
      expect(previewCanRunOnSelect(action(expression))).toBe(false);
      expect(previewSelectionBehaviorGate(action(expression), {}))
        .toBe("display-mode-unverified");
    }
    expect(previewDisplayMode("=localMode", { localMode: "DisplayMode.Edit" }))
      .toBe("unresolved");
    expect(previewCanRunOnSelect(action("=localMode"),
      { localMode: "DisplayMode.Edit" })).toBe(false);
  });

  it("resolves only source enum branches under verified local and viewport conditions", () => {
    const responsive = "=If(App.Width < 600, DisplayMode.Disabled, " +
      "App.Width < 1000, DisplayMode.View, DisplayMode.Edit)";
    expect(previewDisplayMode(responsive, { "App.Width": 390 })).toBe("disabled");
    expect(previewDisplayMode(responsive, { "App.Width": 768 })).toBe("view");
    expect(previewDisplayMode(responsive, { "App.Width": 1366 })).toBe("edit");
    expect(previewDisplayMode(responsive)).toBe("unresolved");
    expect(previewDisplayMode("=If(true, DisplayMode.Edit, \"DisplayMode.Disabled\")"))
      .toBe("edit");
    expect(previewDisplayMode("=If(true, If(false, DisplayMode.Edit, DisplayMode.View), DisplayMode.Disabled)"))
      .toBe("view");
    expect(previewDisplayMode("=If(varAuthorized, DisplayMode.Edit, DisplayMode.Disabled)"))
      .toBe("unresolved");
    expect(previewDisplayMode("=If(false, DisplayMode.Edit)")).toBe("unresolved");
    expect(previewDisplayMode("=If(true, DisplayMode.Edit, )")).toBe("unresolved");
  });

  it("resolves responsive Canvas BorderStyle only from verified If branches", () => {
    const formula = "=If(App.Width < 600, BorderStyle.None, App.Width < 1000, BorderStyle.Dotted, BorderStyle.Dashed)";
    expect(previewBorderStyle(formula, { "App.Width": 390 })).toBe("none");
    expect(previewBorderStyle(formula, { "App.Width": 820 })).toBe("dotted");
    expect(previewBorderStyle(formula, { "App.Width": 1366 })).toBe("dashed");
    expect(previewBorderStyle("=If(varReady, BorderStyle.Solid, BorderStyle.None)",
      { varReady: true })).toBe("solid");
    expect(previewBorderStyle("=If(App.Width < 600, BorderStyle.None, If(App.Width < 1000, BorderStyle.Dotted, BorderStyle.Solid))",
      { "App.Width": 900 })).toBe("dotted");
  });

  it("keeps unresolved or invalid BorderStyle conditions and text unverified", () => {
    expect(previewBorderStyle("=If(varSqlPermission, BorderStyle.None, BorderStyle.Solid)",
      { "App.Width": 390 })).toBeNull();
    expect(previewBorderStyle('=If(App.Width < 600, "BorderStyle.None", BorderStyle.Solid)',
      { "App.Width": 390 })).toBeNull();
    expect(previewBorderStyle("=If(App.Width < 600, BorderStyle.Invalid, BorderStyle.Solid)",
      { "App.Width": 390 })).toBeNull();
    expect(previewBorderStyle("=If(App.Width < 600, BorderStyle.None, BorderStyle.Solid)",
      {})).toBeNull();
    expect(previewBorderStyle("=If(App.Width < 600, BorderStyle.None, BorderStyle.Solid)"))
      .toBeNull();
  });

  it("parses enum literals with Power Fx comments without treating text as enums", () => {
    // Comments and whitespace are trivia in a serialized .pa.yaml formula.
    expect(previewDisplayMode("=DisplayMode.Disabled // note")).toBe("disabled");
    expect(previewDisplayMode("= DisplayMode /* note */ . Edit")).toBe("edit");
    expect(previewBorderStyle("=BorderStyle.Dotted /* design note */")).toBe("dotted");
    expect(previewDropShadow("=DropShadow.Bold // design note")).toBe("bold");
    expect(previewDisplayMode("=If(true, DisplayMode.View /* note */, DisplayMode.Edit)"))
      .toBe("view");

    // Quoted strings, extra operators, invalid members and broken comments
    // must never become verified Power Fx enum values.
    expect(previewDisplayMode('="DisplayMode.Edit" // text')).toBe("unresolved");
    expect(previewDisplayMode('=DisplayMode.Edit & "text"')).toBe("unresolved");
    expect(previewDisplayMode("=DisplayMode.Edit /* unterminated")).toBe("unresolved");
    expect(previewBorderStyle('="BorderStyle.Dotted"')).toBeNull();
    expect(previewDropShadow("=DropShadow.Unsupported // not an enum")).toBeNull();
  });

  it("permits local OnSelect only when commented DisplayMode.Edit is verified", () => {
    const action = (mode: string) => control("Classic/Button@2.2.0", {
      OnSelect: "=Set(clicked, true)", DisplayMode: mode
    });
    expect(previewCanRunOnSelect(action("=DisplayMode.Edit // verified enum"))).toBe(true);
    expect(previewCanRunOnSelect(action('="DisplayMode.Edit" // text'))).toBe(false);
    expect(previewCanRunOnSelect(action("=DisplayMode.Disabled /* verified */"))).toBe(false);
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

describe("verified responsive container DropShadow", () => {
  it("selects only source enum values from verified phone, tablet and desktop conditions", () => {
    const source = "=If(App.Width < 720, DropShadow.None, App.Width < 1024, DropShadow.Light, DropShadow.Bold)";
    expect(previewDropShadow(source, { "App.Width": 390 })).toBe("none");
    expect(previewDropShadow(source, { "App.Width": 800 })).toBe("light");
    expect(previewDropShadow(source, { "App.Width": 1366 })).toBe("bold");
    expect(previewDropShadowFilter(source, { "App.Width": 390 })).toBeUndefined();
    expect(previewDropShadowFilter(source, { "App.Width": 800 }))
      .toContain("drop-shadow(0px 1px 2px");
    expect(previewDropShadowFilter(source, { "App.Width": 1366 }))
      .toContain("drop-shadow(0px 6px 12px");
  });

  it("rejects unverified conditions, string lookalikes and unsupported shadow branches", () => {
    const source = "=If(varCanShow, DropShadow.Bold, DropShadow.None)";
    expect(previewDropShadow(source)).toBeNull();
    expect(previewDropShadow(source, { "App.Width": 390 })).toBeNull();
    expect(previewDropShadow(source, { varCanShow: true })).toBe("bold");
    expect(previewDropShadow(source, { varCanShow: false })).toBe("none");
    expect(previewDropShadow('=If(App.Width < 720, "DropShadow.Bold", DropShadow.None)',
      { "App.Width": 390 })).toBeNull();
    expect(previewDropShadow('=If(App.Width < 720, DropShadow.Unknown, DropShadow.Light)',
      { "App.Width": 390 })).toBeNull();
    expect(previewDropShadow('=If(App.Width < 720, DropShadow.Light)',
      { "App.Width": 1366 })).toBeNull();
    expect(previewDropShadow('=If(App.Width < 720, If(varRuntime, DropShadow.Bold, DropShadow.Light), DropShadow.None)',
      { "App.Width": 390 })).toBeNull();
  });
});

describe("verified responsive Canvas typography", () => {
  const text = control("ModernText@1.0.0", {
    Align: "=If(App.Width < 720, Align.Center, Align.Right)",
    VerticalAlign: "=If(App.Width < 720, VerticalAlign.Top, VerticalAlign.Bottom)",
    FontWeight: "=If(App.Width < 720, FontWeight.Bold, FontWeight.Normal)",
    Italic: "=App.Width < 720",
    Underline: "=App.Width < 720",
    Strikethrough: "=App.Width >= 720"
  });

  it("resolves alignment, weight and emphasis from verified viewport dimensions", () => {
    const phone = { "App.Width": 390 };
    const desktop = { "App.Width": 1366 };
    expect(previewHorizontalAlign(text, phone)).toBe("middle");
    expect(previewHorizontalAlign(text, desktop)).toBe("end");
    expect(previewVerticalAlign(text, phone)).toBe("top");
    expect(previewVerticalAlign(text, desktop)).toBe("bottom");
    expect(previewFontWeight(text, phone)).toBe(700);
    expect(previewFontWeight(text, desktop)).toBe(400);
    expect(previewItalic(text, phone)).toBe(true);
    expect(previewItalic(text, desktop)).toBe(false);
    expect(previewTextDecoration(text, phone)).toBe("underline");
    expect(previewTextDecoration(text, desktop)).toBe("line-through");
  });

  it("keeps runtime-only conditions and non-enum branches unresolved", () => {
    expect(previewHorizontalAlign(text)).toBeNull();
    expect(previewVerticalAlign(text)).toBeNull();
    expect(previewFontWeight(text)).toBeUndefined();
    expect(previewHorizontalAlign(control("Label", {
      Align: "=If(varAuthorized, Align.Right, Align.Left)"
    }), { "App.Width": 390 })).toBeNull();
    expect(previewFontWeight(control("Label", {
      FontWeight: '=If(App.Width < 720, "FontWeight.Bold", FontWeight.Normal)'
    }), { "App.Width": 390 })).toBeUndefined();
    expect(previewHorizontalAlign(control("Label", {
      Align: "=If(App.Width < 720, Align.Center, localString)"
    }), { "App.Width": 1366, localString: "Align.Right" })).toBeNull();
    expect(previewVerticalAlign(control("Label", {
      VerticalAlign: "=If(App.Width < 720, Other.Top, VerticalAlign.Bottom)"
    }), { "App.Width": 390 })).toBeNull();
    expect(previewItalic(control("Label", { Italic: "=varRuntimeItalic" }))).toBe(false);
    expect(previewTextDecoration(control("Label", { Underline: "=varRuntimeUnderline" })))
      .toBeUndefined();
  });
});

describe("source-only checkbox and toggle state", () => {
  it("does not mistake unknown runtime values for unchecked controls", () => {
    expect(previewCheckedState(control("Classic/CheckBox@2.1.0", {
      Default: "=varHasPermission"
    }))).toBe("unknown");
    expect(previewCheckedState(control("Modern/Checkbox@1.0.0", {
      Checked: "=ThisItem.Enabled"
    }))).toBe("unknown");
    expect(previewCheckedState(control("Modern/Toggle@1.0.0", {
      Checked: "=varIsOn"
    }), { "App.Width": 390 })).toBe("unknown");
  });

  it("uses verified local symbols and respects Checked over Default/Value", () => {
    const modern = control("Modern/Checkbox@1.0.0", {
      Checked: "=varEnabled", Default: "=true", Value: "=true"
    });
    expect(previewCheckedState(modern)).toBe("unknown");
    expect(previewCheckedState(modern, { varEnabled: false })).toBe("unchecked");
    expect(previewCheckedState(modern, { varEnabled: true })).toBe("checked");
    expect(previewCheckedState(control("Classic/Toggle@2.1.0", {
      Default: "=false", Value: "=true"
    }))).toBe("unchecked");
  });

  it("retains known literals and a conservative omitted-property fallback", () => {
    expect(previewCheckedState(control("Classic/CheckBox@2.1.0", {
      Default: "=true"
    }))).toBe("checked");
    expect(previewCheckedState(control("Classic/Toggle@2.1.0", {
      Default: "=false"
    }))).toBe("unchecked");
    expect(previewCheckedState(control("Classic/Toggle@2.1.0"))).toBe("unchecked");
  });
});


describe("verified viewport-dependent Canvas Font families", () => {
  const font = control("Classic/Label@2.5.1", {
    Font: "=If(App.Width < 720, Font.'Courier New', Font.Georgia)"
  });

  it("selects a supported family for each known viewport", () => {
    expect(previewFontFamily(font, { "App.Width": 390 })).toBe('"Courier New",monospace');
    expect(previewFontFamily(font, { "App.Width": 1366 })).toBe("Georgia,serif");
    expect(previewFontFamily(font)).toBe(PREVIEW_DEFAULT_FONT);
  });

  it("supports a nested pure If and refuses unknown runtime conditions", () => {
    const nested = control("Label", {
      Font: "=If(App.Width < 720, If(Parent.Width < 400, Font.Arial, Font.Verdana), Font.Georgia)"
    });
    expect(previewFontFamily(nested, { "App.Width": 390, "Parent.Width": 300 }))
      .toBe("Arial,sans-serif");
    expect(previewFontFamily(nested, { "App.Width": 390, "Parent.Width": 600 }))
      .toBe("Verdana,sans-serif");
    expect(previewFontFamily(nested, { "App.Width": 390 })).toBe(PREVIEW_DEFAULT_FONT);
    expect(previewFontFamily(control("Label", {
      Font: "=If(varHasAccess, Font.Arial, Font.Georgia)"
    }), { "App.Width": 390 })).toBe(PREVIEW_DEFAULT_FONT);
  });

  it("rejects lookalike strings and unrecognized selected branches", () => {
    expect(previewFontFamily(control("Label", {
      Font: '=If(App.Width < 720, "Font.Arial", Font.Georgia)'
    }), { "App.Width": 390 })).toBe(PREVIEW_DEFAULT_FONT);
    expect(previewFontFamily(control("Label", {
      Font: "=If(App.Width < 720, Font.NotInstalled, Font.Georgia)"
    }), { "App.Width": 390 })).toBe(PREVIEW_DEFAULT_FONT);
    expect(previewFontFamily(control("Label", {
      Font: "=If(App.Width < 720, Font.Arial, Font.Georgia)"
    }), { "App.Width": 1366 })).toBe("Georgia,serif");
  });
});

describe("source-only Canvas selection state", () => {
  it("does not substitute a placeholder or deprecated Default for unresolved ComboBox records", () => {
    const combo = control("Classic/ComboBox@2.4.0", {
      Items: "=SQLCatalog",
      DefaultSelectedItems: "=Filter(SQLCatalog, IsSelected)",
      Default: '="Stale fallback"',
      InputTextPlaceholder: '="Find a record"'
    });
    expect(previewSelectContent(combo)).toEqual({ text: null, state: "unknown" });
    expect(previewSelectContent(combo, { "App.Width": 390 }))
      .toEqual({ text: null, state: "unknown" });
    expect(previewText(combo)).toBeNull();
  });

  it("does not infer the first dropdown record from Items alone", () => {
    const dropdown = control("ModernDropdown@1.0.0", { Items: "=SQLCatalog" });
    expect(previewSelectContent(dropdown)).toEqual({ text: null, state: "unknown" });
    expect(previewSelectContent(control("Classic/DropDown@2.3.1")))
      .toEqual({ text: "", state: "empty" });
  });

  it("distinguishes a known initial value, an empty default and a verified hint", () => {
    const dropdown = control("ModernDropdown@1.0.0", {
      Default: '=If(App.Width < 720, "Phone", "Desktop")',
      Items: "=SQLCatalog"
    });
    expect(previewSelectContent(dropdown, { "App.Width": 390 }))
      .toEqual({ text: "Phone", state: "value" });
    expect(previewSelectContent(dropdown, { "App.Width": 1366 }))
      .toEqual({ text: "Desktop", state: "value" });
    expect(previewSelectContent(dropdown)).toEqual({ text: null, state: "unknown" });
    expect(previewSelectContent(control("ModernComboBox@1.0.0", {
      Default: '=""', InputTextPlaceholder: '="Search"'
    }))).toEqual({ text: "Search", state: "hint" });
  });

  it("does not turn unknown SQL-dependent defaults into confirmed empty selections", () => {
    const dropdown = control("ModernDropdown@1.0.0", {
      Default: "=First(SQLCatalog).Name",
      InputTextPlaceholder: '="Select a value"'
    });
    expect(previewSelectContent(dropdown)).toEqual({ text: null, state: "unknown" });
    expect(previewSelectContent(control("ModernComboBox@1.0.0", {
      DefaultSelectedItems: "=Table()",
      InputTextPlaceholder: '="Select a value"'
    }))).toEqual({ text: null, state: "unknown" });
  });
});


describe("constant Power Fx visual enums without runtime symbols", () => {
  it("selects a known DropShadow branch without requiring App or local state", () => {
    expect(previewDropShadow("=If(true, DropShadow.Bold, DropShadow.None)")).toBe("bold");
    expect(previewDropShadowFilter("=If(true, DropShadow.Light, DropShadow.None)"))
      .toContain("drop-shadow(0px 1px 2px");
  });

  it("selects known false and nested DropShadow branches", () => {
    expect(previewDropShadow("=If(false, DropShadow.Bold, DropShadow.None)")).toBe("none");
    expect(previewDropShadow("=If(true, If(false, DropShadow.Bold, DropShadow.Regular), DropShadow.None)"))
      .toBe("regular");
  });

  it("never treats unknown runtime conditions or string lookalikes as shadows", () => {
    expect(previewDropShadow("=If(varSqlAccess, DropShadow.Bold, DropShadow.None)"))
      .toBeNull();
    expect(previewDropShadow('=If(true, "DropShadow.Bold", DropShadow.None)'))
      .toBeNull();
    expect(previewDropShadowFilter("=If(varSqlAccess, DropShadow.Bold, DropShadow.None)"))
      .toBeUndefined();
  });

  it("selects constant BorderStyle If branches without runtime symbols", () => {
    expect(previewBorderStyle("=If(true, BorderStyle.Dashed, BorderStyle.None)"))
      .toBe("dashed");
    expect(previewBorderStyle("=If(false, BorderStyle.Solid, true, BorderStyle.Dotted, BorderStyle.None)"))
      .toBe("dotted");
  });

  it("rejects unknown conditions and quoted BorderStyle impostors", () => {
    expect(previewBorderStyle("=If(varSqlAccess, BorderStyle.Solid, BorderStyle.None)"))
      .toBeNull();
    expect(previewBorderStyle('=If(true, "BorderStyle.Dashed", BorderStyle.None)'))
      .toBeNull();
  });
});
