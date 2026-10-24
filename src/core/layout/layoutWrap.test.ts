import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { autoLayoutChildren } from "./layout";

function child(name: string, width: number, height: number): CanvasControl {
  return {
    id: name, name, controlType: "Classic/Label@2.5.1",
    properties: { Width: `=${width}`, Height: `=${height}` },
    children: [], sourceFile: "Src/SyntheticWrap.pa.yaml",
    sourcePath: `Screens/SyntheticWrap/${name}`,
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
}

function host(direction: "Horizontal" | "Vertical", wrap: string): CanvasControl {
  return {
    id: "Host", name: "Host", controlType: "GroupContainer@1.3.0",
    variant: "AutoLayout",
    properties: {
      LayoutDirection: `=LayoutDirection.${direction}`,
      LayoutJustifyContent: "=LayoutJustifyContent.Start",
      LayoutWrap: wrap, LayoutGap: "=10"
    },
    children: [child("One", 90, 30), child("Two", 90, 30), child("Three", 90, 30)],
    sourceFile: "Src/SyntheticWrap.pa.yaml",
    sourcePath: "Screens/SyntheticWrap/Host",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
}

function layout(parent: CanvasControl, width: number, height: number) {
  return autoLayoutChildren(parent, {
    parentWidth: width, parentHeight: height,
    appWidth: width, appHeight: height
  }).map(({ rect }) => rect);
}

describe("Canvas auto-layout source-only Wrap geometry", () => {
  it("wraps fixed horizontal children on a narrow viewport, not desktop", () => {
    const parent = host("Horizontal", "=true");
    expect(layout(parent, 300, 200).map(r => [r.x, r.y, r.dynamic]))
      .toEqual([[0, 0, false], [100, 0, false], [200, 0, false]]);
    expect(layout(parent, 210, 200).map(r => [r.x, r.y, r.dynamic]))
      .toEqual([[0, 0, false], [100, 0, false], [0, 40, false]]);
  });

  it("wraps vertical children into a new column when height is exhausted", () => {
    const parent = host("Vertical", "=true");
    parent.children = [child("One", 40, 90), child("Two", 50, 90), child("Three", 60, 90)];
    expect(layout(parent, 300, 210).map(r => [r.x, r.y, r.dynamic]))
      .toEqual([[0, 0, false], [0, 100, false], [60, 0, false]]);
  });

  it("does not wrap when explicitly false", () => {
    const rects = layout(host("Horizontal", "=false"), 210, 200);
    expect(rects.map(r => [r.x, r.y, r.dynamic]))
      .toEqual([[0, 0, false], [100, 0, false], [200, 0, false]]);
  });

  it("marks runtime-dependent Wrap as unresolved instead of asserting positions", () => {
    const rects = layout(host("Horizontal", "=varWrap"), 210, 200);
    expect(rects.every(r => r.dynamic)).toBe(true);
  });

  it("does not assert exact wrap geometry for FillPortions or unsupported justify", () => {
    const flexible = host("Horizontal", "=true");
    flexible.children[0].properties.FillPortions = "=1";
    expect(layout(flexible, 210, 200).every(r => r.dynamic)).toBe(true);

    const centered = host("Horizontal", "=true");
    centered.properties.LayoutJustifyContent = "=LayoutJustifyContent.Center";
    expect(layout(centered, 210, 200).every(r => r.dynamic)).toBe(true);
  });

  it("resolves viewport-dependent Wrap only when its branch is statically known", () => {
    const parent = host("Horizontal", "=If(App.Width < 240, true, false)");
    expect(layout(parent, 210, 200).map(r => [r.x, r.y, r.dynamic]))
      .toEqual([[0, 0, false], [100, 0, false], [0, 40, false]]);
    expect(layout(parent, 390, 200).map(r => [r.x, r.y, r.dynamic]))
      .toEqual([[0, 0, false], [100, 0, false], [200, 0, false]]);
  });
});

describe("Canvas zero-size AutoLayout children", () => {
  it("does not fabricate 8px width in a wrapped row", () => {
    const parent = host("Horizontal", "=true");
    parent.children = [child("Zero", 0, 30), child("Second", 90, 30), child("Third", 90, 30)];
    expect(layout(parent, 100, 120).map(r => [r.x, r.y, r.width, r.height, r.dynamic]))
      .toEqual([
        [0, 0, 0, 30, false],
        [10, 0, 90, 30, false],
        [0, 40, 90, 30, false]
      ]);
  });

  it("does not fabricate 8px height in a vertical stack", () => {
    const parent = host("Vertical", "=false");
    parent.children = [child("Zero", 40, 0), child("Next", 40, 50)];
    expect(layout(parent, 120, 100).map(r => [r.y, r.height, r.dynamic]))
      .toEqual([[0, 0, false], [10, 50, false]]);
  });
});
