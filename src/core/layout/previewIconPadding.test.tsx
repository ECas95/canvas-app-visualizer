import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../../types/canvas";
import { CanvasVisualControl } from "../../components/CanvasVisualControl";
import { PREVIEW_ICON_PATHS, previewIconBox } from "./previewIcon";

/** Synthetic source-only controls: no SQL, permissions, or external calls. */
function render(type: string, properties: Record<string, unknown>, viewport = 768) {
  const control: CanvasControl = {
    id: "padding-icon", name: "PaddingIcon", controlType: type,
    properties: { Icon: type.startsWith("Modern") ? '="Add"' : "=Icon.Add", ...properties },
    children: [], zIndex: 1,
    sourceFile: "Src/SyntheticPadding.pa.yaml",
    sourcePath: "Screens/Synthetic/PaddingIcon", sourceFormat: "pa-yaml-v3"
  };
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={10} y={20} width={64} height={40}
    clipId="padding-clip" simulationSymbols={{ "App.Width": viewport }}
  /></svg>);
}

describe("ModernIcon source-only padding", () => {
  it("applies asymmetric verified padding to glyph geometry", () => {
    const html = render("ModernIcon@1.1.0", {
      PaddingLeft: "=12", PaddingRight: "=4",
      PaddingTop: "=6", PaddingBottom: "=2"
    });
    expect(html).toContain('x="30" y="26" width="32" height="32"');
    expect(html).toContain('d="' + PREVIEW_ICON_PATHS.add + '"');
  });

  it.each([[390, 28], [768, 22], [1366, 22]])(
    "resolves responsive padding at %i px", (viewport, expectedX) => {
      const html = render("ModernIcon@1.1.0", {
        PaddingLeft: "=If(App.Width < 720, 12, 0)",
        PaddingRight: "=0", PaddingTop: "=0", PaddingBottom: "=0"
      }, viewport);
      expect(html).toContain(`x="${expectedX}" y="20" width="40" height="40"`);
      expect(html).not.toContain('data-preview-icon-state="unknown"');
    }
  );

  it("preserves classic and omitted modern icon geometry", () => {
    for (const type of ["ModernIcon@1.1.0", "Classic/Icon@2.5.0"]) {
      expect(render(type, {})).toContain('x="26" y="24" width="32" height="32"');
    }
    expect(render("Classic/Icon@2.5.0", {
      PaddingLeft: "=varUnknownRuntime"
    })).toContain('x="26" y="24" width="32" height="32"');
  });

  it.each([
    "=varSqlPadding", "=If(varAuthorized, 8, 0)", "=-1",
    '="8"', "=User().Email"
  ])("withholds a glyph for unverified modern padding: %s", source => {
    const html = render("ModernIcon@1.1.0", { PaddingLeft: source });
    expect(html).toContain('data-preview-icon-state="unknown"');
    expect(html).toContain("Icon padding requires runtime state");
    expect(html).not.toContain('d="' + PREVIEW_ICON_PATHS.add + '"');
  });

  it("does not paint outside a known collapsed content area", () => {
    const html = render("ModernIcon@1.1.0", { PaddingLeft: "=64" });
    expect(html).not.toContain('data-preview-icon-state="unknown"');
    expect(html).not.toContain('d="' + PREVIEW_ICON_PATHS.add + '"');
    expect(previewIconBox({ PaddingLeft: "=64" }, 10, 20, 64, 40, true))
      .toEqual({ x: 42, y: 40, size: 0 });
  });
});
