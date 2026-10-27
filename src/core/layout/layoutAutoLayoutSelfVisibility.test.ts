import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { autoLayoutChildren } from "./layout";

// Synthetic .pa.yaml-shaped controls; no private sources or runtime SQL rows.
function child(name: string, properties: Record<string, unknown> = {}): CanvasControl {
  return {
    id: name, name, controlType: "Classic/Label@2.5.1",
    properties: { Width: "=100", Height: "=30", ...properties },
    children: [], zIndex: 1, sourceFormat: "pa-yaml-v3",
    sourceFile: "Src/SyntheticSelfVisibility.pa.yaml",
    sourcePath: `Screens/Synthetic/Host/${name}`
  };
}

function flow(viewport: number, children: CanvasControl[],
  hostProperties: Record<string, unknown> = {},
  symbols?: Record<string, number>) {
  const host: CanvasControl = {
    id: "Host", name: "Host", controlType: "GroupContainer@1.3.0",
    variant: "AutoLayout",
    properties: {
      LayoutDirection: "=LayoutDirection.Horizontal",
      LayoutJustifyContent: "=LayoutJustifyContent.Start",
      LayoutAlignItems: "=LayoutAlignItems.Start",
      LayoutGap: "=10", ...hostProperties
    },
    children, zIndex: 1, sourceFormat: "pa-yaml-v3",
    sourceFile: "Src/SyntheticSelfVisibility.pa.yaml",
    sourcePath: "Screens/Synthetic/Host"
  };
  return autoLayoutChildren(host, {
    parentWidth: viewport, parentHeight: 120,
    appWidth: viewport, appHeight: 844, symbols
  });
}

describe("AutoLayout child Self visibility (source-only)", () => {
  it.each([390, 768, 1366])(
    "excludes only verified hidden fixed-size children at %i px", viewport => {
      const rects = flow(viewport, [
        child("Hidden", { Visible: "=Self.Width < 80" }),
        child("Shown", { Visible: "=Self.Height = 30" })
      ]);
      expect(rects.map(item => item.control.name)).toEqual(["Shown"]);
      expect(rects[0].rect.x).toBe(0);
      expect(rects[0].rect.dynamic).toBe(true);
    }
  );

  it.each([
    [390, false],
    [768, true],
    [1366, true]
  ])("evaluates App-based authored size at %i px", (viewport, shown) => {
    const rects = flow(viewport, [
      child("Responsive", {
        Width: "=App.Width / 2", Visible: "=Self.Width > 300"
      }),
      child("Sibling")
    ]);
    expect(rects.map(item => item.control.name)).toEqual(
      shown ? ["Responsive", "Sibling"] : ["Sibling"]
    );
    expect(rects[rects.length - 1].rect.x)
      .toBe(shown ? viewport / 2 + 10 : 0);
    expect(rects.every(item => item.rect.dynamic === !shown)).toBe(true);
  });

  it("does not use a guessed Parent size to hide a child", () => {
    const rects = flow(390, [
      child("Unknown", {
        Width: "=Parent.Width", Visible: "=Self.Width < 500"
      }),
      child("Sibling")
    ]);
    expect(rects).toHaveLength(2);
    expect(rects.every(item => item.rect.dynamic)).toBe(true);
  });

  it("does not certify a FillPortions-controlled Self.Width", () => {
    const rects = flow(390, [
      child("Flexible", {
        FillPortions: "=1", Visible: "=Self.Width < 200"
      }),
      child("Sibling")
    ]);
    expect(rects).toHaveLength(2);
    expect(rects.every(item => item.rect.dynamic)).toBe(true);
  });

  it("does not certify a min-constrained Self.Width", () => {
    const rects = flow(390, [
      child("Constrained", {
        LayoutMinWidth: "=250", Visible: "=Self.Width < 200"
      }),
      child("Sibling")
    ]);
    expect(rects).toHaveLength(2);
    expect(rects.every(item => item.rect.dynamic)).toBe(true);
  });

  it("does not certify inherited Stretch Self.Height", () => {
    const rects = flow(390, [
      child("Stretched", { Visible: "=Self.Height < 40" }),
      child("Sibling")
    ], { LayoutAlignItems: "=LayoutAlignItems.Stretch" });
    expect(rects).toHaveLength(2);
    expect(rects.every(item => item.rect.dynamic)).toBe(true);
  });

  it("never substitutes authored X/Y for AutoLayout-managed Self.X/Y", () => {
    const rects = flow(390, [
      child("Unknown", { X: "=0", Visible: "=Self.X < 10" }),
      child("Sibling")
    ]);
    expect(rects).toHaveLength(2);
    expect(rects.every(item => item.rect.dynamic)).toBe(true);
  });

  it("does not infer SQL permissions or hidden runtime-dependent children", () => {
    const rects = flow(390, [
      child("Unknown", { Visible: "=varSqlPermission" }),
      child("Sibling")
    ]);
    expect(rects).toHaveLength(2);
    expect(rects.every(item => item.rect.dynamic)).toBe(true);
  });
  it.each([390, 768, 1366])(
    "does not hide a child using fallback Parent geometry at %i px", viewport => {
      const rects = flow(viewport, [
        child("ParentDependent", { Visible: "=Parent.Width > 2000" }),
        child("Sibling")
      ]);
      expect(rects.map(item => item.control.name))
        .toEqual(["ParentDependent", "Sibling"]);
      expect(rects.every(item => item.rect.dynamic)).toBe(true);
    }
  );

  it("does not use externally supplied sibling geometry to decide visibility", () => {
    const rects = flow(390, [
      child("Dependent", { Visible: "=Peer.Width > 200" }),
      child("Peer")
    ], {}, { "Peer.Width": 100 });
    expect(rects.map(item => item.control.name))
      .toEqual(["Dependent", "Peer"]);
    expect(rects.every(item => item.rect.dynamic)).toBe(true);
  });

  it.each([
    [390, false], [768, true], [1366, true]
  ])("still resolves viewport-only visibility at %i px", (viewport, shown) => {
    const rects = flow(viewport, [
      child("ViewportDependent", { Visible: "=App.Width >= 768" }),
      child("Sibling")
    ]);
    expect(rects.map(item => item.control.name))
      .toEqual(shown ? ["ViewportDependent", "Sibling"] : ["Sibling"]);
  });

});
