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

  it("resolves viewport-dependent overflow enums without running behaviors", () => {
    const formula = "=If(App.Width < 720, LayoutOverflow.Scroll, LayoutOverflow.Hide)";
    expect(previewOverflowMode(formula, { "App.Width": 390 })).toBe("scroll");
    expect(previewOverflowMode(formula, { "App.Width": 1366 })).toBe("hide");
    expect(previewOverflowMode(formula)).toBe("unknown");
    expect(previewOverflowMode('="LayoutOverflow.Scroll"')).toBe("unknown");
    expect(previewOverflowMode('=If(App.Width < 720, "LayoutOverflow.Scroll", LayoutOverflow.Hide)',
      { "App.Width": 390 })).toBe("unknown");
    expect(previewOverflowMode("=If(varCanScroll, LayoutOverflow.Scroll, LayoutOverflow.Hide)",
      { "App.Width": 390 })).toBe("unknown");
  });

  it("computes scroll extents only at viewports with proven Scroll", () => {
    const host = item("Host", [], 0, 0, 100, 100, {
      overflowY: "=If(App.Width < 720, LayoutOverflow.Scroll, LayoutOverflow.Hide)"
    });
    const child = item("Child", ["Host"], 0, 0, 100, 180);
    expect(previewScrollRanges([{ ...host, symbols: { "App.Width": 390 } }, child]))
      .toEqual({ Host: { x: 0, y: 80 } });
    expect(previewScrollRanges([{ ...host, symbols: { "App.Width": 1366 } }, child]))
      .not.toHaveProperty("Host");
    expect(previewScrollRanges([host, child])).not.toHaveProperty("Host");
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

  it("includes verified trailing auto-layout padding in both scroll axes", () => {
    const host = item("Host", [], 10, 20, 100, 100, {
      overflowX: "=LayoutOverflow.Scroll", overflowY: "=LayoutOverflow.Scroll",
      paddingRight: "=16", paddingBottom: "=24"
    });
    const child = item("Child", ["Host"], 10, 20, 100, 90);
    expect(previewScrollRanges([host, child])).toEqual({
      Host: { x: 16, y: 14 }
    });
    expect(previewScrollRanges([{ ...host, paddingRight: "=0", paddingBottom: "=0" }, child]))
      .not.toHaveProperty("Host");
  });

  it("evaluates viewport-dependent trailing padding without runtime assumptions", () => {
    const host = item("Host", [], 0, 0, 100, 100, {
      overflowY: "=LayoutOverflow.Scroll",
      paddingBottom: "=If(App.Width < 720, 25, 0)"
    });
    const child = item("Child", ["Host"], 0, 0, 100, 90);
    expect(previewScrollRanges([{ ...host, symbols: { "App.Width": 390 } }, child]))
      .toEqual({ Host: { x: 0, y: 15 } });
    expect(previewScrollRanges([{ ...host, symbols: { "App.Width": 1366 } }, child]))
      .not.toHaveProperty("Host");
    expect(previewScrollRanges([host, child])).not.toHaveProperty("Host");
  });

  it("rejects unknown trailing padding only on the scrollable axis", () => {
    const child = item("Child", ["Host"], 0, 0, 100, 180);
    const host = item("Host", [], 0, 0, 100, 100, {
      overflowY: "=LayoutOverflow.Scroll",
      paddingRight: "=unknownHorizontalPadding",
      paddingBottom: "=unknownVerticalPadding"
    });
    expect(previewScrollRanges([host, child])).not.toHaveProperty("Host");
    expect(previewScrollRanges([{ ...host, paddingBottom: "=0" }, child]))
      .toEqual({ Host: { x: 0, y: 80 } });
    expect(previewScrollRanges([{ ...host, paddingBottom: "=-10" }, child]))
      .not.toHaveProperty("Host");
  });
  it("does not invent overflow from an editor Group's serialized bounding box", () => {
    const nodes = [
      item("Host", [], 0, 0, 200, 100, { overflowY: "=LayoutOverflow.Scroll" }),
      item("EditorGroup", ["Host"], 0, 0, 600, 400, { editorGroup: true }),
      item("VisibleChild", ["Host", "EditorGroup"], 0, 0, 100, 90)
    ];
    expect(previewScrollRanges(nodes)).not.toHaveProperty("Host");
  });

  it("counts children through editor Groups using their real coordinates", () => {
    const nodes = [
      item("Host", [], 10, 20, 200, 100, { overflowY: "=LayoutOverflow.Scroll" }),
      item("EditorGroup", ["Host"], 0, 0, 600, 400, {
        editorGroup: true, dynamic: true, overflowY: "=LayoutOverflow.Scroll"
      }),
      item("VisibleChild", ["Host", "EditorGroup"], 10, 20, 100, 180)
    ];
    expect(previewScrollRanges(nodes)).toEqual({ Host: { x: 0, y: 80 } });
    expect(previewScrollRanges(nodes)).not.toHaveProperty("EditorGroup");
  });

  it("does not flatten a real nested container when an editor Group surrounds it", () => {
    const nodes = [
      item("Host", [], 0, 0, 200, 100, { overflowY: "=LayoutOverflow.Scroll" }),
      item("EditorGroup", ["Host"], 0, 0, 600, 400, { editorGroup: true }),
      item("Inner", ["Host", "EditorGroup"], 0, 0, 150, 80, {
        overflowY: "=LayoutOverflow.Scroll"
      }),
      item("Leaf", ["Host", "EditorGroup", "Inner"], 0, 0, 100, 200)
    ];
    expect(previewScrollRanges(nodes)).toEqual({ Inner: { x: 0, y: 120 } });
  });

  it("never treats descendants behind a non-Group ancestor as direct scroll content", () => {
    const nodes = [
      item("Host", [], 0, 0, 200, 100, { overflowY: "=LayoutOverflow.Scroll" }),
      item("Inner", ["Host"], 0, 0, 150, 80),
      item("EditorGroup", ["Host", "Inner"], 0, 0, 600, 400, { editorGroup: true }),
      item("Leaf", ["Host", "Inner", "EditorGroup"], 0, 0, 100, 240)
    ];
    expect(previewScrollRanges(nodes)).not.toHaveProperty("Host");
  });

});
