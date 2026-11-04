import type { PixelDiffReport, PixelRegionMetric } from "./visualDiff";

export type RegionPriority = "impact" | "intensity";

/**
 * Total impact highlights large areas needing correction first; intensity
 * highlights small, visually severe flaws. Regions overlap, so impacts are
 * directional priorities rather than additive screen-wide error budgets.
 */
export function rankVisualRegions(
  regions: readonly PixelRegionMetric[],
  mode: RegionPriority = "impact"
): PixelRegionMetric[] {
  const score = (region: PixelRegionMetric) =>
    mode === "impact" ? region.pixels * region.meanAbsoluteError :
      region.meanAbsoluteError;
  return regions.filter(r => r.pixels > 0)
    .sort((a, b) => score(b) - score(a) ||
      b.changedPercent - a.changedPercent || a.label.localeCompare(b.label));
}

export interface DiffExportContext {
  screen: string;
  reference: string;
  generatedAt: string;
}

/** No image contents, JSON URLs, auth tokens or raw gallery records exported. */
export function visualDiffReportJson(
  report: PixelDiffReport,
  context: DiffExportContext
): string {
  const { heatmap: _heatmap, regions, ...metrics } = report;
  void _heatmap;
  return JSON.stringify({
    schemaVersion: 1,
    source: "Canvas App Visualizer — local visual comparison",
    disclaimer: "Source/preview debugging only; no Power Apps runtime parity or access verification.",
    context,
    metrics,
    regions: rankVisualRegions(regions).map(r => ({
      ...r,
      impactScore: Math.round(r.meanAbsoluteError * r.pixels * 100) / 100
    }))
  }, null, 2);
}
