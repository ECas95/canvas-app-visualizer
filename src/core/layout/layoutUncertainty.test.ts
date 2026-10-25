import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { autoLayoutChildren } from "./layout";

const child = (align?: string): CanvasControl => ({
  id: "child",
  name: "Child",
  controlType: "Classic/Label@2.5.1",
  properties: {
    Width: "=80",
    Height: "=20",
    ...(align === undefined ? {} : { AlignInContainer: align })
  },
  children: [],
  sourceFile: "Src/SyntheticAutoLayout.pa.yaml",
  sourcePath: "Screens/Synthetic/Host/Child",
  sourceFormat: "pa-yaml-v3",
  zIndex: 1
});

function layout(
  properties: Record<string, unknown>,
  childAlign?: string,
  appWidth = 300
) {
  const parent: CanvasControl = {
    id: "host",
    name: "Host",
    controlType: "GroupContainer@1.3.0",
    variant: "AutoLayout",
    properties: {
      LayoutDirection: "=LayoutDirection.Horizontal",
      LayoutJustifyContent: "=LayoutJustifyContent.Start",
      LayoutAlignItems: "=LayoutAlignItems.Start",
      ...properties
    },
    children: [child(childAlign)],
    sourceFile: "Src/SyntheticAutoLayout.pa.yaml",
    sourcePath: "Screens/Synthetic/Host",
    sourceFormat: "pa-yaml-v3",
    zIndex: 1
  };
  return autoLayoutChildren(parent, {
    parentWidth: appWidth,
    parentHeight: 100,
    appWidth,
    appHeight: 700
  })[0].rect;
}

describe("AutoLayout geometry certainty and inherited alignment", () => {
  it("does not assert exact positions for unknown runtime direction", () => {
    const rect = layout({ LayoutDirection: "=If(varHorizontal, LayoutDirection.Horizontal, LayoutDirection.Vertical)" });
    expect(rect.dynamic).toBe(true);
  });

  it("keeps responsive direction exact when the viewport determines the branch", () => {
    const direction = "=If(App.Width < 500, LayoutDirection.Vertical, LayoutDirection.Horizontal)";
    expect(layout({ LayoutDirection: direction }, undefined, 390).dynamic).toBe(false);
    expect(layout({ LayoutDirection: direction }, undefined, 900).dynamic).toBe(false);
  });

  it("marks unresolved gap or padding as approximate instead of verified zero", () => {
    expect(layout({ LayoutGap: "=varGap" }).dynamic).toBe(true);
    expect(layout({ PaddingLeft: "=varPadding" }).dynamic).toBe(true);
    expect(layout({ PaddingRight: "=varPadding" }).dynamic).toBe(true);
  });

  it("does not assert exact positions for unknown runtime justification", () => {
    expect(layout({ LayoutJustifyContent: "=If(varCenter, LayoutJustifyContent.Center, LayoutJustifyContent.Start)" }).dynamic)
      .toBe(true);
  });

  it("inherits the container alignment for AlignInContainer.SetByContainer", () => {
    const rect = layout({ LayoutAlignItems: "=LayoutAlignItems.Center" }, "=AlignInContainer.SetByContainer");
    expect(rect.y).toBe(40);
    expect(rect.dynamic).toBe(false);
  });

  it("marks unknown inherited alignment as approximate", () => {
    expect(layout({ LayoutAlignItems: "=varAlign" }, "=AlignInContainer.SetByContainer").dynamic)
      .toBe(true);
    expect(layout({}, "=varChildAlign").dynamic).toBe(true);
  });

  it("does not depend on unknown parent alignment when a child explicitly overrides it", () => {
    const rect = layout({ LayoutAlignItems: "=varAlign" }, "=AlignInContainer.End");
    expect(rect.y).toBe(80);
    expect(rect.dynamic).toBe(false);
  });
  it("does not certify a sibling's position when FillPortions depends on runtime state", () => {
    const first = child();
    first.properties.FillPortions = "=varPortions";
    const second = { ...child(), id: "second", name: "Second" };
    const parent: CanvasControl = {
      id: "host", name: "Host", controlType: "GroupContainer@1.3.0",
      variant: "AutoLayout",
      properties: { LayoutDirection: "=LayoutDirection.Horizontal", LayoutGap: "=8" },
      children: [first, second],
      sourceFile: "Src/SyntheticAutoLayout.pa.yaml",
      sourcePath: "Screens/Synthetic/Host",
      sourceFormat: "pa-yaml-v3", zIndex: 1
    };
    const rects = autoLayoutChildren(parent, {
      parentWidth: 300, parentHeight: 100, appWidth: 300, appHeight: 700
    }).map(item => item.rect);
    expect(rects.map(rect => rect.x)).toEqual([0, 88]);
    expect(rects.every(rect => rect.dynamic)).toBe(true);
  });

  it("marks sibling geometry approximate for unresolved size or constraints", () => {
    for (const [property, formula] of [
      ["Width", "=varWidth"],
      ["Height", "=varHeight"],
      ["LayoutMinWidth", "=varMin"],
      ["LayoutMaxWidth", "=varMax"],
      ["LayoutMinHeight", "=varMinHeight"],
      ["LayoutMaxHeight", "=varMaxHeight"]
    ]) {
      const first = child();
      first.properties[property] = formula;
      const second = { ...child(), id: "second", name: "Second" };
      const parent: CanvasControl = {
        id: "host", name: "Host", controlType: "GroupContainer@1.3.0",
        variant: "AutoLayout",
        properties: { LayoutDirection: "=LayoutDirection.Horizontal", LayoutGap: "=8" },
        children: [first, second],
        sourceFile: "Src/SyntheticAutoLayout.pa.yaml",
        sourcePath: "Screens/Synthetic/Host",
        sourceFormat: "pa-yaml-v3", zIndex: 1
      };
      const rects = autoLayoutChildren(parent, {
        parentWidth: 300, parentHeight: 100, appWidth: 300, appHeight: 700
      });
      expect(rects.every(item => item.rect.dynamic), property).toBe(true);
    }
  });

  it("keeps viewport-resolved sizing and omitted defaults verified", () => {
    const first = child();
    first.properties.FillPortions = "=If(App.Width < 500, 1, 0)";
    first.properties.LayoutMinWidth = "=If(App.Width < 500, 40, 60)";
    const parent: CanvasControl = {
      id: "host", name: "Host", controlType: "GroupContainer@1.3.0",
      variant: "AutoLayout",
      properties: { LayoutDirection: "=LayoutDirection.Horizontal" },
      children: [first],
      sourceFile: "Src/SyntheticAutoLayout.pa.yaml",
      sourcePath: "Screens/Synthetic/Host",
      sourceFormat: "pa-yaml-v3", zIndex: 1
    };
    for (const appWidth of [390, 768, 1366]) {
      const rect = autoLayoutChildren(parent, {
        parentWidth: appWidth, parentHeight: 100, appWidth, appHeight: 700
      })[0].rect;
      expect(rect.dynamic, String(appWidth)).toBe(false);
    }
  });

});
