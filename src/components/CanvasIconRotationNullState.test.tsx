import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { CanvasVisualControl } from "./CanvasVisualControl";
import { PREVIEW_ICON_PATHS, previewIconRotation } from "../core/layout/previewIcon";

// Synthetic source-only icon: never infer SQL data, identities or permissions.
function renderIcon(viewport: number, rotation?: unknown, supplied = true): string {
  const control: CanvasControl = {
    id: "synthetic-icon-rotation", name: "SyntheticIconRotation",
    controlType: "Classic/Icon@2.5.0",
    properties: {
      Icon: "=Icon.Lock",
      ...(supplied ? { Rotation: rotation } : {})
    },
    children: [], zIndex: 1,
    sourceFile: "Src/Synthetic.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticIconRotation",
    sourceFormat: "pa-yaml-v3"
  };
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={10} y={20} width={48} height={48}
    clipId="synthetic-icon-rotation-clip"
    simulationSymbols={{ "App.Width": viewport }}
  /></svg>);
}

describe("Canvas Icon rotation provenance", () => {
  it.each([390, 768, 1366])(
    "does not paint a guessed glyph for explicit null or runtime rotation at %i px",
    viewport => {
      for (const rotation of [null, "=Blank()", "=varSqlPermissionRotation"]) {
        const markup = renderIcon(viewport, rotation);
        expect(markup).toContain('data-preview-icon-state="unknown"');
        expect(markup).toContain("Icon rotation requires runtime state");
        expect(markup).not.toContain('d="' + PREVIEW_ICON_PATHS.lock + '"');
      }
    }
  );

  it.each([390, 768, 1366])(
    "retains the omitted default and verified numeric rotation at %i px",
    viewport => {
      const omitted = renderIcon(viewport, undefined, false);
      expect(omitted).toContain('d="' + PREVIEW_ICON_PATHS.lock + '"');
      expect(omitted).not.toContain('data-preview-icon-state="unknown"');

      const rotated = renderIcon(viewport, "=90");
      expect(rotated).toContain('d="' + PREVIEW_ICON_PATHS.lock + '"');
      expect(rotated).toContain('transform="rotate(90 12 12)"');
      expect(rotated).not.toContain('data-preview-icon-state="unknown"');
    }
  );

  it("distinguishes an omitted property from a source null", () => {
    expect(previewIconRotation(null)).toBeNull();
    expect(previewIconRotation("=Blank()")).toBeNull();
    expect(previewIconRotation("=90")).toBe(90);
  });
});
