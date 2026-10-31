/** Untrusted local reference screenshots are never uploaded or fetched. */
export const MAX_REFERENCE_SCREENSHOT_BYTES = 8 * 1024 * 1024;
export type PreviewReferenceKind = "png" | "jpeg" | "webp";

export function previewReferenceFileKind(bytes: Uint8Array, mime: string):
  PreviewReferenceKind | null {
  if (bytes.length < 12) return null;
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  if (mime === "image/png" && png.every((v, i) => bytes[i] === v)) return "png";
  if (mime === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 &&
      bytes[2] === 255) return "jpeg";
  if (mime === "image/webp" && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

export function referenceViewportMatches(
  imageWidth: number, imageHeight: number, viewportWidth: number, viewportHeight: number
): boolean {
  return [imageWidth, imageHeight, viewportWidth, viewportHeight]
    .every(v => Number.isInteger(v) && v > 0 && v <= 8192) &&
    imageWidth === viewportWidth && imageHeight === viewportHeight;
}
