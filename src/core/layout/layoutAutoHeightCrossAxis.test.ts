import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { autoLayoutChildren } from "./layout";

// Synthetic source-only controls. No private app, SQL rows or runtime state.
function child(name: string, controlType: string, autoHeight?: string): CanvasControl {
  return {
    id: name, name, controlType,
    properties: {
      Width: "=180", Height: "=20", Text: '="Preview text"',
      ...(autoHeight === undefined ? {} : { AutoHeight: autoHeight })
    },
    children: [], sourceFile: "Src/SyntheticAutoHeight.pa.yaml",
    sourcePath: `Screens/Synthetic/Host/${name}`,
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
}

function rects(
  viewport: number,
  autoHeight: string,
  wrap: boolean,
  controlType = "Classic/Label@2.5.1"
) {
  const parent: CanvasControl = {
    id: "Host", name: "Host", controlType: "GroupContainer@1.3.0",
    variant: "AutoLayout",
    properties: {
      LayoutDirection: "=LayoutDirection.Horizontal",
      // Wrap guides are verified only with Start alignment; unwrapped rows
      // exercise Center cross-axis placement independently.
      LayoutAlignItems: wrap ? "=LayoutAlignItems.Start" : "=LayoutAlignItems.Center",
      LayoutJustifyContent: "=LayoutJustifyContent.Start",
      LayoutWrap: wrap ? "=true" : "=false",
      LayoutGap: "=8"
    },
    children: [
      child("DynamicText", controlType, autoHeight),
      child("Sibling", "Classic/Label@2.5.1")
    ],
    sourceFile: "Src/SyntheticAutoHeight.pa.yaml",
    sourcePath: "Screens/Synthetic/Host",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
  return autoLayoutChildren(parent, {
    parentWidth: wrap ? 300 : viewport,
    parentHeight: 120,
    appWidth: viewport, appHeight: 844
  }).map(({ rect }) => rect);
}

describe("horizontal AutoLayout AutoHeight cross-axis uncertainty", () => {
  it.each([390, 768, 1366])(
    "does not certify centered child placement from source Height at %i px",
    viewport => {
      for (const type of ["Classic/Label@2.5.1", "ModernText@1.0.0"]) {
        const result = rects(viewport, "=true", false, type);
        expect(result.every(rect => rect.dynamic), type).toBe(true);
        expect(result.every(rect =>
          [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
        )).toBe(true);
      }
    }
  );

  it("does not certify subsequent wrapped row positions from unknown text height", () => {
    for (const viewport of [390, 768, 1366]) {
      const result = rects(viewport, "=true", true);
      expect(result.every(rect => rect.dynamic)).toBe(true);
      // The approximate coordinates are inspectable, not certified as a
      // measured text height or an exact wrapped line break.
      expect(result.every(rect =>
        [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
      )).toBe(true);
    }
  });

  it("resolves only the verified false branch of responsive AutoHeight", () => {
    const responsive = "=If(App.Width < 600, true, false)";
    for (const [viewport, uncertain] of [
      [390, true], [768, false], [1366, false]
    ] as const) {
      expect(rects(viewport, responsive, false).every(rect =>
        rect.dynamic === uncertain
      )).toBe(true);
      expect(rects(viewport, responsive, true).every(rect =>
        rect.dynamic === uncertain
      )).toBe(true);
    }
  });

  it("preserves verified fixed-height horizontal alignment", () => {
    for (const viewport of [390, 768, 1366]) {
      expect(rects(viewport, "=false", false).every(rect =>
        rect.dynamic === false
      )).toBe(true);
    }
  });

  it("keeps SQL-dependent AutoHeight unknown instead of assuming false", () => {
    for (const viewport of [390, 768, 1366]) {
      expect(rects(viewport, "=varSqlAutoHeight", false).every(rect =>
        rect.dynamic === true
      )).toBe(true);
    }
  });
});
