import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { buildSiblingGeometrySymbols, controlRect } from "./layout";

// Public synthetic controls; no private app source, SQL rows or permissions.
function fixture(name: string, properties: Record<string, unknown>): CanvasControl {
  return {
    id: name, name, controlType: "GroupContainer@1.3.0",
    properties, children: [], zIndex: 1, sourceFormat: "pa-yaml-v3",
    sourceFile: "Src/SyntheticAutoLayoutSiblings.pa.yaml",
    sourcePath: `Screens/Synthetic/Host/${name}`
  };
}

describe("AutoLayout-managed sibling coordinates", () => {
  it.each([390, 768, 1366])(
    "does not certify authored X/Y as actual sibling positions at %i px",
    viewport => {
      const first = fixture("First", {
        X: "=12", Y: "=20", Width: "=100", Height: "=40"
      });
      const second = fixture("Second", {
        X: "=First.X + 8", Y: "=First.Y + 10",
        Width: "=First.Width", Height: "=First.Height"
      });
      const context = {
        parentWidth: viewport, parentHeight: 700,
        appWidth: viewport, appHeight: 800
      };
      const managed = buildSiblingGeometrySymbols([first, second], context, true);
      expect(managed["First.Width"]).toBe(100);
      expect(managed["First.Height"]).toBe(40);
      expect(managed["First.X"]).toBeUndefined();
      expect(managed["First.Y"]).toBeUndefined();
      expect(managed["Second.X"]).toBeUndefined();
      expect(managed["Second.Y"]).toBeUndefined();
      expect(controlRect(second, 1, { ...context, symbols: managed }).dynamic).toBe(true);

      // Absolute-layout siblings may still use their source-proven positions.
      const absolute = buildSiblingGeometrySymbols([first, second], context);
      expect(absolute["First.X"]).toBe(12);
      expect(absolute["First.Y"]).toBe(20);
      expect(absolute["Second.X"]).toBe(20);
      expect(absolute["Second.Y"]).toBe(30);
    }
  );

  it.each([390, 768, 1366])(
    "keeps Self.X/Y-dependent sizes unknown under AutoLayout at %i px",
    viewport => {
      const dependent = fixture("Dependent", {
        X: "=12", Y: "=20",
        Width: "=Self.X + 100", Height: "=Self.Y + 40"
      });
      const context = {
        parentWidth: viewport, parentHeight: 700,
        appWidth: viewport, appHeight: 800
      };
      const managed = buildSiblingGeometrySymbols([dependent], context, true);
      for (const axis of ["X", "Y", "Width", "Height"]) {
        expect(managed[`Dependent.${axis}`]).toBeUndefined();
      }
      const absolute = buildSiblingGeometrySymbols([dependent], context);
      expect(absolute["Dependent.Width"]).toBe(112);
      expect(absolute["Dependent.Height"]).toBe(60);
    }
  );
});
