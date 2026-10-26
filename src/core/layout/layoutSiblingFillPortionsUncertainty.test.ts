import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { buildSiblingGeometrySymbols, controlRect } from "./layout";

// Public synthetic controls only. No SQL rows, identities, permissions or connectors.
function fixture(name: string, properties: Record<string, unknown>): CanvasControl {
  return {
    id: name, name, controlType: "GroupContainer@1.3.0",
    properties, children: [], zIndex: 1,
    sourceFormat: "pa-yaml-v3",
    sourceFile: "Src/SyntheticFill.pa.yaml",
    sourcePath: `Screens/Synthetic/${name}`
  };
}

describe("sibling symbols with parent-managed FillPortions", () => {
  it.each([390, 768, 1366])(
    "does not certify authored geometry of a flexible child at %i px",
    viewport => {
      const flexible = fixture("Flexible", {
        X: "=10", Y: "=20", Width: "=100", Height: "=40",
        FillPortions: "=1"
      });
      const dependent = fixture("Dependent", {
        X: "=Flexible.Width + 8", Y: "=Flexible.Y + 12",
        Width: "=100", Height: "=40"
      });
      const context = {
        parentWidth: viewport, parentHeight: 700,
        appWidth: viewport, appHeight: 800
      };
      const symbols = buildSiblingGeometrySymbols([flexible, dependent], context);
      for (const axis of ["X", "Y", "Width", "Height"]) {
        expect(symbols[`Flexible.${axis}`]).toBeUndefined();
      }
      expect(controlRect(dependent, 1, { ...context, symbols }).dynamic).toBe(true);
    }
  );

  it.each([
    { viewport: 390, unknown: true },
    { viewport: 768, unknown: false },
    { viewport: 1366, unknown: false }
  ])("respects a verified responsive zero FillPortions branch at $viewport px",
    ({ viewport, unknown }) => {
      const flexible = fixture("Flexible", {
        X: "=10", Y: "=20", Width: "=100", Height: "=40",
        FillPortions: "=If(App.Width < 600, 1, 0)"
      });
      const context = {
        parentWidth: viewport, parentHeight: 700,
        appWidth: viewport, appHeight: 800
      };
      const symbols = buildSiblingGeometrySymbols([flexible], context);
      expect(symbols["Flexible.Width"] === undefined).toBe(unknown);
      expect(symbols["Flexible.Height"] === undefined).toBe(unknown);
      if (!unknown) {
        expect(symbols["Flexible.X"]).toBe(10);
        expect(symbols["Flexible.Y"]).toBe(20);
      }
    }
  );

  it.each([390, 768, 1366])(
    "keeps unresolved runtime FillPortions unknown at %i px",
    viewport => {
      const flexible = fixture("Flexible", {
        Width: "=100", Height: "=40", FillPortions: "=varSqlAllocation"
      });
      const symbols = buildSiblingGeometrySymbols([flexible], {
        parentWidth: viewport, parentHeight: 700,
        appWidth: viewport, appHeight: 800
      });
      expect(symbols["Flexible.Width"]).toBeUndefined();
      expect(symbols["Flexible.Height"]).toBeUndefined();
    }
  );
});
