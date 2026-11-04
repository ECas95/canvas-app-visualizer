/**
 * Deterministic local pixel-comparison metrics for identically sized,
 * aligned reference and preview screenshots. This is an inspection aid,
 * not a guarantee of Power Apps runtime, data, fonts or permissions.
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
  meanAbsoluteError: number; // 0–255, across 3 composited RGB channels
  rootMeanSquareError: number; // 0–255, across 3 composited RGB channels
  changedPercent: number; // pixels whose mean RGB error exceeds threshold
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
export const MAX_DIFF_EDGE = 8192;

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

interface RegionAccumulator {
  source: PixelRegion;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sumAbsolute: number;
  sumSquared: number;
  changed: number;
}

/**
 * Streaming scanline comparison: O(width*height + height*regionCount), with
 * O(width + regionCount) temporary storage beyond the returned heatmap.
 * We compute row-prefix sums and use two lookups for each active region;
 * unlike rescanning every overlapping rectangle this stays responsive for
 * deeply nested Canvas containers and hundreds of regions.
 *
 * The *same* channel-wise squared error is used for full-screen and regional
 * RMSE. The previous implementation accidentally squared the mean per-pixel
 * difference for regions, understating errors with unbalanced RGB channels.
 *
 * Regions can overlap; sums or percentages across different source controls
 * must never be added together as though regions were disjoint.
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
      width <= 0 || height <= 0 || width > MAX_DIFF_EDGE || height > MAX_DIFF_EDGE ||
      width * height > MAX_DIFF_PIXELS ||
      reference.length !== width * height * 4 ||
      preview.length !== reference.length ||
      !Number.isFinite(threshold) || threshold < 0 || threshold > 255 ||
      regions.length > MAX_DIFF_REGIONS) {
    throw new Error("Invalid, oversized or nonmatching screenshot comparison.");
  }
  // Validate regions *before* allocating the heatmap. A malformed region
  // cannot trigger a partial or misleading comparison report.
  const prepared: RegionAccumulator[] = regions.map(source => {
    if (![source.x, source.y, source.width, source.height].every(Number.isFinite) ||
        source.width < 0 || source.height < 0) {
      throw new Error("Invalid source control region.");
    }
    return {
      source, ...bounds(source, width, height),
      sumAbsolute: 0, sumSquared: 0, changed: 0
    };
  });

  const heatmap = new Uint8ClampedArray(reference.length);
  const rowAbs = new Float64Array(width + 1);
  const rowSquared = new Float64Array(width + 1);
  const rowChanged = new Uint32Array(width + 1);
  let totalAbs = 0, totalSquared = 0, totalChanged = 0;

  for (let y = 0; y < height; y++) {
    rowAbs[0] = 0;
    rowSquared[0] = 0;
    rowChanged[0] = 0;
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      let absolute = 0, squared = 0;
      for (let channel = 0; channel < 3; channel++) {
        const delta = Math.abs(composite(reference, offset, channel) -
          composite(preview, offset, channel));
        absolute += delta;
        squared += delta * delta;
      }
      const mean = absolute / 3;
      const differs = mean > threshold ? 1 : 0;
      rowAbs[x + 1] = rowAbs[x] + absolute;
      rowSquared[x + 1] = rowSquared[x] + squared;
      rowChanged[x + 1] = rowChanged[x] + differs;
      heatmap[offset] = 255;
      heatmap[offset + 1] = 28;
      heatmap[offset + 2] = 28;
      heatmap[offset + 3] = differs === 0 ? 0 :
        Math.round(Math.min(230, (mean - threshold) /
          Math.max(1, 255 - threshold) * 230 + 25));
    }
    totalAbs += rowAbs[width];
    totalSquared += rowSquared[width];
    totalChanged += rowChanged[width];
    for (const region of prepared) {
      if (y < region.y0 || y >= region.y1) continue;
      region.sumAbsolute += rowAbs[region.x1] - rowAbs[region.x0];
      region.sumSquared += rowSquared[region.x1] - rowSquared[region.x0];
      region.changed += rowChanged[region.x1] - rowChanged[region.x0];
    }
  }

  const count = width * height;
  const metrics: PixelDiffMetric = {
    pixels: count,
    meanAbsoluteError: totalAbs / (count * 3),
    rootMeanSquareError: Math.sqrt(totalSquared / (count * 3)),
    changedPercent: totalChanged * 100 / count
  };
  const regionMetrics: PixelRegionMetric[] = prepared.map(region => {
    const count = (region.x1 - region.x0) * (region.y1 - region.y0);
    return {
      id: region.source.id,
      label: region.source.label,
      kind: region.source.kind,
      x: region.x0,
      y: region.y0,
      width: region.x1 - region.x0,
      height: region.y1 - region.y0,
      pixels: count,
      meanAbsoluteError: count ? region.sumAbsolute / (count * 3) : 0,
      rootMeanSquareError: count ? Math.sqrt(region.sumSquared / (count * 3)) : 0,
      changedPercent: count ? region.changed * 100 / count : 0
    };
  });
  return { ...metrics, width, height, threshold, regions: regionMetrics, heatmap };
}
