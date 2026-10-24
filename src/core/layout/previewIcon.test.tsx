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
