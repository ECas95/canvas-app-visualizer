import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { autoLayoutChildren } from "./layout";

// Synthetic source-only fixtures: no private app, SQL rows or permission claims.
function child(name: string, properties: Record<string, unknown> = {}): CanvasControl {
  return {
    id: name, name, controlType: "GroupContainer@1.3.0",
    properties: { Width: "=100", Height: "=30", ...properties },
    children: [], zIndex: 1, sourceFormat: "pa-yaml-v3",
    sourceFile: "Src/SyntheticVisibility.pa.yaml",
    sourcePath: `Screens/Synthetic/Host/${name}`
  };
}
function layout(viewport: number, children: CanvasControl[],
  direction: "Horizontal" | "Vertical" = "Horizontal", wrap = false) {
  const host: CanvasControl = {
    id: "Host", name: "Host", controlType: "GroupContainer@1.3.0",
    variant: "AutoLayout",
    properties: {
      LayoutDirection: `=LayoutDirection.${direction}`,
      LayoutGap: "=10", LayoutWrap: wrap ? "=true" : "=false",
      LayoutJustifyContent: "=LayoutJustifyContent.Start",
      LayoutAlignItems: "=LayoutAlignItems.Start"
    },
    children, zIndex: 1, sourceFormat: "pa-yaml-v3",
    sourceFile: "Src/SyntheticVisibility.pa.yaml",
    sourcePath: "Screens/Synthetic/Host"
  };
  return autoLayoutChildren(host, {
    parentWidth: direction === "Horizontal" ? viewport : 200,
    parentHeight: direction === "Vertical" ? viewport : 120,
    appWidth: viewport, appHeight: 844
  });
}
describe("AutoLayout source-only visibility and sibling flow", () => {
  it.each(["Horizontal", "Vertical"] as const)(
    "omits a proven-hidden child in %s without certifying gaps", direction => {
      const rects = layout(390, [
        child("Hidden", { Visible: "=false" }), child("Visible")
      ], direction);
      expect(rects.map(item => item.control.name)).toEqual(["Visible"]);
      expect(rects[0].rect.x).toBe(0);
      expect(rects[0].rect.y).toBe(0);
      expect(rects[0].rect.dynamic).toBe(true);
    }
  );
  it.each([390, 768, 1366])(
    "handles responsive visibility at %i px", viewport => {
      const rects = layout(viewport, [
        child("Responsive", { Visible: "=App.Width >= 600" }), child("Always")
      ]);
      const shown = viewport >= 600;
      expect(rects.map(item => item.control.name)).toEqual(
        shown ? ["Responsive", "Always"] : ["Always"]
      );
      expect(rects[rects.length - 1].rect.x).toBe(shown ? 110 : 0);
      expect(rects.every(item => item.rect.dynamic === !shown)).toBe(true);
    }
  );
  it("reallocates flexible space only for source-proven visible children", () => {
    const rects = layout(390, [
      child("Hidden", { Visible: "=false", FillPortions: "=1" }),
      child("Remaining", { FillPortions: "=1" })
    ]);
    expect(rects).toHaveLength(1);
    expect(rects[0].rect.width).toBe(390);
    expect(rects[0].rect.dynamic).toBe(true);
  });
  it("keeps runtime-dependent visibility unresolved, without assuming access", () => {
    const rects = layout(390, [
      child("Unknown", { Visible: "=varSqlPermission" }), child("Sibling")
    ]);
    expect(rects).toHaveLength(2);
    expect(rects[1].rect.x).toBe(110);
    expect(rects.every(item => item.rect.dynamic)).toBe(true);
  });
  it("keeps wrap with hidden children approximate", () => {
    const rects = layout(150, [
      child("Hidden", { Visible: "=false" }),
      child("First"), child("Second")
    ], "Horizontal", true);
    expect(rects.map(item => item.control.name)).toEqual(["First", "Second"]);
    expect(rects.map(item => [item.rect.x, item.rect.y])).toEqual([
      [0, 0], [0, 40]
    ]);
    expect(rects.every(item => item.rect.dynamic)).toBe(true);
  });
  it("preserves verified positions for known-visible children", () => {
    const rects = layout(390, [
      child("First", { Visible: "=true" }), child("Second")
    ]);
    expect(rects.map(item => item.rect.x)).toEqual([0, 110]);
    expect(rects.every(item => !item.rect.dynamic)).toBe(true);
  });
});
