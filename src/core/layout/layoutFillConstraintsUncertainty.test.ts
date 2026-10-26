import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { autoLayoutChildren } from "./layout";

// Synthetic .pa.yaml-shaped controls only: no SQL rows or runtime state.
function flexibleChild(name: string, constraints: Record<string, string> = {}): CanvasControl {
  return {
    id: name, name, controlType: "GroupContainer@1.3.0",
    properties: {
      Width: "=100", Height: "=30", FillPortions: "=1", ...constraints
    },
    children: [], sourceFile: "Src/SyntheticFill.pa.yaml",
    sourcePath: `Screens/Synthetic/Host/${name}`,
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
}

function positions(
  viewport: number,
  direction: "Horizontal" | "Vertical",
  constraints: Record<string, string>
) {
  const parent: CanvasControl = {
    id: "Host", name: "Host", controlType: "GroupContainer@1.3.0",
    variant: "AutoLayout",
    properties: {
      LayoutDirection: `=LayoutDirection.${direction}`,
      LayoutGap: "=0", LayoutJustifyContent: "=LayoutJustifyContent.Start"
    },
    children: [
      flexibleChild("Constrained", constraints),
      flexibleChild("Sibling")
    ],
    sourceFile: "Src/SyntheticFill.pa.yaml",
    sourcePath: "Screens/Synthetic/Host",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
  return autoLayoutChildren(parent, {
    parentWidth: direction === "Horizontal" ? viewport : 300,
    parentHeight: direction === "Vertical" ? viewport : 100,
    appWidth: viewport, appHeight: 844
  }).map(({ rect }) => rect);
}

describe("FillPortions with binding size constraints", () => {
  it.each([
    ["Horizontal", "LayoutMinWidth", "=240", [true, false, false]],
    ["Horizontal", "LayoutMaxWidth", "=500", [false, false, true]],
    ["Vertical", "LayoutMinHeight", "=240", [true, false, false]],
    ["Vertical", "LayoutMaxHeight", "=500", [false, false, true]]
  ] as const)(
    "%s %s does not certify unmodeled flexible redistribution",
    (direction, property, formula, expected) => {
      [390, 768, 1366].forEach((viewport, index) => {
        const rects = positions(viewport, direction, { [property]: formula });
        expect(rects.every(rect => rect.dynamic === expected[index]),
          `${direction} ${property} at ${viewport}`).toBe(true);
        expect(rects.every(rect =>
          [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
        )).toBe(true);
      });
    }
  );

  it("only marks the binding branch of responsive minimum width approximate", () => {
    const formula = "=If(App.Width < 600, 240, 0)";
    for (const [viewport, uncertain] of [
      [390, true], [768, false], [1366, false]
    ] as const) {
      expect(positions(viewport, "Horizontal", {
        LayoutMinWidth: formula
      }).every(rect => rect.dynamic === uncertain)).toBe(true);
    }
  });

  it("does not guess a SQL-dependent minimum size", () => {
    for (const viewport of [390, 768, 1366]) {
      expect(positions(viewport, "Horizontal", {
        LayoutMinWidth: "=varSqlMinimum"
      }).every(rect => rect.dynamic)).toBe(true);
    }
  });

  it("keeps unconstrained proportional sizing verified", () => {
    for (const viewport of [390, 768, 1366]) {
      const rects = positions(viewport, "Horizontal", {});
      expect(rects.every(rect => !rect.dynamic)).toBe(true);
      expect(rects[1].x).toBe(viewport / 2);
    }
  });
});
