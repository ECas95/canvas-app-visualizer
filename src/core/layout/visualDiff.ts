/**
 * Deterministic pixel-comparison metrics for already aligned, same-viewport
 * screenshots. These numbers describe renderer differences, NOT Power Apps
 * correctness, data parity or authorization.
 */
export interface PixelRegion {
  id: string;
  label: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelDiffMetric {
  pixels: number;
  meanAbsoluteError: number; // 0-255; mean channel absolute difference
  rootMeanSquareError: number; // 0-255
  changedPercent: number; // pixels above per-pixel threshold
}

export interface PixelRegionMetric extends PixelDiffMetric {
  id: string;
  label: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelDiffReport extends PixelDiffMetric {
  width: number;
  height: number;
  threshold: number;
  regions: PixelRegionMetric[];
  heatmap: Uint8ClampedArray;
}

export const MAX_DIFF_PIXELS = 4_000_000;
export const MAX_DIFF_REGIONS = 400;

function composite(data: Uint8ClampedArray, offset: number, channel: number): number {
  const alpha = data[offset + 3] / 255;
  return Math.round(data[offset + channel] * alpha + 255 * (1 - alpha));
}
function bounds(region: PixelRegion, width: number, height: number) {
  const x0 = Math.max(0, Math.min(width, Math.floor(region.x)));
  const y0 = Math.max(0, Math.min(height, Math.floor(region.y)));
  const x1 = Math.max(x0, Math.min(width, Math.ceil(region.x + region.width)));
  const y1 = Math.max(y0, Math.min(height, Math.ceil(region.y + region.height)));
  return { x0, y0, x1, y1 };
}

/**
 * Calculate one full-screen metric plus independently clipped regions for
 * containers, galleries and nested controls. A pixel can belong to multiple
 * source regions; regional metrics are not additive and must not be summed.
 */
export function compareVisualPixels(
  reference: Uint8ClampedArray,
  preview: Uint8ClampedArray,
  width: number,
  height: number,
  regions: readonly PixelRegion[] = [],
  threshold = 32
): PixelDiffReport {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width <= 0 || height <= 0 || width * height > MAX_DIFF_PIXELS ||
      reference.length !== width * height * 4 ||
      preview.length !== reference.length ||
      !Number.isFinite(threshold) || threshold < 0 || threshold > 255 ||
      regions.length > MAX_DIFF_REGIONS) {
    throw new Error("Invalid, oversized or nonmatching screenshot comparison.");
  }

  const heatmap = new Uint8ClampedArray(reference.length);
  const differences = new Float32Array(width * height);
  let totalAbs = 0, totalSquared = 0, changed = 0;
  for (let index = 0; index < width * height; index++) {
    const offset = index * 4;
    let sum = 0, squared = 0;
    for (let channel = 0; channel < 3; channel++) {
      const delta = Math.abs(composite(reference, offset, channel) -
        composite(preview, offset, channel));
      sum += delta;
      squared += delta * delta;
    }
    const mean = sum / 3;
    differences[index] = mean;
    totalAbs += sum;
    totalSquared += squared;
    if (mean > threshold) changed++;
    heatmap[offset] = 255;
    heatmap[offset + 1] = 28;
    heatmap[offset + 2] = 28;
    heatmap[offset + 3] = mean <= threshold ? 0 :
      Math.round(Math.min(230, (mean - threshold) / Math.max(1, 255 - threshold) * 230 + 25));
  }

  const count = width * height;
  const metrics: PixelDiffMetric = {
    pixels: count,
    meanAbsoluteError: totalAbs / (count * 3),
    rootMeanSquareError: Math.sqrt(totalSquared / (count * 3)),
    changedPercent: changed * 100 / count
  };
  const regionMetrics = regions.map(region => {
    if (![region.x, region.y, region.width, region.height].every(Number.isFinite) ||
        region.width < 0 || region.height < 0) {
      throw new Error("Invalid source control region.");
    }
    const { x0, y0, x1, y1 } = bounds(region, width, height);
    let sum = 0, square = 0, changedInRegion = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const mean = differences[y * width + x];
        sum += mean;
        square += mean * mean;
        if (mean > threshold) changedInRegion++;
      }
    }
    const pixels = (x1 - x0) * (y1 - y0);
    const regional: PixelRegionMetric = {
      id: region.id, label: region.label, kind: region.kind,
      x: x0, y: y0, width: x1 - x0, height: y1 - y0, pixels,
      meanAbsoluteError: pixels ? sum / pixels : 0,
      rootMeanSquareError: pixels ? Math.sqrt(square / pixels) : 0,
      changedPercent: pixels ? changedInRegion * 100 / pixels : 0
    };
    return regional;
  });
  return { ...metrics, width, height, threshold, regions: regionMetrics, heatmap };
}
