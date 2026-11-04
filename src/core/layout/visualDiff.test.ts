import { describe, expect, it } from "vitest";
import { compareVisualPixels } from "./visualDiff";

const pixels = (rgba: number[], count: number) =>
  new Uint8ClampedArray(Array.from({ length: count }, () => rgba).flat());

describe("quantitative screenshot comparisons", () => {
  it("reports zero error for exact same-viewport pixels and clear heatmap", () => {
    const data = pixels([40, 60, 80, 255], 4);
    const result = compareVisualPixels(data, data, 2, 2);
    expect(result.meanAbsoluteError).toBe(0);
    expect(result.rootMeanSquareError).toBe(0);
    expect(result.changedPercent).toBe(0);
    expect(result.heatmap[3]).toBe(0);
  });

  it("calculates channel error and changed pixels using a known threshold", () => {
    const original = pixels([0, 0, 0, 255], 4);
    const rendered = pixels([0, 0, 0, 255], 4);
    // Exactly one bright red pixel: per-channel error 255/3=85.
    rendered.set([255, 0, 0, 255], 4);
    const result = compareVisualPixels(original, rendered, 2, 2,
      [{ id:"Card", label:"Card", kind:"container", x:1, y:0, width:1, height:2 }], 32);
    expect(result.meanAbsoluteError).toBeCloseTo(21.25);
    expect(result.rootMeanSquareError).toBeCloseTo(Math.sqrt(255 * 255 / 12));
    expect(result.changedPercent).toBe(25);
    expect(result.heatmap[7]).toBeGreaterThan(0);
    expect(result.heatmap[3]).toBe(0);
    expect(result.regions[0].meanAbsoluteError).toBeCloseTo(42.5);
    expect(result.regions[0].changedPercent).toBe(50);
  });

  it("uses the same channel-level RMSE for full image and identical region", () => {
    const reference = pixels([0, 0, 0, 255], 4);
    const preview = pixels([255, 0, 0, 255], 4);
    const report = compareVisualPixels(reference, preview, 2, 2,
      [{ id: "root", label: "root", kind: "Container", x: 0, y: 0, width: 2, height: 2 }]);
    expect(report.rootMeanSquareError).toBeCloseTo(Math.sqrt(255 * 255 / 3), 7);
    expect(report.regions[0].rootMeanSquareError).toBeCloseTo(report.rootMeanSquareError, 7);
    // The previous regional algorithm used sqrt((RGB mean)^2) = 85, not
    // channel-wise sqrt((255²+0+0)/3) ~=147.22.
    expect(report.regions[0].rootMeanSquareError).toBeGreaterThan(140);
  });

  it("returns exactly brute-force metrics for overlapping and clipped regions", () => {
    const width = 19, height = 13;
    const a = new Uint8ClampedArray(width * height * 4);
    const b = new Uint8ClampedArray(a.length);
    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      a.set([i % 256, (i * 17) % 256, (i * 3) % 256, 255], o);
      b.set([(i * 5) % 256, (i * 7) % 256, (i * 11) % 256, 255], o);
    }
    const regions = [
      {id:"outer",label:"Outer",kind:"Container",x:-4,y:0,width:23,height:13},
      {id:"inner",label:"Inner",kind:"Label",x:4,y:3,width:9,height:6},
      {id:"overlay",label:"Overlay",kind:"Image",x:3.2,y:2.1,width:5.1,height:4.8}
    ];
    const report = compareVisualPixels(a, b, width, height, regions, 32);
    for (const region of report.regions) {
      let totalAbs = 0, totalSquared = 0, changed = 0;
      for (let y = region.y; y < region.y + region.height; y++) {
        for (let x = region.x; x < region.x + region.width; x++) {
          let abs = 0, squared = 0;
          for (let k = 0; k < 3; k++) {
            const index = (y * width + x) * 4 + k;
            const d = Math.abs(a[index] - b[index]);
            abs += d;
            squared += d * d;
          }
          totalAbs += abs; totalSquared += squared;
          if (abs / 3 > 32) changed++;
        }
      }
      expect(region.meanAbsoluteError).toBeCloseTo(totalAbs / (3 * region.pixels), 8);
      expect(region.rootMeanSquareError).toBeCloseTo(
        Math.sqrt(totalSquared / (3 * region.pixels)), 8);
      expect(region.changedPercent).toBeCloseTo(changed * 100 / region.pixels, 8);
    }
  });

  it("supports four hundred highly overlapping regions with bounded scanline storage", () => {
    const reference = pixels([30, 30, 30, 255], 400 * 280);
    const preview = pixels([230, 230, 230, 255], 400 * 280);
    const regions = Array.from({length: 400}, (_, i) => ({
      id: String(i), label: "Nested " + i, kind: "Container",
      x: i % 5, y: i % 7, width: 400, height: 280
    }));
    const report = compareVisualPixels(reference, preview, 400, 280, regions);
    expect(report.regions).toHaveLength(400);
    expect(report.meanAbsoluteError).toBe(200);
    expect(report.regions[0].meanAbsoluteError).toBe(200);
    expect(report.regions[399].rootMeanSquareError).toBeCloseTo(200);
  });

  it("handles alpha compositing on white and clips nested regions to viewport", () => {
    const original = pixels([255, 255, 255, 255], 4);
    const rendered = pixels([10, 10, 10, 0], 4);
    rendered.set([0, 0, 0, 255], 0);
    const result = compareVisualPixels(original, rendered, 2, 2,
      [{id:"Gallery", label:"Gallery", kind:"gallery", x:-20, y:-20, width:21, height:21}]);
    expect(result.changedPercent).toBe(25);
    expect(result.regions[0]).toMatchObject({x:0, y:0, width:1, height:1, pixels:1, changedPercent:100});
  });

  it("fails closed on incompatible sizes, too many regions or invalid bounds", () => {
    const same = pixels([0, 0, 0, 255], 4);
    expect(() => compareVisualPixels(same, same, 3, 2)).toThrow();
    expect(() => compareVisualPixels(same, same, 2, 2, [], -1)).toThrow();
    expect(() => compareVisualPixels(same, same, 2, 2,
      [{ id:"bad",label:"bad",kind:"container",x:0,y:0,width:NaN,height:1 }])).toThrow();
    expect(() => compareVisualPixels(same, same, 2, 2,
      Array.from({length:401}, (_,i) => ({id:String(i),label:String(i),
        kind:"container",x:0,y:0,width:1,height:1})))).toThrow();
  });
});
