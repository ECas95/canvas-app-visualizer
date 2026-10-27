import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { buildSiblingGeometrySymbols, controlRect } from "./layout";

// Public synthetic Canvas v3 fixtures; no SQL rows, user identities or connectors.
function fixture(name: string, properties: Record<string, unknown>): CanvasControl {
  return {
    id: name, name, controlType: "GroupContainer@1.3.0",
    properties, children: [], zIndex: 1, sourceFormat: "pa-yaml-v3",
    sourceFile: "Src/SyntheticInheritedAlign.pa.yaml",
    sourcePath: `Screens/Synthetic/Host/${name}`
  };
}
const context = (viewport: number) => ({
  parentWidth: viewport, parentHeight: 700,
  appWidth: viewport, appHeight: 800
});

describe("AutoLayout inherited Stretch sibling provenance", () => {
  it.each([
    { viewport: 390, unknown: true },
    { viewport: 768, unknown: false },
    { viewport: 1366, unknown: false }
  ])("resolves parent responsive alignment only from App viewport at $viewport px",
    ({ viewport, unknown }) => {
      const child = fixture("Card", {
        Width: "=100", Height: "=40", AlignInContainer: "=AlignInContainer.SetByContainer"
      });
      const dependent = fixture("Dependent", {
        X: "=Card.Width + 8", Width: "=Card.Height * 2", Height: "=40"
      });
      const symbols = buildSiblingGeometrySymbols(
        [child, dependent], context(viewport), true,
        "=If(App.Width < 600, LayoutAlignItems.Stretch, LayoutAlignItems.Start)"
      );
      expect(symbols["Card.Width"] === undefined).toBe(unknown);
      expect(symbols["Card.Height"] === undefined).toBe(unknown);
      expect(symbols["Card.X"]).toBeUndefined();
      expect(symbols["Card.Y"]).toBeUndefined();
      expect(controlRect(dependent, 1, { ...context(viewport), symbols }).dynamic)
        .toBe(unknown);
    }
  );

  it.each([390, 768, 1366])(
    "does not certify inherited runtime-unknown alignment at %i px",
    viewport => {
      const child = fixture("Card", { Width: "=100", Height: "=40" });
      const symbols = buildSiblingGeometrySymbols(
        [child], context(viewport), true, "=varSqlAlignment"
      );
      expect(symbols["Card.Width"]).toBeUndefined();
      expect(symbols["Card.Height"]).toBeUndefined();
    }
  );

  it("does not use a preview-only Parent.Width to certify inherited alignment", () => {
    const child = fixture("Card", { Width: "=100", Height: "=40" });
    const symbols = buildSiblingGeometrySymbols(
      [child], context(768), true,
      "=If(Parent.Width < 600, LayoutAlignItems.Stretch, LayoutAlignItems.Start)"
    );
    expect(symbols["Card.Width"]).toBeUndefined();
    expect(symbols["Card.Height"]).toBeUndefined();
  });

  it("honors an explicit child Start override of parent Stretch", () => {
    const child = fixture("Card", {
      Width: "=100", Height: "=40",
      AlignInContainer: "=AlignInContainer.Start"
    });
    const symbols = buildSiblingGeometrySymbols(
      [child], context(390), true, "=LayoutAlignItems.Stretch"
    );
    expect(symbols["Card.Width"]).toBe(100);
    expect(symbols["Card.Height"]).toBe(40);
  });

  it("does not apply parent AutoLayout alignment to absolute siblings", () => {
    const child = fixture("Card", { X: "=12", Width: "=100", Height: "=40" });
    const symbols = buildSiblingGeometrySymbols(
      [child], context(390), false, "=LayoutAlignItems.Stretch"
    );
    expect(symbols["Card.Width"]).toBe(100);
    expect(symbols["Card.Height"]).toBe(40);
    expect(symbols["Card.X"]).toBe(12);
  });
});
