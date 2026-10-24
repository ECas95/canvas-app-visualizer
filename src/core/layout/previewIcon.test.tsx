import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../../types/canvas";
import { CanvasVisualControl } from "../../components/CanvasVisualControl";
import { PREVIEW_ICON_PATHS, previewIconName } from "./previewIcon";

function renderIcon(icon: unknown, type = "Classic/Icon@2.5.0", color = "=Color.Red") {
  const control: CanvasControl = {
    id: "synthetic-icon", name: "SyntheticIcon",
    controlType: type, properties: { Icon: icon, Color: color }, children: [],
    sourceFile: "Src/Synthetic.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticIcon",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
  return renderToStaticMarkup(
    <svg><CanvasVisualControl control={control} x={10} y={20}
      width={64} height={40} clipId="synthetic-icon-clip" /></svg>
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
