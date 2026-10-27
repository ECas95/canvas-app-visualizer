import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl, PreviewMediaAsset } from "../../types/canvas";
import { CanvasVisualControl } from "../../components/CanvasVisualControl";
import {
  previewImagePosition, previewImageRotation, previewImageSourceState,
  resolvePreviewImage
} from "./previewMedia";

// Synthetic source-only fixtures: never imply actual SQL records or access.
const media: PreviewMediaAsset[] = [
  { name: "companylogo", path: "Resources/CompanyLogo.png",
    dataUrl: "data:image/png;base64,AA==" },
  { name: "company logo", path: "Resources/Company Logo.png",
    dataUrl: "data:image/png;base64,AA==" }
];

function draw(image: string): string {
  const control: CanvasControl = {
    id: "synthetic-switch-image", name: "SyntheticSwitchImage",
    controlType: "Classic/Image@2.1.0",
    properties: { Image: image, ImagePosition: "=ImagePosition.Fit" },
    children: [], sourceFile: "Src/Synthetic.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticSwitchImage",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} mediaAssets={media} x={10} y={20}
    width={120} height={80} clipId="synthetic-switch-image-clip" /></svg>);
}

describe("verified Power Fx Switch for source-only image previews", () => {
  it("selects only a proven numeric or Boolean match, including quoted local media", () => {
    expect(resolvePreviewImage("=Switch(2, 1, Media.Missing, 2, Media.CompanyLogo)", media))
      .toBe(media[0]);
    expect(resolvePreviewImage("=Switch(2, 1, Media.Missing, 2, Media.'Company Logo')", media))
      .toBe(media[1]);
    const responsive = "=Switch(true, App.Width < 720, Media.CompanyLogo, Media.Missing)";
    expect(resolvePreviewImage(responsive, media, { "App.Width": 390 })).toBe(media[0]);
    expect(previewImageSourceState(responsive, media, { "App.Width": 1366 }))
      .toBe("source-unavailable");
    expect(previewImageSourceState(responsive, media)).toBe("runtime-unknown");
    expect(draw("=Switch(2, 1, Media.Missing, 2, Media.CompanyLogo)"))
      .toContain('data-preview-image-state="verified"');
  });

  it("resolves a verified default and preserves the documented Blank fallback", () => {
    expect(resolvePreviewImage("=Switch(2, 1, Media.Missing, Media.CompanyLogo)", media))
      .toBe(media[0]);
    for (const formula of [
      "=Switch(2, 1, Media.CompanyLogo)",
      "=Switch(2, 1, Media.CompanyLogo, 2, Blank())"
    ]) {
      expect(previewImageSourceState(formula, media)).toBe("source-blank");
      expect(draw(formula)).toContain('data-preview-image-state="source-blank"');
    }
  });

  it("never guesses a permission-dependent or earlier unknown match", () => {
    for (const formula of [
      "=Switch(varSqlAccess, true, Media.CompanyLogo, Media.Missing)",
      "=Switch(2, varSqlAccess, Media.CompanyLogo, 2, Media.CompanyLogo)",
      "=Switch(2, 2, ThisItem.Photo, Media.CompanyLogo)",
      '=Switch("phone", "phone", Media.CompanyLogo)',
      "=Switch(2, 2, Media.CompanyLogo & \"x\")"
    ]) {
      expect(previewImageSourceState(formula, media)).toBe("runtime-unknown");
      expect(resolvePreviewImage(formula, media)).toBeUndefined();
    }
  });

  it("selects typed image position/rotation enums without coercing text", () => {
    const responsive = "=Switch(true, App.Width < 720, ImagePosition.Tile, ImagePosition.Fit)";
    expect(previewImagePosition(responsive, { "App.Width": 390 })).toBe("tile");
    expect(previewImagePosition(responsive, { "App.Width": 1366 })).toBe("fit");
    expect(previewImagePosition(responsive)).toBeNull();
    expect(previewImagePosition("=Switch(2, 1, ImagePosition.Fit, ImagePosition.Fill)"))
      .toBe("fill");
    expect(previewImageRotation(
      "=Switch(2, 1, ImageRotation.Rotate90, 2, ImageRotation.Rotate270)"
    )).toBe(270);
    expect(previewImagePosition(
      "=Switch(2, 1, ImagePosition.Fill, 2, If(true, ImagePosition.Tile, ImagePosition.Center))"
    )).toBe("tile");
    expect(previewImagePosition('=Switch("x", "x", ImagePosition.Tile)')).toBeNull();
    expect(previewImagePosition('=Switch(2, 2, "ImagePosition.Tile")')).toBeNull();
    expect(previewImageRotation("=Switch(varSqlAccess, true, ImageRotation.Rotate90)"))
      .toBeNull();
  });

  it("rejects malformed Switch and never emits remote media", () => {
    expect(previewImagePosition("=Switch(2, 2, ImagePosition.Tile, )")).toBeNull();
    expect(previewImagePosition("=Switch(2, 2, ImagePosition.Tile /* unfinished"))
      .toBeNull();
    expect(resolvePreviewImage(
      '=Switch(2, 2, "https://example.invalid/tracker.png")', media
    )).toBeUndefined();
    expect(draw('=Switch(2, 2, "https://example.invalid/tracker.png")'))
      .not.toContain('href="https://');
  });
});
