import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl, PreviewMediaAsset } from "../../types/canvas";
import { CanvasVisualControl } from "../../components/CanvasVisualControl";
import { previewImageSourceState, resolvePreviewImage } from "./previewMedia";

// Synthetic fixture only: no user YAML, SQL records, identity or permissions.
const asset: PreviewMediaAsset = {
  name: "companylogo",
  path: "Resources/CompanyLogo.png",
  dataUrl: "data:image/png;base64,AA=="
};
const media = [asset];

function draw(image: string, assets: PreviewMediaAsset[] = media,
  position = "=ImagePosition.Fit"): string {
  const control: CanvasControl = {
    id: "synthetic-image",
    name: "SyntheticImage",
    controlType: "Classic/Image@2.1.0",
    properties: { Image: image, ImagePosition: position },
    children: [],
    sourceFile: "Src/Synthetic.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticImage",
    sourceFormat: "pa-yaml-v3",
    zIndex: 1
  };
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} mediaAssets={assets} x={10} y={20}
    width={120} height={80} clipId="synthetic-image-clip" /></svg>);
}

describe("Canvas image source fidelity and local-only rendering", () => {
  it("identifies imported raster assets and verified responsive selections", () => {
    expect(previewImageSourceState("=Media.CompanyLogo", media)).toBe("verified");
    expect(previewImageSourceState(
      "=If(App.Width < 720, Media.CompanyLogo, Media.Other)",
      media, { "App.Width": 390 }
    )).toBe("verified");
    expect(previewImageSourceState(
      "=If(App.Width < 720, Media.CompanyLogo, Media.Other)",
      media, { "App.Width": 1366 }
    )).toBe("source-unavailable");
    expect(draw("=Media.CompanyLogo")).toContain('data-preview-image-state="verified"');
  });

  it.each([
    "=ThisItem.Photo",
    "=varSqlImage",
    "=If(varSqlAuthorized, Media.CompanyLogo, Media.Other)",
    "=If(App.Width < 720, Media.CompanyLogo, Media.Other)"
  ])("does not confuse runtime image expression %s with missing local media", formula => {
    expect(previewImageSourceState(formula, media)).toBe("runtime-unknown");
    const html = draw(formula);
    expect(html).toContain('data-preview-image-state="unknown"');
    expect(html).toContain('data-preview-image-source-state="runtime-unknown"');
    expect(html).toContain("Image state unknown");
    expect(html).not.toContain('href="data:image/');
  });

  it.each([
    "=Media.Missing",
    '="https://example.invalid/photo.png"',
    "=Blank()",
    "=Media.CompanyLogo /* unfinished"
  ])("marks statically unavailable image %s without inventing runtime access", formula => {
    expect(previewImageSourceState(formula, media)).toBe("source-unavailable");
    expect(draw(formula)).toContain('data-preview-image-state="source-unavailable"');
  });

  it.each([
    ["https://example.invalid/tracker.png", "=ImagePosition.Fit"],
    ["https://example.invalid/tracker.png", "=ImagePosition.Fill"],
    ["https://example.invalid/tracker.png", "=ImagePosition.Stretch"],
    ["https://example.invalid/tracker.png", "=ImagePosition.Tile"],
    ["https://example.invalid/tracker.png", "=ImagePosition.Center"],
    ["data:image/svg+xml;base64,PHN2Zz4=", "=ImagePosition.Fit"],
    ['data:image/png;base64,AA==\" onload=\"alert(1)', "=ImagePosition.Fit"]
  ])("never interpolates an unsafe imported asset into SVG or CSS (%s, %s)",
    (dataUrl, position) => {
      const injected: PreviewMediaAsset = { ...asset, dataUrl };
      expect(resolvePreviewImage("=Media.CompanyLogo", [injected])).toBeUndefined();
      const html = draw("=Media.CompanyLogo", [injected], position);
      expect(html).toContain('data-preview-image-state="source-unavailable"');
      expect(html).not.toContain("<image ");
      expect(html).not.toContain("<foreignObject");
      expect(html).not.toContain("example.invalid");
      expect(html).not.toContain("onload=");
    }
  );

  it("does not use a remote asset even when the name is statically selected", () => {
    const injected = [{ ...asset, dataUrl: "https://example.invalid/tracker.png" }];
    expect(previewImageSourceState("=If(true, Media.CompanyLogo, Media.Other)", injected))
      .toBe("source-unavailable");
  });
});
