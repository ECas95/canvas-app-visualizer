import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { autoLayoutChildren } from "./layout";

// Synthetic .pa.yaml-shaped fixtures only; no customer YAML or runtime data.
function child(name: string, properties: Record<string, unknown> = {}): CanvasControl {
  return {
    id: name, name, controlType: "Classic/Label@2.5.1",
    properties: { Width: "=100", Height: "=30", ...properties },
    children: [], zIndex: 1, sourceFormat: "pa-yaml-v3",
    sourceFile: "Src/SyntheticBoundsVisibility.pa.yaml",
    sourcePath: `Screens/Synthetic/Host/${name}`
  };
}

function flow(viewport: number, children: CanvasControl[]) {
  const parent: CanvasControl = {
    id: "Host", name: "Host", controlType: "GroupContainer@1.3.0",
    variant: "AutoLayout",
    properties: {
      LayoutDirection: "=LayoutDirection.Horizontal",
      LayoutJustifyContent: "=LayoutJustifyContent.Start",
      LayoutAlignItems: "=LayoutAlignItems.Start",
      LayoutGap: "=10"
    },
    children, zIndex: 1, sourceFormat: "pa-yaml-v3",
    sourceFile: "Src/SyntheticBoundsVisibility.pa.yaml",
    sourcePath: "Screens/Synthetic/Host"
  };
  return autoLayoutChildren(parent, {
    parentWidth: viewport, parentHeight: 120,
    appWidth: viewport, appHeight: 844
  });
}

describe("AutoLayout source-only Self visibility with nonbinding constraints", () => {
  it.each([390, 768, 1366])(
    "excludes a proven hidden child despite nonbinding min/max at %i px",
    viewport => {
      const result = flow(viewport, [
        child("Hidden", {
          LayoutMinWidth: "=40", LayoutMaxWidth: "=200",
          LayoutMinHeight: "=20", LayoutMaxHeight: "=80",
          Visible: "=Self.Width > 110"
        }),
        child("Sibling")
      ]);
      expect(result.map(item => item.control.name)).toEqual(["Sibling"]);
      expect(result[0].rect.x).toBe(0);
      expect(result[0].rect.dynamic).toBe(true);
    }
  );

  it.each([390, 768, 1366])(
    "resolves both proven Self axes without claiming runtime geometry at %i px",
    viewport => {
      const result = flow(viewport, [
        child("Bounded", {
          LayoutMinWidth: "=40", LayoutMaxWidth: "=200",
          LayoutMinHeight: "=20", LayoutMaxHeight: "=80",
          Visible: "=Self.Width = 100 And Self.Height = 30"
        }),
        child("Sibling")
      ]);
      expect(result.map(item => item.control.name)).toEqual(["Bounded", "Sibling"]);
      expect(result[0].sourceVisibility).toBe("visible");
      expect(result[1].rect.x).toBe(110);
    }
  );

  it.each([390, 768, 1366])(
    "keeps binding min and max constraints unknown at %i px",
    viewport => {
      const result = flow(viewport, [
        child("MinBound", {
          LayoutMinWidth: "=250", Visible: "=Self.Width < 150"
        }),
        child("MaxBound", {
          LayoutMaxHeight: "=20", Visible: "=Self.Height > 25"
        })
      ]);
      expect(result.map(item => item.sourceVisibility)).toEqual(["unknown", "unknown"]);
      expect(result.every(item => item.rect.dynamic)).toBe(true);
    }
  );

  it("does not infer runtime-dependent or invalid bounds", () => {
    const result = flow(768, [
      child("Runtime", {
        LayoutMinWidth: "=varSqlPermission", Visible: "=Self.Width > 110"
      }),
      child("Invalid", {
        LayoutMaxWidth: "=-1", Visible: "=Self.Width > 110"
      }),
      child("ParentDependent", {
        LayoutMaxWidth: "=Parent.Width", Visible: "=Self.Width > 110"
      })
    ]);
    expect(result.map(item => item.sourceVisibility))
      .toEqual(["unknown", "unknown", "unknown"]);
    expect(result.every(item => item.rect.dynamic)).toBe(true);
  });

  it.each([390, 768, 1366])(
    "checks responsive bounds using only App viewport facts at %i px",
    viewport => {
      const result = flow(viewport, [
        child("Responsive", {
          LayoutMinWidth: "=If(App.Width < 600, 150, 40)",
          Visible: "=Self.Width > 110"
        }),
        child("Sibling")
      ]);
      expect(result.map(item => item.control.name)).toEqual(
        viewport === 390 ? ["Responsive", "Sibling"] : ["Sibling"]
      );
      if (viewport === 390) {
        expect(result[0].sourceVisibility).toBe("unknown");
        expect(result[0].rect.dynamic).toBe(true);
      }
    }
  );

  it("does not certify AutoHeight as Self.Height even with nonbinding bounds", () => {
    const result = flow(768, [
      child("AutoText", {
        AutoHeight: "=true", LayoutMinHeight: "=10",
        LayoutMaxHeight: "=80", Visible: "=Self.Height > 20"
      })
    ]);
    expect(result[0].sourceVisibility).toBe("unknown");
    expect(result[0].rect.dynamic).toBe(true);
  });
});
