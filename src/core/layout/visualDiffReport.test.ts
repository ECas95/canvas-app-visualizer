import { describe, expect, it } from "vitest";
import { compareVisualPixels } from "./visualDiff";
import { rankVisualRegions, visualDiffReportJson } from "./visualDiffReport";

describe("visual diagnostics export and prioritization", () => {
  const reference = new Uint8ClampedArray(8 * 6 * 4);
  const output = new Uint8ClampedArray(8 * 6 * 4);
  for (let i = 0; i < 8 * 6; i++) {
    reference.set([255, 255, 255, 255], i * 4);
    output.set([250, 250, 250, 255], i * 4);
  }
  // A small, severe error and a much larger, moderate error.
  output.set([0, 0, 0, 255], 0);
  for (let i = 24; i < 48; i++) output.set([170, 170, 170, 255], i * 4);
  const regions = [
    { id: "tiny", label: "Tiny Icon", kind: "Icon", x: 0, y: 0, width: 1, height: 1 },
    { id: "wide", label: "Large Card", kind: "Container", x: 0, y: 3, width: 8, height: 3 }
  ];

  it("prioritizes large total impact or a locally severe defect", () => {
    const report = compareVisualPixels(reference, output, 8, 6, regions);
    expect(rankVisualRegions(report.regions, "intensity")[0].id).toBe("tiny");
    expect(rankVisualRegions(report.regions, "impact")[0].id).toBe("wide");
    expect(rankVisualRegions(report.regions, "impact").length).toBe(2);
  });

  it("exports a deterministic JSON report without raw screenshots or heatmap bytes", () => {
    const report = compareVisualPixels(reference, output, 8, 6, regions);
    const json = visualDiffReportJson(report, {
      screen: "Synthetic Fixture", reference: "cropped.png",
      generatedAt: "2026-11-03T20:00:00.000Z"
    });
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.metrics.width).toBe(8);
    expect(parsed.metrics.threshold).toBe(32);
    expect(parsed.context.reference).toBe("cropped.png");
    expect(parsed.regions[0].id).toBe("wide");
    expect(parsed.regions[0].impactScore).toBeGreaterThan(0);
    expect(parsed.metrics.heatmap).toBeUndefined();
    expect(json).not.toContain("data:image/");
    expect(json).not.toContain("Uint8ClampedArray");
    expect(json).not.toContain('"heatmap"');
  });
});
