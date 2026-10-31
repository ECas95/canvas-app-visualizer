import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../../types/canvas";
import { CanvasVisualControl } from "../../components/CanvasVisualControl";
import { PREVIEW_ICON_PATHS, previewIconName, previewIconRotation } from "./previewIcon";
import { buildCanvasModel } from "../model/normalize";

function renderIcon(
  icon: unknown, type = "Classic/Icon@2.5.0", color = "=Color.Red",
  extraProperties: Record<string, unknown> = {},
  symbols?: Record<string, string | number | boolean>
) {
  const control: CanvasControl = {
    id: "synthetic-icon", name: "SyntheticIcon",
    controlType: type, properties: { Icon: icon, Color: color, ...extraProperties }, children: [],
    sourceFile: "Src/Synthetic.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticIcon",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
  return renderToStaticMarkup(
    <svg><CanvasVisualControl control={control} x={10} y={20}
      width={64} height={40} clipId="synthetic-icon-clip"
      simulationSymbols={symbols} /></svg>
  );
}

describe("Source-derived Gallery row icon selection", () => {
  it("resolves typed Icon branches from known local ThisItem.Category", () => {
    const formula = '=Switch(ThisItem.Category, "Operations", Icon.Settings, "Reporting", Icon.Document, Icon.Information)';
    expect(previewIconName(formula, false, { "ThisItem.Category": "Operations" })).toBe("settings");
    expect(previewIconName(formula, false, { "ThisItem.Category": "Reporting" })).toBe("document");
    expect(previewIconName(formula, false, { "ThisItem.Category": "Other" })).toBe("information");
    expect(previewIconName(formula, false)).toBeNull();
    expect(renderIcon(formula, "Classic/Icon@2.5.0", "=Color.Red", {},
      { "ThisItem.Category": "Operations" }))
      .toContain('d="' + PREVIEW_ICON_PATHS.settings + '"');
  });

  it("keeps unsupported, mixed-type or runtime-dependent icon branches unknown", () => {
    const symbols = { "ThisItem.Category": "Operations" };
    for (const formula of [
      '=Switch(ThisItem.Category, varUnknown, Icon.Settings, Icon.Home)',
      '=Switch(ThisItem.Category, Icon.Home, Icon.Settings, Icon.Document)',
      '=Switch(ThisItem.Category, "Reporting", Icon.Document, varUnknown, Icon.Settings, Icon.Information)',
      '=Switch(ThisItem.Category, "Operations", Icon.AddressBook, Icon.Information)',
      '=Switch(Connector.GetCategory(), "Operations", Icon.Settings, Icon.Information)'
    ]) {
      // A known match must not run a connector, but can skip later unknown
      // alternatives. The malformed/unsupported selected branches fail.
      if (formula.includes('varUnknown, Icon.Settings, Icon.Information')) continue;
      expect(previewIconName(formula, false, symbols)).toBeNull();
    }
    expect(previewIconName(
      '=Switch(ThisItem.Category, "Operations", Icon.Settings, varUnknown, Icon.Information)',
      false, symbols
    )).toBe("settings");
    expect(previewIconName('=Switch(ThisItem.Category, "Operations", Icon.Settings)', false))
      .toBeNull();
  });

  it("provides common dashboard glyphs while keeping unsupported enum names unknown", () => {
    for (const name of ["Calendar", "Document", "Settings", "People",
      "List", "Information", "Warning", "Computer", "Folder", "Database", "Play", "Pause"]) {
      expect(previewIconName("=Icon." + name)).not.toBeNull();
    }
    expect(previewIconName("=Icon.DatabaseAdmin")).toBeNull();
  });
});

describe("Canvas source-only Icon enums", () => {
  it("resolves only supported complete classic enum literals", () => {
    expect(previewIconName("=Icon.Add")).toBe("add");
    expect(previewIconName("Icon.ChevronRight")).toBe("chevronright");
    expect(previewIconName("=icon.SEARCH")).toBe("search");
    expect(previewIconName("=Icon.None")).toBe("none");
    expect(previewIconName("=Icon.AddressBook")).toBeNull();
    expect(previewIconName("=If(flag, Icon.Add, Icon.Cancel)")).toBeNull();
    expect(previewIconName("=varIcon")).toBeNull();
  });

  it("accepts quoted Fluent names only on modern Icon controls", () => {
    expect(previewIconName('="Add"', true)).toBe("add");
    expect(previewIconName('="Search"', true)).toBe("search");
    expect(previewIconName('="Add"')).toBeNull();
    expect(previewIconName('=varFluentIcon', true)).toBeNull();
    expect(previewIconName('="UnrecognizedFluentIcon"', true)).toBeNull();
  });

  it("accepts Power Fx comments in classic and modern icon literals", () => {
    expect(previewIconName("=Icon /* note */ . Add // trailing")).toBe("add");
    expect(previewIconName("=Icon. /* note */ ChevronRight")).toBe("chevronright");
    expect(previewIconName("=Icon /* note */ . None")).toBe("none");
    expect(previewIconName('= /* note */ "Delete" // trailing', true)).toBe("trash");
    expect(previewIconName('= /* note */ "Add"', false)).toBeNull();
    expect(renderIcon("=Icon /* note */ . Add"))
      .toContain('d="' + PREVIEW_ICON_PATHS.add + '"');
  });

  it("resolves literal If conditions but keeps unknown runtime icons unresolved", () => {
    expect(previewIconName("=If(true, Icon.Add, Icon.Cancel)")).toBe("add");
    expect(previewIconName("=If(false, Icon.Add, Icon.Cancel)")).toBe("cancel");
    expect(previewIconName("=If(true, Icon /* note */ . Search, Icon.Home)"))
      .toBe("search");
    expect(previewIconName('=If(true, "Delete", "Check")', true)).toBe("trash");
    expect(previewIconName("=If(varCanRead, Icon.Add, Icon.Home)")).toBeNull();
  });

  it("rejects invalid icon expressions without guessing a glyph", () => {
    for (const formula of [
      "=Icon.Add /* unterminated", "=Icon.Add & Icon.Home",
      '="Icon.Add"', "=Icon.AddressBook", "=Icon.Add.Extra",
      "=If(true, Icon.Add, )", "=If(true, Icon.Add"
    ]) expect(previewIconName(formula)).toBeNull();
    expect(previewIconName('="Add" & "More"', true)).toBeNull();
    expect(previewIconName('=If(true, "Icon.Add", Icon.Home)')).toBeNull();
  });

  it("renders known SVG glyphs at the center without font-dependent symbols", () => {
    const html = renderIcon("=Icon.Add");
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('x="26" y="24" width="32" height="32"');
    expect(html).toContain('stroke="#ff0000"');
    expect(html).toContain('d="' + PREVIEW_ICON_PATHS.add + '"');
    expect(html).not.toContain(">◇<");
  });

  it("does not confuse similar names or invent a glyph for unknown runtime values", () => {
    const html = renderIcon("=Icon.AddressBook");
    expect(html).not.toContain('d="' + PREVIEW_ICON_PATHS.add + '"');
    expect(html).toContain(">?</tspan>");
    expect(renderIcon("=varIcon")).toContain(">?</tspan>");
  });

  it("renders Icon.None without a placeholder or an icon path", () => {
    const html = renderIcon("=Icon.None");
    expect(html).not.toContain('viewBox="0 0 24 24"');
    expect(html).not.toContain(">?</tspan>");
  });

  it("supports modern quoted icon names but does not execute formulas", () => {
    expect(renderIcon('="Check"', "Modern/Icon@1.0.0"))
      .toContain('d="' + PREVIEW_ICON_PATHS.check + '"');
    expect(renderIcon('=If(varAllowed, "Check", "Cancel")', "Modern/Icon@1.0.0"))
      .toContain(">?</tspan>");
  });
});


describe("Canvas Icon.Rotation source fidelity", () => {
  it("normalizes literal and arithmetic degree formulas without executing behavior", () => {
    expect(previewIconRotation("=90")).toBe(90);
    expect(previewIconRotation("=-45")).toBe(-45);
    expect(previewIconRotation("=360 + 90")).toBe(90);
    expect(previewIconRotation("=360")).toBe(0);
  });

  it("resolves only supplied viewport symbols", () => {
    const formula = "=If(App.Width < 600, 90, 0)";
    expect(previewIconRotation(formula, { "App.Width": 390 })).toBe(90);
    expect(previewIconRotation(formula, { "App.Width": 1366 })).toBe(0);
    expect(previewIconRotation(formula)).toBeNull();
  });

  it("keeps unknown, nonnumeric and malformed rotation formulas unresolved", () => {
    expect(previewIconRotation("=varRotation")).toBeNull();
    expect(previewIconRotation("=User().Email")).toBeNull();
    expect(previewIconRotation("=\"90deg\"")).toBeNull();
    expect(previewIconRotation("=1/0")).toBeNull();
    expect(previewIconRotation(undefined)).toBeNull();
  });

  it("rotates only the icon glyph around its own 24x24 viewBox center", () => {
    const html = renderIcon("=Icon.ArrowRight", "Classic/Icon@2.5.0",
      "=Color.Red", { Rotation: "=90", Fill: "=Color.White" });
    expect(html).toContain('d="' + PREVIEW_ICON_PATHS.arrowright + '" transform="rotate(90 12 12)"');
    expect(html).toContain('stroke="#ff0000"');
    expect(html).not.toContain('transform="rotate(90 42 40)"');
    expect((html.match(/transform="rotate\(/g) ?? [])).toHaveLength(1);
  });

  it("does not rotate when the formula is runtime-dependent or resolves to zero", () => {
    expect(renderIcon("=Icon.Add", "Classic/Icon@2.5.0", "=Color.Red",
      { Rotation: "=varRotation" })).not.toContain('transform="rotate(');
    expect(renderIcon("=Icon.Add", "Classic/Icon@2.5.0", "=Color.Red",
      { Rotation: "=If(App.Width < 600, 90, 0)" },
      { "App.Width": 1366 })).not.toContain('transform="rotate(');
    expect(renderIcon("=Icon.Add", "Classic/Icon@2.5.0", "=Color.Red",
      { Rotation: "=If(App.Width < 600, 90, 0)" },
      { "App.Width": 390 })).toContain('transform="rotate(90 12 12)"');
  });

  it("withholds the glyph when Rotation depends on unknown runtime state", () => {
    for (const rotation of [
      "=varRotation",
      "=If(varSqlAuthorized, 90, 0)",
      "=SQL.IconRotation",
      '="90deg"'
    ]) {
      const html = renderIcon("=Icon.ArrowRight", "Classic/Icon@2.5.0",
        "=Color.Red", { Rotation: rotation });
      expect(html).toContain('data-preview-icon-state="unknown"');
      expect(html).toContain("Icon rotation requires runtime state");
      expect(html).toContain(">?</tspan>");
      expect(html).not.toContain('d="' + PREVIEW_ICON_PATHS.arrowright + '"');
    }
  });

  it("keeps omitted Rotation at the Canvas default without fabricating uncertainty", () => {
    const html = renderIcon("=Icon.ArrowRight");
    expect(html).toContain('d="' + PREVIEW_ICON_PATHS.arrowright + '"');
    expect(html).not.toContain('data-preview-icon-state="unknown"');
    expect(html).not.toContain('transform="rotate(');
  });

  it("resolves responsive Rotation only for known viewport values", () => {
    const formula = "=If(App.Width < 720, 90, 0)";
    const props = { Rotation: formula };
    const phone = renderIcon("=Icon.ArrowRight", "Classic/Icon@2.5.0",
      "=Color.Red", props, { "App.Width": 390 });
    const desktop = renderIcon("=Icon.ArrowRight", "Classic/Icon@2.5.0",
      "=Color.Red", props, { "App.Width": 1366 });
    const unresolved = renderIcon("=Icon.ArrowRight", "Classic/Icon@2.5.0",
      "=Color.Red", props);
    expect(phone).toContain('d="' + PREVIEW_ICON_PATHS.arrowright + '" transform="rotate(90 12 12)"');
    expect(desktop).toContain('d="' + PREVIEW_ICON_PATHS.arrowright + '"');
    expect(desktop).not.toContain('transform="rotate(');
    expect(unresolved).toContain('data-preview-icon-state="unknown"');
    expect(unresolved).not.toContain('d="' + PREVIEW_ICON_PATHS.arrowright + '"');
  });

  it("preserves Rotation from a generic, versioned Canvas .pa.yaml fixture", () => {
    const yaml = [
      "Screens:",
      "  RotationScreen:",
      "    Children:",
      "      - TurnIcon:",
      "          Control: Classic/Icon@2.5.0",
      "          Properties:",
      "            Icon: =Icon.ArrowRight",
      "            Rotation: =90",
      "            Width: =64",
      "            Height: =40"
    ].join("\n");
    const model = buildCanvasModel([{
      path: "Src/SyntheticRotation.pa.yaml", name: "SyntheticRotation.pa.yaml",
      content: yaml, origin: "yaml", format: "pa-yaml-v3"
    }], "yaml");
    expect(model.screens).toHaveLength(1);
    const control = model.screens[0].children[0];
    expect(control.properties.Rotation).toBe("=90");
    const html = renderToStaticMarkup(<svg><CanvasVisualControl
      control={control} x={10} y={20} width={64} height={40}
      clipId="fixture-icon-clip" /></svg>);
    expect(html).toContain('transform="rotate(90 12 12)"');
  });
});


describe("versioned ModernIcon .pa.yaml source fidelity", () => {
  it.each(["ModernIcon@1.1.0", "Modern/Icon@1.0.0"])(
    "renders a Fluent string icon with IconColor for %s", type => {
      const html = renderIcon('="Add"', type, "=Color.Blue", {
        IconColor: "=Color.Red"
      });
      expect(html).toContain('d="' + PREVIEW_ICON_PATHS.add + '"');
      expect(html).toContain('stroke="#ff0000"');
      expect(html).not.toContain(">?</tspan>");
    }
  );

  it("maps documented modern Fluent Delete without changing classic enum rules", () => {
    expect(previewIconName('="Delete"', true)).toBe("trash");
    expect(previewIconName('="Delete"', false)).toBeNull();
    expect(previewIconName("=Icon.Delete")).toBeNull();
    expect(renderIcon('="Delete"', "ModernIcon@1.1.0"))
      .toContain('d="' + PREVIEW_ICON_PATHS.trash + '"');
  });

  it("imports and renders a synthetic versioned ModernIcon from .pa.yaml", () => {
    const yaml = [
      "Screens:",
      "  Synthetic:",
      "    Children:",
      "      - DeleteIcon:",
      "          Control: ModernIcon@1.1.0",
      "          Properties:",
      '            Icon: ="Delete"',
      "            IconColor: =Color.Red",
      "            Width: =32",
      "            Height: =32"
    ].join("\n");
    const model = buildCanvasModel([{
      path: "Src/SyntheticModernIcon.pa.yaml", name: "SyntheticModernIcon.pa.yaml",
      content: yaml, origin: "yaml", format: "pa-yaml-v3"
    }], "yaml");
    expect(model.screens).toHaveLength(1);
    const control = model.screens[0].children[0];
    const html = renderToStaticMarkup(<svg><CanvasVisualControl
      control={control} x={10} y={20} width={32} height={32}
      clipId="fixture-modern-icon-clip" /></svg>);
    expect(html).toContain('d="' + PREVIEW_ICON_PATHS.trash + '"');
    expect(html).toContain('stroke="#ff0000"');
    expect(html).not.toContain(">?</tspan>");
  });
});
