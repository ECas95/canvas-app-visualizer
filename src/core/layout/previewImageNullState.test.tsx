import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl, PreviewMediaAsset } from "../../types/canvas";
import { CanvasVisualControl } from "../../components/CanvasVisualControl";
import {
  previewImageFlipTransform, previewImageRotation, previewImageRotationTransform
} from "./previewMedia";

// Public synthetic image only: no SQL, identities, permissions or private YAML.
const media: PreviewMediaAsset[] = [{
  name: "synthetic", path: "Resources/Synthetic.png",
  dataUrl: "data:image/png;base64,AA=="
}];

function renderImage(viewport: number, overrides: Record<string, unknown>): string {
  const control: CanvasControl = {
    id: "synthetic-image-null", name: "SyntheticImageNull",
    controlType: "Classic/Image@2.1.0",
    properties: { Image: "=Media.Synthetic", ...overrides },
    children: [], zIndex: 1,
    sourceFile: "Src/Synthetic.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticImageNull",
    sourceFormat: "pa-yaml-v3"
  };
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} mediaAssets={media} x={10} y={20}
    width={120} height={80} clipId="synthetic-image-null-clip"
    simulationSymbols={{ "App.Width": viewport }}
  /></svg>);
}

describe("explicit null Canvas image transforms", () => {
  it.each([390, 768, 1366])(
    "preserves unknown instead of painting guessed image state at %i px",
    viewport => {
      for (const property of [
        "ImagePosition", "ImageRotation", "FlipHorizontal", "FlipVertical"
      ]) {
        const html = renderImage(viewport, { [property]: null });
        expect(html).toContain('data-preview-image-state="unknown"');
        expect(html).toContain('data-preview-image-uncertainty="true"');
        expect(html).not.toContain('href="data:image/png;base64,AA=="');
      }
      // Omitted properties remain distinct from explicit null.
      const omitted = renderImage(viewport, {});
      expect(omitted).toContain('data-preview-image-state="verified"');
      expect(omitted).not.toContain('data-preview-image-uncertainty="true"');
    }
  );

  it("keeps missing flip and rotation defaults while rejecting explicit null", () => {
    expect(previewImageFlipTransform(undefined, undefined, 10, 20, 120, 80))
      .toBe("");
    expect(previewImageFlipTransform(null, undefined, 10, 20, 120, 80))
      .toBeNull();
    expect(previewImageFlipTransform(undefined, null, 10, 20, 120, 80))
      .toBeNull();
    expect(previewImageRotation(undefined)).toBe(0);
    expect(previewImageRotation(null)).toBeNull();
    expect(previewImageRotationTransform(null, 10, 20, 120, 80)).toBeNull();
  });
});
