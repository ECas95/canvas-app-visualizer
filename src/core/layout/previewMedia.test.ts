import { describe, expect, it } from "vitest";
import type { PreviewMediaAsset } from "../../types/canvas";
import { previewImageFit, previewImageFlipTransform, previewImagePosition, previewImageRotation, previewImageRotationTransform, previewRasterCssImage, resolvePreviewImage } from "./previewMedia";

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


  it("reflects only verified Canvas image flip flags around the control bounds", () => {
    expect(previewImageFlipTransform("=true", "=false", 10, 20, 140, 64))
      .toBe("translate(160 0) scale(-1 1)");
    expect(previewImageFlipTransform("=false", "=true", 10, 20, 140, 64))
      .toBe("translate(0 104) scale(1 -1)");
    expect(previewImageFlipTransform("=true", "=true", 10, 20, 140, 64))
      .toBe("translate(160 104) scale(-1 -1)");
    expect(previewImageFlipTransform(undefined, undefined, 10, 20, 140, 64)).toBe("");
    expect(previewImageFlipTransform("=false", "=false", 10, 20, 140, 64)).toBe("");
  });

  it("never treats unknown Power Fx or string booleans as verified flips", () => {
    expect(previewImageFlipTransform("=varRuntimeFlag", "=false", 10, 20, 140, 64)).toBeNull();
    expect(previewImageFlipTransform('="true"', "=false", 10, 20, 140, 64)).toBeNull();
    expect(previewImageFlipTransform("=If(varReady, true, false)", "=false", 10, 20, 140, 64))
      .toBeNull();
    expect(previewImageFlipTransform("=If(App.Width < 720, true, false)", undefined,
      10, 20, 140, 64, { "App.Width": 390 }))
      .toBe("translate(160 0) scale(-1 1)");
    expect(previewImageFlipTransform("=true", "=false", 10, 20, Infinity, 64)).toBeNull();
  });
});


describe("source-only Canvas ImageRotation", () => {
  it("accepts only the four documented ImageRotation enum members", () => {
    expect(previewImageRotation(undefined)).toBe(0);
    expect(previewImageRotation("=ImageRotation.None")).toBe(0);
    expect(previewImageRotation("=ImageRotation.Rotate90")).toBe(90);
    expect(previewImageRotation("=ImageRotation.Rotate180")).toBe(180);
    expect(previewImageRotation("=imagerotation.rotate270")).toBe(270);
    expect(previewImageRotation("=User.Rotate90")).toBeNull();
    expect(previewImageRotation('="ImageRotation.Rotate90"')).toBeNull();
    expect(previewImageRotation("=If(varReady, ImageRotation.Rotate90, ImageRotation.None)")).toBeNull();
    expect(previewImageRotation("=90")).toBeNull();
  });

  it("rotates only verified angles around finite control geometry", () => {
    expect(previewImageRotationTransform("=ImageRotation.Rotate90", 10, 20, 140, 64))
      .toBe("rotate(90 80 52)");
    expect(previewImageRotationTransform("=ImageRotation.Rotate270", 10, 20, 140, 64))
      .toBe("rotate(270 80 52)");
    expect(previewImageRotationTransform(undefined, 10, 20, 140, 64)).toBe("");
    expect(previewImageRotationTransform("=varRotation", 10, 20, 140, 64)).toBeNull();
    expect(previewImageRotationTransform("=ImageRotation.Rotate90", 10, 20, Infinity, 64))
      .toBeNull();
  });
});

describe("verified responsive Canvas image enumerations", () => {
  const phone = { "App.Width": 390 };
  const desktop = { "App.Width": 1366 };

  it("selects native-size ImagePosition only from a proven viewport branch", () => {
    const formula = "=If(App.Width < 720, ImagePosition.Tile, ImagePosition.Fit)";
    expect(previewImagePosition(formula, phone)).toBe("tile");
    expect(previewImagePosition(formula, desktop)).toBe("fit");
    expect(previewImagePosition(formula)).toBeNull();
    expect(previewImageFit(formula, desktop)).toBe("xMidYMid meet");
    expect(previewImagePosition("=If(varAccess, ImagePosition.Tile, ImagePosition.Fit)", phone))
      .toBeNull();
    expect(previewImagePosition('=If(App.Width < 720, "ImagePosition.Tile", ImagePosition.Fit)', phone))
      .toBeNull();
    expect(previewImagePosition("=User.Tile", phone)).toBeNull();
  });

  it("rotates only for known responsive enum results", () => {
    const formula = "=If(App.Width < 720, ImageRotation.Rotate90, ImageRotation.None)";
    expect(previewImageRotation(formula, phone)).toBe(90);
    expect(previewImageRotation(formula, desktop)).toBe(0);
    expect(previewImageRotation(formula)).toBeNull();
    expect(previewImageRotationTransform(formula, 10, 20, 140, 64, phone))
      .toBe("rotate(90 80 52)");
    expect(previewImageRotationTransform(formula, 10, 20, 140, 64, desktop)).toBe("");
    expect(previewImageRotation("=If(varAccess, ImageRotation.Rotate90, ImageRotation.None)", phone))
      .toBeNull();
    expect(previewImageRotation('=If(App.Width < 720, "ImageRotation.Rotate90", ImageRotation.None)', phone))
      .toBeNull();
    expect(previewImageRotation("=User.Rotate90", phone)).toBeNull();
  });
});


describe("strict token-based Canvas image enum selection", () => {
  const phone = { "App.Width": 390, "App.Height": 844 };
  const tablet = { "App.Width": 768, "App.Height": 1024 };
  const desktop = { "App.Width": 1366, "App.Height": 768 };

  it("accepts documented enum members with valid comments and whitespace", () => {
    expect(previewImagePosition("=ImagePosition /* note */ . Tile // end")).toBe("tile");
    expect(previewImagePosition("=ImagePosition. /* note */ Stretch")).toBe("stretch");
    expect(previewImageRotation("=ImageRotation /* note */ . Rotate270")).toBe(270);
    expect(previewImageRotation("=ImageRotation.Rotate90 // end")).toBe(90);
  });

  it("never coerces verified local text into image enums", () => {
    const symbols = { ...desktop, localPosition: "ImagePosition.Fill",
      localRotation: "ImageRotation.Rotate90" };
    expect(previewImagePosition("=localPosition", symbols)).toBeNull();
    expect(previewImageRotation("=localRotation", symbols)).toBeNull();
    expect(previewImagePosition(
      "=If(App.Width < 720, ImagePosition.Tile, localPosition)", symbols
    )).toBeNull();
    expect(previewImageRotation(
      "=If(App.Width < 720, ImageRotation.None, localRotation)", symbols
    )).toBeNull();
    expect(previewImagePosition(
      "=If(App.Width < 720, ImagePosition.Tile, localPosition)",
      { ...symbols, "App.Width": 390 }
    )).toBe("tile");
  });

  it("resolves nested and multi-condition image enums by verified viewport", () => {
    const position = "=If(App.Width < 600, ImagePosition.Tile, " +
      "App.Width < 1000, If(App.Height > 800, ImagePosition.Center, ImagePosition.Fill), " +
      "ImagePosition.Fit)";
    expect(previewImagePosition(position, phone)).toBe("tile");
    expect(previewImagePosition(position, tablet)).toBe("center");
    expect(previewImagePosition(position, { ...tablet, "App.Height": 600 })).toBe("fill");
    expect(previewImagePosition(position, desktop)).toBe("fit");
    expect(previewImagePosition(position, { "App.Width": 768 })).toBeNull();
    const rotation = "=If(App.Width < 600, ImageRotation.Rotate90, " +
      "App.Width < 1000, ImageRotation.Rotate180, ImageRotation.None)";
    expect(previewImageRotation(rotation, phone)).toBe(90);
    expect(previewImageRotation(rotation, tablet)).toBe(180);
    expect(previewImageRotation(rotation, desktop)).toBe(0);
  });

  it("rejects quoted, malformed and compound expressions without guessing", () => {
    for (const source of [
      '="ImagePosition.Fill"',
      "=ImagePosition.Fill & localValue",
      "=ImagePosition /* unterminated",
      "=ImagePosition.Unknown",
      "=If(true, ImagePosition.Tile, )",
      "=If(varAccess, ImagePosition.Tile, ImagePosition.Fit)"
    ]) expect(previewImagePosition(source, phone)).toBeNull();
    for (const source of [
      '="ImageRotation.Rotate90"',
      "=ImageRotation.Rotate90 & localValue",
      "=ImageRotation /* unterminated",
      "=ImageRotation.Rotate45",
      "=If(true, ImageRotation.Rotate90, )",
      "=If(varAccess, ImageRotation.Rotate90, ImageRotation.None)"
    ]) expect(previewImageRotation(source, phone)).toBeNull();
  });
});
