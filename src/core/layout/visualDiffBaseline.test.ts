import { describe, expect, it } from "vitest";
import { compareVisualPixels } from "./visualDiff";
import { visualDiffReportJson } from "./visualDiffReport";
import { compareVisualBaseline, parseVisualBaseline } from "./visualDiffBaseline";

describe("local report version comparisons", () => {
  const region = [{ id: "Card", label: "Card", kind: "Container",
    x: 0, y: 0, width: 2, height: 2 }];
  const original = new Uint8ClampedArray(2 * 2 * 4).fill(255);
  const first = new Uint8ClampedArray(original);
  first.set([0, 0, 0, 255], 0);
  const previous = compareVisualPixels(original, first, 2, 2, region);
  const exported = visualDiffReportJson(previous, {
    screen: "Synthetic", reference: "fixture.png",
    generatedAt: "2026-11-03T15:00:00.000Z"
  });

  it("imports the exact prior export schema and detects improvement", () => {
    const baseline = parseVisualBaseline(exported);
    const updated = compareVisualPixels(original, original, 2, 2, region);
    const comparison = compareVisualBaseline(baseline, updated, "Synthetic");
    expect(comparison.compatible).toBe(true);
    expect(comparison.meanErrorDelta).toBeLessThan(0);
    expect(comparison.rmseDelta).toBeLessThan(0);
    expect(comparison.changedPercentDelta).toBeLessThan(0);
    expect(comparison.improvements[0].id).toBe("Card");
    expect(comparison.regressions).toHaveLength(0);
  });

  it("refuses incompatible screen, viewport or threshold", () => {
    const baseline = parseVisualBaseline(exported);
    expect(compareVisualBaseline(baseline, previous, "Other").compatible).toBe(false);
    expect(compareVisualBaseline(baseline,
      compareVisualPixels(original, first, 2, 2, region, 8), "Synthetic").compatible)
      .toBe(false);
  });

  it("rejects untrusted and oversized files with missing or invalid metrics", () => {
    for (const invalid of [
      "not json", "[]", "{}",
      '{"schemaVersion": 2}',
      JSON.stringify({ ...JSON.parse(exported), metrics: {
        ...JSON.parse(exported).metrics, changedPercent: "100"
      } }),
      " ".repeat(600_000)
    ]) {
      expect(() => parseVisualBaseline(invalid)).toThrow();
    }
  });

  it("keeps raw image bytes and source data outside the imported baseline model", () => {
    const baseline = parseVisualBaseline(exported);
    expect("heatmap" in baseline).toBe(false);
    expect("dataUrl" in baseline).toBe(false);
    expect(JSON.stringify(baseline)).not.toContain("data:image/");
  });
});
