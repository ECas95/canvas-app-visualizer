import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { autoLayoutChildren } from "./layout";

// Synthetic .pa.yaml-shaped geometry only. No runtime rows or access state.
function child(
  name: string,
  fill: number,
  constraints: Record<string, string> = {}
): CanvasControl {
  return {
    id: name, name, controlType: "GroupContainer@1.3.0",
    properties: {
      Width: "=100", Height: "=30", FillPortions: `=${fill}`,
      ...constraints
    },
    children: [], zIndex: 1,
    sourceFile: "Src/SyntheticRedistribution.pa.yaml",
    sourcePath: `Screens/Synthetic/Host/${name}`,
    sourceFormat: "pa-yaml-v3"
  };
}

function preview(
  size: number,
  direction: "Horizontal" | "Vertical",
  children: CanvasControl[]
) {
  const host: CanvasControl = {
    id: "Host", name: "Host", controlType: "GroupContainer@1.3.0",
    variant: "AutoLayout",
    properties: {
      LayoutDirection: `=LayoutDirection.${direction}`,
      LayoutGap: "=0",
      LayoutJustifyContent: "=LayoutJustifyContent.Start"
    },
    children, zIndex: 1,
    sourceFile: "Src/SyntheticRedistribution.pa.yaml",
    sourcePath: "Screens/Synthetic/Host",
    sourceFormat: "pa-yaml-v3"
  };
  return autoLayoutChildren(host, {
    parentWidth: direction === "Horizontal" ? size : 300,
    parentHeight: direction === "Vertical" ? size : 100,
    appWidth: size, appHeight: 844
  }).map(item => item.rect);
}

describe("bounded FillPortions redistribution is approximate", () => {
  it.each(["Horizontal", "Vertical"] as const)(
    "%s redistributes the remainder after a binding minimum",
    direction => {
      const key = direction === "Horizontal" ? "LayoutMinWidth" : "LayoutMinHeight";
      const axis = direction === "Horizontal" ? "x" : "y";
      const dimension = direction === "Horizontal" ? "width" : "height";
      const rects = preview(390, direction, [
        child("Minimum", 1, { [key]: "=240" }), child("Remaining", 1)
      ]);
      expect(rects[0][dimension]).toBe(240);
      expect(rects[1][dimension]).toBe(150);
      expect(rects[1][axis]).toBe(240);
      expect(rects.every(rect => rect.dynamic)).toBe(true);
    }
  );

  it.each(["Horizontal", "Vertical"] as const)(
    "%s redistributes the surplus after a binding maximum",
    direction => {
      const key = direction === "Horizontal" ? "LayoutMaxWidth" : "LayoutMaxHeight";
      const axis = direction === "Horizontal" ? "x" : "y";
      const dimension = direction === "Horizontal" ? "width" : "height";
      const rects = preview(1366, direction, [
        child("Maximum", 1, { [key]: "=500" }), child("Remaining", 1)
      ]);
      expect(rects[0][dimension]).toBe(500);
      expect(rects[1][dimension]).toBe(866);
      expect(rects[1][axis]).toBe(500);
      expect(rects.every(rect => rect.dynamic)).toBe(true);
    }
  );

  it("recalculates remaining weighted shares after a maximum", () => {
    const rects = preview(800, "Horizontal", [
      child("Max", 1, { LayoutMaxWidth: "=100" }),
      child("Double", 2), child("Single", 1)
    ]);
    expect(rects[0].width).toBe(100);
    expect(rects[1].width).toBeCloseTo(700 * 2 / 3);
    expect(rects[2].width).toBeCloseTo(700 / 3);
    expect(rects[2].x).toBeCloseTo(100 + 700 * 2 / 3);
    expect(rects.every(rect => rect.dynamic)).toBe(true);
  });

  it("handles simultaneous minimum and maximum bounds", () => {
    const rects = preview(600, "Horizontal", [
      child("Min", 1, { LayoutMinWidth: "=250" }),
      child("Max", 1, { LayoutMaxWidth: "=100" }),
      child("Remainder", 1)
    ]);
    expect(rects.map(rect => rect.width)).toEqual([250, 100, 250]);
    expect(rects[2].x).toBe(350);
    expect(rects.every(rect => rect.dynamic)).toBe(true);
  });

  it("does not hide an over-constrained minimum by shrinking it", () => {
    const rects = preview(390, "Horizontal", [
      child("MinA", 1, { LayoutMinWidth: "=300" }),
      child("MinB", 1, { LayoutMinWidth: "=300" })
    ]);
    expect(rects.map(rect => rect.width)).toEqual([300, 300]);
    expect(rects[1].x).toBe(300);
    expect(rects.every(rect => rect.dynamic)).toBe(true);
  });

  it.each([390, 768, 1366])(
    "keeps unconstrained proportional sizes verified at %i px",
    viewport => {
      const rects = preview(viewport, "Horizontal", [
        child("One", 1), child("Three", 3)
      ]);
      expect(rects[0].width).toBe(viewport / 4);
      expect(rects[1].width).toBe(viewport * 3 / 4);
      expect(rects.every(rect => !rect.dynamic)).toBe(true);
    }
  );

  it("never resolves a runtime-dependent minimum as a verified value", () => {
    const rects = preview(390, "Horizontal", [
      child("Unknown", 1, { LayoutMinWidth: "=varSqlMinimum" }),
      child("Other", 1)
    ]);
    expect(rects.map(rect => rect.width)).toEqual([195, 195]);
    expect(rects.every(rect => rect.dynamic)).toBe(true);
  });
});
