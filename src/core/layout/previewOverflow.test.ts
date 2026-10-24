import { describe, expect, it } from "vitest";
import {
  previewOverflowMode, previewScrollRanges, previewClampScroll,
  previewScrolledPosition, previewWheelScroll, type PreviewScrollItem
} from "./previewOverflow";

function item(id: string, ancestors: string[], x: number, y: number,
  width: number, height: number, extras: Partial<PreviewScrollItem> = {}): PreviewScrollItem {
  return {
    id, ancestors, x, y, width, height, dynamic: false,
    visibilityUnknown: false, ...extras
  };
}

describe("Canvas overflow semantics", () => {
  it("accepts only explicit LayoutOverflow enums, not unknown formulas", () => {
    expect(previewOverflowMode("=LayoutOverflow.Scroll")).toBe("scroll");
    expect(previewOverflowMode("LayoutOverflow.Hide")).toBe("hide");
    expect(previewOverflowMode("=If(varCanScroll, LayoutOverflow.Scroll, LayoutOverflow.Hide)")).toBe("unknown");
    expect(previewOverflowMode("=SQL.Scroll")).toBe("unknown");
    expect(previewOverflowMode(undefined)).toBe("hide");
  });

  it("calculates a vertical scroll range from known child geometry", () => {
    const nodes = [
      item("Host", [], 10, 20, 200, 100, { overflowY: "=LayoutOverflow.Scroll" }),
      item("First", ["Host"], 10, 20, 200, 80),
      item("Second", ["Host"], 10, 100, 200, 100)
    ];
    expect(previewScrollRanges(nodes).Host).toEqual({ x: 0, y: 80 });
  });

  it("scrolls horizontal-only hosts using a vertical wheel delta", () => {
    const range = { x: 140, y: 0 };
    expect(previewWheelScroll({ x: 0, y: 0 }, range, 0, 65)).toEqual({ x: 65, y: 0 });
    expect(previewWheelScroll({ x: 65, y: 0 }, range, 0, 200)).toEqual({ x: 140, y: 0 });
    expect(previewWheelScroll({ x: 140, y: 0 }, range, 0, -300)).toEqual({ x: 0, y: 0 });
  });

  it("never scrolls a hidden or unresolved axis", () => {
    const nodes = [
      item("Host", [], 0, 0, 100, 100, {
        overflowX: "=If(flag, LayoutOverflow.Scroll, LayoutOverflow.Hide)",
        overflowY: "=LayoutOverflow.Hide"
      }),
      item("Child", ["Host"], 0, 0, 500, 500)
    ];
    expect(previewScrollRanges(nodes)).not.toHaveProperty("Host");
  });

  it("rejects unknown geometry rather than inventing an extent", () => {
    const nodes = [
      item("Host", [], 0, 0, 100, 100, { overflowY: "=LayoutOverflow.Scroll" }),
      item("Dynamic", ["Host"], 0, 0, 100, 300, { dynamic: true })
    ];
    expect(previewScrollRanges(nodes)).not.toHaveProperty("Host");
  });

  it("applies nested offsets to descendants but never to the host itself", () => {
    const outer = item("Outer", [], 10, 20, 200, 200);
    const inner = item("Inner", ["Outer"], 20, 80, 100, 100);
    const leaf = item("Leaf", ["Outer", "Inner"], 40, 130, 20, 20);
    const offsets = { Outer: { x: 0, y: 30 }, Inner: { x: 5, y: 15 } };
    expect(previewScrolledPosition(outer, offsets)).toEqual({ x: 10, y: 20 });
    expect(previewScrolledPosition(inner, offsets)).toEqual({ x: 20, y: 50 });
    expect(previewScrolledPosition(leaf, offsets)).toEqual({ x: 35, y: 85 });
  });

  it("clamps stale viewport offsets and invalid deltas", () => {
    expect(previewClampScroll({ x: 400, y: -5 }, { x: 20, y: 40 }))
      .toEqual({ x: 20, y: 0 });
    expect(previewWheelScroll(undefined, { x: 0, y: 40 }, Infinity, NaN))
      .toEqual({ x: 0, y: 0 });
  });

  it("keeps independent nested host scroll ranges", () => {
    const nodes = [
      item("Outer", [], 0, 0, 300, 200, { overflowY: "=LayoutOverflow.Scroll" }),
      item("Inner", ["Outer"], 0, 20, 300, 240, { overflowY: "=LayoutOverflow.Scroll" }),
      item("Leaf", ["Outer", "Inner"], 0, 20, 300, 320)
    ];
    expect(previewScrollRanges(nodes)).toEqual({
      Outer: { x: 0, y: 60 }, Inner: { x: 0, y: 80 }
    });
  });
});
