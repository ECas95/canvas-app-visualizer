import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { buildSiblingGeometrySymbols, controlRect } from "./layout";

// Synthetic .pa.yaml-style controls; no private YAML, SQL, users or permissions.
function fixture(name: string, properties: Record<string, unknown>): CanvasControl {
  return {
    id: name, name, controlType: "GroupContainer@1.3.0",
    properties, children: [], zIndex: 1, sourceFormat: "pa-yaml-v3",
    sourceFile: "Src/SyntheticBounds.pa.yaml",
    sourcePath: `Screens/Synthetic/Host/${name}`
  };
}
const context = (width: number) => ({
  parentWidth: width, parentHeight: 700, appWidth: width, appHeight: 800
});

describe("AutoLayout sibling min/max geometry provenance", () => {
  it.each([390, 768, 1366])(
    "does not export a clamped width or derived height at %i px",
    width => {
      const bounded = fixture("Bounded", {
        Width: "=100", Height: "=Self.Width / 2",
        LayoutMinWidth: "=250", X: "=12", Y: "=20"
      });
      const dependent = fixture("Dependent", {
        X: "=Bounded.Width + 8", Width: "=Bounded.Height * 2", Height: "=40"
      });
      const symbols = buildSiblingGeometrySymbols([bounded, dependent], context(width), true);
      for (const axis of ["X", "Y", "Width", "Height"]) {
        expect(symbols[`Bounded.${axis}`]).toBeUndefined();
      }
      expect(controlRect(dependent, 1, { ...context(width), symbols }).dynamic).toBe(true);
    }
  );

  it.each([
    { key: "LayoutMaxWidth", value: "=80" },
    { key: "LayoutMinHeight", value: "=60" },
    { key: "LayoutMaxHeight", value: "=30" },
    { key: "LayoutMinWidth", value: "=varSqlMin" },
    { key: "LayoutMaxHeight", value: "=varRuntimeMax" }
  ])("does not certify $key when binding or runtime-unknown", ({ key, value }) => {
    const bounded = fixture("Bounded", {
      Width: "=100", Height: "=40", [key]: value
    });
    const symbols = buildSiblingGeometrySymbols([bounded], context(768), true);
    expect(symbols["Bounded.Width"]).toBeUndefined();
    expect(symbols["Bounded.Height"]).toBeUndefined();
  });

  it.each([390, 768, 1366])(
    "preserves verified nonbinding bounds at %i px",
    width => {
      const fixed = fixture("Fixed", {
        Width: "=100", Height: "=40",
        LayoutMinWidth: "=40", LayoutMaxWidth: "=200",
        LayoutMinHeight: "=20", LayoutMaxHeight: "=60"
      });
      const symbols = buildSiblingGeometrySymbols([fixed], context(width), true);
      expect(symbols["Fixed.Width"]).toBe(100);
      expect(symbols["Fixed.Height"]).toBe(40);
      expect(symbols["Fixed.X"]).toBeUndefined();
    }
  );

  it.each([
    { width: 390, unknown: true },
    { width: 768, unknown: false },
    { width: 1366, unknown: false }
  ])("resolves responsive bounds at $width px", ({ width, unknown }) => {
    const bounded = fixture("Responsive", {
      Width: "=100", Height: "=40",
      LayoutMinWidth: "=If(App.Width < 600, 150, 0)"
    });
    const symbols = buildSiblingGeometrySymbols([bounded], context(width), true);
    expect(symbols["Responsive.Width"] === undefined).toBe(unknown);
    expect(symbols["Responsive.Height"] === undefined).toBe(unknown);
  });

  it("does not apply AutoLayout-only bounds to absolute-layout siblings", () => {
    const fixed = fixture("Fixed", {
      X: "=12", Y: "=20", Width: "=100", Height: "=40",
      LayoutMinWidth: "=250"
    });
    const symbols = buildSiblingGeometrySymbols([fixed], context(768), false);
    expect(symbols["Fixed.Width"]).toBe(100);
    expect(symbols["Fixed.Height"]).toBe(40);
    expect(symbols["Fixed.X"]).toBe(12);
  });
});
