import { describe, expect, it } from "vitest";
import type { PreviewMediaAsset } from "../../types/canvas";
import { previewImageFit, previewImagePosition, previewRasterCssImage, resolvePreviewImage } from "./previewMedia";

const media: PreviewMediaAsset[] = [{
  name: "companylogo",
  path: "Resources/CompanyLogo.png",
  dataUrl: "data:image/png;base64,AA=="
}];

describe("local-only image preview", () => {
  it("resolves exact YAML media symbols and constant filenames", () => {
    expect(resolvePreviewImage("=CompanyLogo", media)).toBe(media[0]);
    expect(resolvePreviewImage("=Media.CompanyLogo", media)).toBe(media[0]);
    expect(resolvePreviewImage('="CompanyLogo.png"', media)).toBe(media[0]);
  });

  it("rejects dynamic and remote image references", () => {
    expect(resolvePreviewImage("=ThisItem.Photo", media)).toBeUndefined();
    expect(resolvePreviewImage("=If(varA, CompanyLogo, Blank())", media)).toBeUndefined();
    expect(resolvePreviewImage('="https://example.com/CompanyLogo.png"', media)).toBeUndefined();
    expect(resolvePreviewImage("=Media.Unknown", media)).toBeUndefined();
  });

  it("respects ImagePosition fit modes", () => {
    expect(previewImageFit("=ImagePosition.Fill")).toBe("xMidYMid slice");
    expect(previewImageFit("=ImagePosition.Stretch")).toBe("none");
    expect(previewImageFit("=ImagePosition.Fit")).toBe("xMidYMid meet");
    expect(previewImageFit("=varImagePosition")).toBe("xMidYMid meet");
  });
  it("recognizes only exact documented native-size ImagePosition enums", () => {
    expect(previewImagePosition("=ImagePosition.Center")).toBe("center");
    expect(previewImagePosition("=imageposition.tile")).toBe("tile");
    expect(previewImagePosition("=ImagePosition.Fill")).toBe("fill");
    expect(previewImagePosition("=User.Tile")).toBeNull();
    expect(previewImagePosition('="ImagePosition.Tile"')).toBeNull();
    expect(previewImagePosition("=If(varReady, ImagePosition.Tile, ImagePosition.Fit)")).toBeNull();
  });

  it("allows only local raster base64 data URLs for native-size CSS backgrounds", () => {
    expect(previewRasterCssImage(media[0].dataUrl))
      .toBe('url("data:image/png;base64,AA==")');
    expect(previewRasterCssImage("https://example.com/logo.png")).toBeNull();
    expect(previewRasterCssImage('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(previewRasterCssImage('data:image/png;base64,AA==");background:url(https://x)'))
      .toBeNull();
  });

});
