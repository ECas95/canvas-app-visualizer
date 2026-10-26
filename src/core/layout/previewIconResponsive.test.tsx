import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../../types/canvas";
import { CanvasVisualControl } from "../../components/CanvasVisualControl";
import { buildCanvasModel } from "../model/normalize";
import { PREVIEW_ICON_PATHS, previewIconName } from "./previewIcon";

function renderIcon(
  formula: string, appWidth: number, type = "Classic/Icon@2.5.0",
  extraSymbols: Record<string, string | number | boolean> = {}
) {
  const control: CanvasControl = {
    id: "responsive-icon", name: "ResponsiveIcon", controlType: type,
    properties: { Icon: formula, Color: "=Color.Red" }, children: [],
    sourceFile: "Src/Synthetic.pa.yaml", sourcePath: "Screens/Synthetic/ResponsiveIcon",
    sourceFormat: "pa-yaml-v3", zIndex: 0
  };
  return renderToStaticMarkup(<svg><CanvasVisualControl control={control}
    x={0} y={0} width={48} height={48} clipId="icon-clip"
    simulationSymbols={{ "App.Width": appWidth, ...extraSymbols }} /></svg>);
}

describe("responsive Canvas Icon source fidelity", () => {
  it("selects classic Icon enums for phone, tablet and desktop", () => {
    const formula = "=If(App.Width < 600, Icon.Add, App.Width < 1000, Icon.Search, Icon.Cancel)";
    const expectations = [[390, "add"], [768, "search"], [1366, "cancel"]] as const;
    for (const [width, name] of expectations) {
      const markup = renderIcon(formula, width);
      expect(markup).toContain('d="' + PREVIEW_ICON_PATHS[name] + '"');
      expect(markup).not.toContain(">?</tspan>");
    }
  });

  it("resolves nested conditions and Icon.None only with known symbols", () => {
    const formula = "=If(App.Width < 600, If(Parent.Width < 100, Icon.None, Icon.Add), Icon.Home)";
    expect(previewIconName(formula, false, { "App.Width": 390, "Parent.Width": 80 }))
      .toBe("none");
    expect(previewIconName(formula, false, { "App.Width": 390, "Parent.Width": 180 }))
      .toBe("add");
    expect(previewIconName(formula, false, { "App.Width": 1366 }))
      .toBe("home");
    expect(previewIconName(formula, false, { "App.Width": 390 }))
      .toBeNull();
    expect(previewIconName("=If(false, Icon.Add)", false, {})).toBe("none");
  });

  it("supports only quoted Fluent names in modern Icon branches", () => {
    const formula = '=If(App.Width < 600, "Delete", "Check")';
    expect(renderIcon(formula, 390, "ModernIcon@1.1.0"))
      .toContain('d="' + PREVIEW_ICON_PATHS.trash + '"');
    expect(renderIcon(formula, 1366, "ModernIcon@1.1.0"))
      .toContain('d="' + PREVIEW_ICON_PATHS.check + '"');
    expect(previewIconName(formula, false, { "App.Width": 390 })).toBeNull();
    expect(previewIconName("=If(true, Icon.Delete, Icon.Add)", false, {})).toBeNull();
  });

  it("does not guess unknown permissions, unsupported glyphs or quoted classic enums", () => {
    const unknown = "=If(varSqlAuthorized, Icon.Add, Icon.Cancel)";
    expect(renderIcon(unknown, 390)).toContain(">?</tspan>");
    expect(previewIconName('=If(true, "Icon.Add", Icon.Cancel)', false, {}))
      .toBeNull();
    expect(previewIconName("=If(true, Icon.AddressBook, Icon.Add)", false, {}))
      .toBeNull();
    expect(previewIconName("=If(SQL.CanRead(), Icon.Add, Icon.Cancel)", false, {}))
      .toBeNull();
    expect(previewIconName("=If(App.Width < 600, Icon.Add, )", false,
      { "App.Width": 1366 })).toBeNull();
  });


  it("selects typed Switch icon branches at 390, 768 and 1366 px", () => {
    const formula = "=Switch(true, App.Width < 600, Icon.Add, App.Width < 1024, Icon.Search, Icon.Cancel)";
    const cases = [[390, "add"], [768, "search"], [1366, "cancel"]] as const;
    for (const [width, name] of cases) {
      expect(previewIconName(formula, false, { "App.Width": width })).toBe(name);
      const markup = renderIcon(formula, width);
      expect(markup).toContain('d="' + PREVIEW_ICON_PATHS[name] + '"');
      expect(markup).not.toContain(">?</tspan>");
    }
    expect(previewIconName(formula)).toBeNull();
  });

  it("resolves modern Switch Fluent icons without inventing SQL state", () => {
    const formula = '=Switch(true, App.Width < 600, "Delete", "Check")';
    expect(renderIcon(formula, 390, "ModernIcon@1.1.0"))
      .toContain('d="' + PREVIEW_ICON_PATHS.trash + '"');
    expect(renderIcon(formula, 1366, "ModernIcon@1.1.0"))
      .toContain('d="' + PREVIEW_ICON_PATHS.check + '"');
    expect(previewIconName(formula, false, { "App.Width": 390 })).toBeNull();
    expect(previewIconName("=Switch(true, false, Icon.Add)")).toBe("none");
    expect(previewIconName("=Switch(2, 1, Icon.Add, 2, Icon.Home)")).toBe("home");
  });

  it("keeps Switch icons unknown for unverified permissions and type impostors", () => {
    for (const formula of [
      "=Switch(varSqlPermission, true, Icon.Add, Icon.Home)",
      "=Switch(true, varSqlPermission, Icon.Add, Icon.Home)",
      '=Switch("Icon.Add", "Icon.Add", Icon.Home)',
      '=Switch(true, true, "Icon.Add", Icon.Home)',
      "=Switch(true, true, Icon.AddressBook, Icon.Add)",
      "=Switch(true, true, Icon.Add, )"
    ]) {
      expect(previewIconName(formula)).toBeNull();
    }
    expect(renderIcon("=Switch(true, varSqlPermission, Icon.Add, Icon.Home)", 390))
      .toContain(">?</tspan>");
  });

  it("renders a synthetic versioned .pa.yaml Icon without data sources", () => {
    const yaml = [
      "Screens:", "  Synthetic:", "    Children:", "      - ResponsiveIcon:",
      "          Control: Classic/Icon@2.5.0", "          Properties:",
      "            Icon: =If(App.Width < 600, Icon.Add, Icon.Home)",
      "            Width: =48", "            Height: =48"
    ].join("\n");
    const model = buildCanvasModel([{
      path: "Src/Synthetic.pa.yaml", name: "Synthetic.pa.yaml",
      content: yaml, origin: "yaml", format: "pa-yaml-v3"
    }], "yaml");
    const control = model.screens[0].children[0];
    const markup = renderToStaticMarkup(<svg><CanvasVisualControl control={control}
      x={0} y={0} width={48} height={48} clipId="fixture-icon-clip"
      simulationSymbols={{ "App.Width": 390 }} /></svg>);
    expect(markup).toContain('d="' + PREVIEW_ICON_PATHS.add + '"');
  });
});
