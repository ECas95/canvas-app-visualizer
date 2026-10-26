import { describe, expect, it } from "vitest";
import { controlRect } from "./layout";
import type { CanvasControl } from "../../types/canvas";

// Synthetic .pa.yaml-style controls only: no private screen, SQL records,
// runtime permissions, or captured Power Apps Studio state.
function fixture(properties: Record<string, string>): CanvasControl {
  return {
    id: "Synthetic", name: "Synthetic", controlType: "Classic/Label@2.5.1",
    properties, children: [], zIndex: 1, sourceFormat: "pa-yaml-v3",
    sourceFile: "Src/Synthetic.pa.yaml",
    sourcePath: "Screens/Synthetic/Synthetic"
  };
}

function rect(properties: Record<string, string>, appWidth: number) {
  return controlRect(fixture(properties), 0, {
    parentWidth: appWidth, parentHeight: 700,
    appWidth, appHeight: 700
  });
}

describe("Self geometry provenance in source-only preview", () => {
  it.each([390, 768, 1366])(
    "does not certify circular Width/Height from paint fallbacks at %i px",
    appWidth => {
      const width = rect({
        Width: "=Self.Width + 10", Height: "=32",
        X: "=Parent.Width - Self.Width", Y: "=10"
      }, appWidth);
      expect(width.dynamic).toBe(true);
      expect(width.width).toBe(220); // paint fallback, not a verified Width
      expect(width.x).toBe(24); // approximate unresolved X
      const height = rect({
        Width: "=100", Height: "=Self.Height + 5",
        X: "=20", Y: "=Parent.Height - Self.Height"
      }, appWidth);
      expect(height.dynamic).toBe(true);
      expect(height.height).toBe(40);
      expect(height.y).toBe(24);
    }
  );

  it.each([390, 768, 1366])(
    "keeps SQL-dependent Self dimensions unresolved at %i px",
    appWidth => {
      const result = rect({
        Width: "=varSqlWidth", Height: "=varSqlHeight",
        X: "=Parent.Width - Self.Width", Y: "=Self.Height + 4"
      }, appWidth);
      expect(result.dynamic).toBe(true);
      expect(result.width).toBe(220);
      expect(result.height).toBe(40);
      expect(result.x).toBe(24);
      expect(result.y).toBe(24);
    }
  );

  it.each([390, 768, 1366])(
    "retains verified responsive Self and cross-axis dependencies at %i px",
    appWidth => {
      const result = rect({
        Width: "=Parent.Width / 2", Height: "=Self.Width / 4",
        X: "=Parent.Width - Self.Width", Y: "=Self.Height + 8"
      }, appWidth);
      expect(result).toEqual({
        x: appWidth / 2, y: appWidth / 8 + 8,
        width: appWidth / 2, height: appWidth / 8, dynamic: false
      });
    }
  );

  it("resolves Height from a verified Self.Y without inventing a size", () => {
    const result = rect({
      Width: "=100", X: "=10", Y: "=24",
      Height: "=Parent.Height - Self.Y - 20"
    }, 768);
    expect(result).toEqual({
      x: 10, y: 24, width: 100, height: 656, dynamic: false
    });
  });

  it("preserves omitted source dimensions as inspectable family defaults", () => {
    const result = rect({
      X: "=Parent.Width - Self.Width", Y: "=20"
    }, 768);
    expect(result).toEqual({
      x: 548, y: 20, width: 220, height: 40, dynamic: false
    });
  });
});
