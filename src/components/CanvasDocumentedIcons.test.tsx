import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { buildCanvasModel } from "../core/model/normalize";
import { PREVIEW_ICON_PATHS, previewIconName } from "../core/layout/previewIcon";
import { CanvasVisualControl } from "./CanvasVisualControl";

/**
 * Source-known classic icons from Microsoft's Shape and Icon control reference:
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-shapes-icons
 * Lock is used in its accessibility example; ShoppingCart is an Icon example.
 * These paths are visual approximations, not exported Microsoft glyph assets.
 */
function icon(type: string, expression: string): CanvasControl {
  return {
    id: "synthetic-icon", name: "SyntheticIcon", controlType: type,
    properties: { Icon: expression }, children: [], zIndex: 0,
    sourceFile: "Src/Synthetic.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticIcon",
    sourceFormat: "pa-yaml-v3"
  };
}

function render(control: CanvasControl, viewport = 768): string {
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={12} y={16} width={48} height={48}
    clipId="documented-icon-clip"
    simulationSymbols={{ "App.Width": viewport }}
  /></svg>);
}

describe("documented Canvas icon coverage", () => {
  it.each([
    ["Icon.Lock", "lock"],
    ["Icon.ShoppingCart", "shoppingcart"]
  ] as const)("recognizes complete classic %s enum without substring guesses", (source, name) => {
    expect(previewIconName("=" + source)).toBe(name);
    const markup = render(icon("Classic/Icon@2.5.0", "=" + source));
    expect(markup).toContain('d="' + PREVIEW_ICON_PATHS[name] + '"');
    expect(markup).not.toContain('data-preview-icon-state="unknown"');
  });

  it("supports the documented modern Fluent Lock literal", () => {
    expect(previewIconName('="Lock"', true)).toBe("lock");
    const markup = render(icon("ModernIcon@1.1.0", '="Lock"'));
    expect(markup).toContain('d="' + PREVIEW_ICON_PATHS.lock + '"');
  });

  it.each([390, 768, 1366])("selects the known icon branch at %i px", viewport => {
    const markup = render(icon(
      "Classic/Icon@2.5.0",
      "=If(App.Width < 720, Icon.Lock, Icon.ShoppingCart)"
    ), viewport);
    const name = viewport < 720 ? "lock" : "shoppingcart";
    expect(markup).toContain('d="' + PREVIEW_ICON_PATHS[name] + '"');
    expect(markup).not.toContain('data-preview-icon-state="unknown"');
  });

  it("does not infer SQL-dependent icon selection or access rights", () => {
    const markup = render(icon(
      "Classic/Icon@2.5.0",
      "=If(varSqlAuthorized, Icon.Lock, Icon.ShoppingCart)"
    ));
    expect(markup).toContain('data-preview-icon-state="unknown"');
    expect(markup).not.toContain('d="' + PREVIEW_ICON_PATHS.lock + '"');
    expect(markup).not.toContain('d="' + PREVIEW_ICON_PATHS.shoppingcart + '"');
  });

  it("rejects lookalike enum members and classic text literals", () => {
    expect(previewIconName("=Icon.LockOpen")).toBeNull();
    expect(previewIconName("=Icon.ShoppingCartExtra")).toBeNull();
    expect(previewIconName('="Lock"')).toBeNull();
  });

  it("imports a synthetic versioned .pa.yaml and draws the verified classic icon", () => {
    const yaml = [
      "Screens:", "  Synthetic:", "    Children:",
      "      - CartIcon:", "          Control: Classic/Icon@2.5.0",
      "          Properties:", "            Icon: =Icon.ShoppingCart",
      "            Width: =48", "            Height: =48"
    ].join("\n");
    const model = buildCanvasModel([{
      path: "Src/Synthetic.pa.yaml", name: "Synthetic.pa.yaml",
      content: yaml, origin: "yaml", format: "pa-yaml-v3"
    }], "yaml");
    expect(model.screens).toHaveLength(1);
    expect(render(model.screens[0].children[0]))
      .toContain('d="' + PREVIEW_ICON_PATHS.shoppingcart + '"');
  });
});
