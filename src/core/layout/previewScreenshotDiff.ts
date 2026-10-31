import { compareVisualPixels, type PixelDiffReport, type PixelRegion } from "./visualDiff";

const MAX_SVG_CHARS = 12 * 1024 * 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Cannot decode screenshot image."));
    image.src = src;
  });
}

/**
 * Rasterize a clone of the currently rendered Canvas SVG. The reference
 * overlay is excluded, otherwise the reported difference would be biased
 * toward zero. Never fetch images: only allow embedded local PNG/JPEG/WebP.
 */
export async function captureCanvasComparison(
  svg: SVGSVGElement,
  referenceDataUrl: string,
  width: number,
  height: number,
  regions: readonly PixelRegion[],
  threshold = 32
): Promise<{ report: PixelDiffReport; heatmapUrl: string }> {
  if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(referenceDataUrl)) {
    throw new Error("Reference must be a browser-local raster image.");
  }
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('[data-preview-reference], [data-preview-diff-heatmap]')
    .forEach(node => node.remove());
  // An arbitrary source/image URL must never become a remote request when
  // serializing or rasterizing the SVG. Canvas package raster data is safe.
  clone.querySelectorAll("image").forEach(image => {
    const href = image.getAttribute("href") ??
      image.getAttribute("xlink:href") ?? "";
    if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(href)) image.remove();
  });
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const serialized = new XMLSerializer().serializeToString(clone);
  if (serialized.length > MAX_SVG_CHARS) {
    throw new Error("Canvas SVG exceeds local comparison size limit.");
  }
  const objectUrl = URL.createObjectURL(
    new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const [previewImage, referenceImage] = await Promise.all([
      loadImage(objectUrl), loadImage(referenceDataUrl)
    ]);
    if (referenceImage.naturalWidth !== width || referenceImage.naturalHeight !== height) {
      throw new Error("Reference image size does not match current Canvas viewport.");
    }
    const paint = (image: HTMLImageElement): Uint8ClampedArray => {
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas 2D is unavailable.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      try { return ctx.getImageData(0, 0, width, height).data; }
      catch { throw new Error("Cannot compare this Canvas because some content cannot be safely rasterized."); }
    };
    const report = compareVisualPixels(
      paint(referenceImage), paint(previewImage), width, height, regions, threshold);
    const heatmap = document.createElement("canvas");
    heatmap.width = width; heatmap.height = height;
    const heatCtx = heatmap.getContext("2d");
    if (!heatCtx) throw new Error("Cannot generate heatmap.");
    const pixels = heatCtx.createImageData(width, height);
    pixels.data.set(report.heatmap);
    heatCtx.putImageData(pixels, 0, 0);
    return { report, heatmapUrl: heatmap.toDataURL("image/png") };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
