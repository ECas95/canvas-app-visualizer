import { describe, expect, it } from "vitest";
import { previewReferenceFileKind, referenceViewportMatches,
  MAX_REFERENCE_SCREENSHOT_BYTES } from "./previewReference";

describe("local screenshot reference checks", () => {
  it("accepts only matching, recognized raster signatures", () => {
    const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
    const jpeg = Uint8Array.from([255,216,255,225,0,0,0,0,0,0,0,0]);
    const webp = Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80]);
    expect(previewReferenceFileKind(png, "image/png")).toBe("png");
    expect(previewReferenceFileKind(jpeg, "image/jpeg")).toBe("jpeg");
    expect(previewReferenceFileKind(webp, "image/webp")).toBe("webp");
    expect(previewReferenceFileKind(png, "image/svg+xml")).toBeNull();
    expect(previewReferenceFileKind(png, "image/jpeg")).toBeNull();
    expect(previewReferenceFileKind(Uint8Array.of(1,2,3), "image/png")).toBeNull();
  });

  it("never stretches a reference from a different viewport", () => {
    expect(referenceViewportMatches(1366, 768, 1366, 768)).toBe(true);
    expect(referenceViewportMatches(768, 1024, 1366, 768)).toBe(false);
    expect(referenceViewportMatches(1366, 900, 1366, 768)).toBe(false);
    expect(referenceViewportMatches(0, 768, 0, 768)).toBe(false);
    expect(referenceViewportMatches(16384, 768, 16384, 768)).toBe(false);
    expect(MAX_REFERENCE_SCREENSHOT_BYTES).toBe(8 * 1024 * 1024);
  });
});
