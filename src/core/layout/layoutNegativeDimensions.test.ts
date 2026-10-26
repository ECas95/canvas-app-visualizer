import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { autoLayoutChildren, buildSiblingGeometrySymbols, controlRect } from "./layout";

// Public synthetic fixtures only: no SQL rows, private YAML or runtime identities.
const control = (name: string, properties: Record<string, unknown>): CanvasControl => ({
  id: name, name, controlType: "Classic/Label@2.5.1",
  properties, children: [], zIndex: 1, sourceFormat: "pa-yaml-v3",
  sourceFile: "Src/Synthetic.pa.yaml", sourcePath: "Screens/Synthetic/" + name
});
const context = (width: number) => ({
  parentWidth: width, parentHeight: 700, appWidth: width, appHeight: 700
});

describe("negative Canvas dimensions are unverified preview geometry", () => {
  it.each([390, 768, 1366])(
    "never certifies a negative Width or feeds it to Self.Width at %i px",
    viewport => {
      const rect = controlRect(control("Negative", {
        Width: "=If(App.Width < 600, -20, 120)", Height: "=32",
        X: "=Parent.Width - Self.Width", Y: "=10"
      }), 0, context(viewport));
      if (viewport < 600) {
        expect(rect).toMatchObject({ x: 24, width: 220, dynamic: true });
      } else {
        expect(rect).toMatchObject({
          x: viewport - 120, width: 120, dynamic: false
        });
      }
    }
  );

  it.each([390, 768, 1366])(
    "never certifies a negative Height or feeds it to Self.Height at %i px",
    viewport => {
      const rect = controlRect(control("NegativeHeight", {
        Width: "=120", Height: "=If(App.Width < 600, -10, 40)",
        X: "=0", Y: "=Parent.Height - Self.Height"
      }), 0, context(viewport));
      if (viewport < 600) {
        expect(rect).toMatchObject({ y: 24, height: 40, dynamic: true });
      } else {
        expect(rect).toMatchObject({ y: 660, height: 40, dynamic: false });
      }
    }
  );

  it.each([390, 768, 1366])(
    "does not export negative sibling sizes as resolved symbols at %i px",
    viewport => {
      const controls = [
        control("Bad", { Width: "=-20", Height: "=32" }),
        control("Dependent", {
          Width: "=100", Height: "=20", X: "=Bad.Width + 10"
        })
      ];
      const symbols = buildSiblingGeometrySymbols(controls, context(viewport));
      expect(symbols["Bad.Width"]).toBeUndefined();
      expect(symbols["Bad.Height"]).toBe(32);
      expect(controlRect(controls[1], 1, {
        ...context(viewport), symbols
      }).dynamic).toBe(true);
    }
  );

  it.each([390, 768, 1366])(
    "marks an auto-layout row approximate when a child size is negative at %i px",
    viewport => {
      const parent: CanvasControl = {
        ...control("Host", { LayoutDirection: "=LayoutDirection.Horizontal" }),
        controlType: "GroupContainer@1.3.0", variant: "AutoLayout",
        children: [
          control("Bad", { Width: "=-10", Height: "=20" }),
          control("Next", { Width: "=80", Height: "=20" })
        ]
      };
      const children = autoLayoutChildren(parent, context(viewport));
      expect(children).toHaveLength(2);
      expect(children.every(child => child.rect.dynamic)).toBe(true);
      expect(children.every(child =>
        [child.rect.x, child.rect.y, child.rect.width, child.rect.height]
          .every(Number.isFinite)
      )).toBe(true);
    }
  );
});
