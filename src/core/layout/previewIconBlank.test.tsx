import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../../types/canvas";
import { CanvasVisualControl } from "../../components/CanvasVisualControl";
import { buildCanvasModel } from "../model/normalize";
import { PREVIEW_ICON_PATHS, previewIconName } from "./previewIcon";

function icon(formula: string, type = "Classic/Icon@2.5.0"): CanvasControl {
  return {
    id: "blank-icon", name: "BlankIcon", controlType: type,
    properties: { Icon: formula }, children: [], zIndex: 0,
    sourceFile: "Src/Synthetic.pa.yaml",
    sourcePath: "Screens/Synthetic/BlankIcon",
    sourceFormat: "pa-yaml-v3"
  };
}

function render(formula: string, viewport = 768, type = "Classic/Icon@2.5.0") {
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={icon(formula, type)} x={0} y={0} width={48} height={48}
    clipId="synthetic-blank-icon" simulationSymbols={{ "App.Width": viewport }}
  /></svg>);
}

describe("Power Fx known-blank Canvas icons", () => {
  it.each([
    ["=Blank()", false],
    ["=blank /* source comment */ ()", false],
    ["=Blank()", true],
    ["=If(false, Icon.Add)", false],
    ["=If(false, Icon.Add, false, Icon.Home)", false],
    ["=If(false, Icon.Add, Blank())", false],
    ["=If(true, Blank(), Icon.Home)", false],
    ["=If(false, Icon.Home, If(false, Icon.Add))", false],
    ['=If(false, "Add")', true]
  ] as const)("treats source-verifiable blank %s as no glyph", (formula, modern) => {
    expect(previewIconName(formula, modern)).toBe("none");
  });

  it("does not render a question mark or SVG glyph for a known blank", () => {
    for (const formula of ["=Blank()", "=If(false, Icon.Add)"]) {
      const html = render(formula);
      expect(html).not.toContain('data-preview-icon-state="unknown"');
      expect(html).not.toContain('viewBox="0 0 24 24"');
      expect(html).not.toContain(">?</tspan>");
    }
  });

  it.each([390, 768, 1366])("preserves responsive blank branches at %i px", width => {
    const formula = "=If(App.Width < 600, Icon.Add)";
    const html = render(formula, width);
    if (width < 600) expect(html).toContain('d="' + PREVIEW_ICON_PATHS.add + '"');
    else {
      expect(html).not.toContain('viewBox="0 0 24 24"');
      expect(html).not.toContain('data-preview-icon-state="unknown"');
    }
  });

  it("applies the same rule to modern Fluent string icon expressions", () => {
    expect(render('=If(App.Width < 600, "Add")', 390, "ModernIcon@1.1.0"))
      .toContain('d="' + PREVIEW_ICON_PATHS.add + '"');
    const desktop = render('=If(App.Width < 600, "Add")', 1366, "ModernIcon@1.1.0");
    expect(desktop).not.toContain('viewBox="0 0 24 24"');
    expect(desktop).not.toContain('data-preview-icon-state="unknown"');
  });

  it("retains unknown for SQL/permission-dependent or malformed expressions", () => {
    for (const formula of [
      "=If(varSqlAuthorized, Icon.Add)",
      "=If(false, Icon.Add, varSqlIcon)",
      "=Blank(1)", "=Blank() & Icon.Add", "=If(false, Icon.Add, )"
    ]) {
      expect(previewIconName(formula)).toBeNull();
    }
    expect(render("=If(varSqlAuthorized, Icon.Add)"))
      .toContain('data-preview-icon-state="unknown"');
  });

  it("keeps the selected known glyph when the unselected branch is unknown", () => {
    expect(previewIconName("=If(true, Icon.Home, varSqlIcon)")).toBe("home");
    expect(render("=If(true, Icon.Home, varSqlIcon)"))
      .toContain('d="' + PREVIEW_ICON_PATHS.home + '"');
  });

  it("imports a synthetic versioned .pa.yaml with a blank icon branch", () => {
    const yaml = [
      "Screens:", "  Synthetic:", "    Children:",
      "      - BlankIcon:", "          Control: Classic/Icon@2.5.0",
      "          Properties:",
      "            Icon: =If(App.Width < 600, Icon.Add)",
      "            Width: =48", "            Height: =48"
    ].join("\n");
    const model = buildCanvasModel([{
      path: "Src/Synthetic.pa.yaml", name: "Synthetic.pa.yaml",
      content: yaml, origin: "yaml", format: "pa-yaml-v3"
    }], "yaml");
    expect(model.screens).toHaveLength(1);
    const imported = model.screens[0].children[0];
    const html = renderToStaticMarkup(<svg><CanvasVisualControl
      control={imported} x={0} y={0} width={48} height={48}
      clipId="imported-blank" simulationSymbols={{ "App.Width": 1366 }}
    /></svg>);
    expect(html).not.toContain('viewBox="0 0 24 24"');
    expect(html).not.toContain('data-preview-icon-state="unknown"');
  });
});
