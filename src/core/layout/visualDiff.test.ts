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
