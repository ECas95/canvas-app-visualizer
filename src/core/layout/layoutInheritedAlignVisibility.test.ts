import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { autoLayoutChildren } from "./layout";

// Synthetic .pa.yaml-shaped controls only; no private source or SQL records.
function fixture(name: string, properties: Record<string, unknown>): CanvasControl {
  return {
    id: name, name, controlType: "Classic/Label@2.5.1",
    properties, children: [], zIndex: 1, sourceFormat: "pa-yaml-v3",
    sourceFile: "Src/SyntheticInheritedVisibility.pa.yaml",
    sourcePath: `Screens/Synthetic/Host/${name}`
  };
}

function flow(
  viewport: number, direction: "Horizontal" | "Vertical",
  alignment: string, childAlignment?: string
) {
  const axis = direction === "Horizontal" ? "Height" : "Width";
  const conditional = fixture("Conditional", {
    Width: "=100", Height: "=30",
    Visible: `=Self.${axis} > ${axis === "Height" ? 40 : 120}`,
    ...(childAlignment ? { AlignInContainer: childAlignment } : {})
  });
  const sibling = fixture("Sibling", { Width: "=100", Height: "=30" });
  const parent: CanvasControl = {
    id: "Host", name: "Host", controlType: "GroupContainer@1.3.0",
    variant: "AutoLayout",
    properties: {
      LayoutDirection: `=LayoutDirection.${direction}`,
      LayoutAlignItems: alignment,
      LayoutJustifyContent: "=LayoutJustifyContent.Start",
      LayoutGap: "=10"
    },
    children: [conditional, sibling], zIndex: 1, sourceFormat: "pa-yaml-v3",
    sourceFile: "Src/SyntheticInheritedVisibility.pa.yaml",
    sourcePath: "Screens/Synthetic/Host"
  };
  return autoLayoutChildren(parent, {
    // This geometry is for painting only; it is not proof of Parent.Width.
    parentWidth: viewport, parentHeight: 160,
    appWidth: viewport, appHeight: 800
  });
}

describe("inherited AutoLayout alignment and source-only visibility", () => {
  it.each(["Horizontal", "Vertical"] as const)(
    "never hides a %s child from preview-only Parent.Width", direction => {
      for (const viewport of [390, 768, 1366]) {
        const rects = flow(
          viewport, direction,
          "=If(Parent.Width > 600, LayoutAlignItems.Start, LayoutAlignItems.Stretch)"
        );
        expect(rects.map(item => item.control.name))
          .toEqual(["Conditional", "Sibling"]);
        expect(rects.every(item => item.rect.dynamic)).toBe(true);
      }
    }
  );

  it.each([390, 768, 1366])(
    "still resolves App-only inherited alignment at %i px", viewport => {
      const rects = flow(
        viewport, "Horizontal",
        "=If(App.Width < 600, LayoutAlignItems.Stretch, LayoutAlignItems.Start)"
      );
      expect(rects.map(item => item.control.name)).toEqual(
        viewport < 600 ? ["Conditional", "Sibling"] : ["Sibling"]
      );
      expect(rects.every(item => item.rect.dynamic)).toBe(true);
    }
  );

  it("keeps runtime-dependent inherited alignment unknown", () => {
    const rects = flow(768, "Horizontal", "=varSqlAlignment");
    expect(rects.map(item => item.control.name))
      .toEqual(["Conditional", "Sibling"]);
    expect(rects.every(item => item.rect.dynamic)).toBe(true);
  });

  it("respects an explicit child Start override of unknown parent alignment", () => {
    const rects = flow(
      768, "Horizontal", "=varSqlAlignment", "=AlignInContainer.Start"
    );
    expect(rects.map(item => item.control.name)).toEqual(["Sibling"]);
  });
});
