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
  it("does not certify a gap from a numeric-error condition across viewports", () => {
    for (const viewport of [390, 768, 1366]) {
      const rect = layout({ LayoutGap: "=If(1/0 > 0, 12, 4)" }, undefined, viewport);
      expect(rect.dynamic, String(viewport)).toBe(true);
      expect([rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)).toBe(true);
    }
  });

  it("resolves logical functions responsively but keeps unknown SQL branches approximate", () => {
    const direction = "=If(And(App.Width < 720, Not(false)), LayoutDirection.Vertical, LayoutDirection.Horizontal)";
    for (const viewport of [390, 768, 1366]) {
      expect(layout({ LayoutDirection: direction }, undefined, viewport).dynamic, String(viewport))
        .toBe(false);
    }
    const gap = "=If(Or(App.Width < 600, varSqlAccess), 8, 4)";
    expect(layout({ LayoutGap: gap }, undefined, 390).dynamic).toBe(false);
    expect(layout({ LayoutGap: gap }, undefined, 768).dynamic).toBe(true);
    expect(layout({ LayoutGap: gap }, undefined, 1366).dynamic).toBe(true);
  });

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


  it("does not certify unsupported negative gap or padding across viewports", () => {
    for (const width of [390, 768, 1366]) {
      for (const property of ["LayoutGap", "PaddingLeft", "PaddingRight", "PaddingTop", "PaddingBottom"]) {
        const rect = layout({ [property]: "=-4" }, undefined, width);
        expect(rect.dynamic, `${property} at ${width}`).toBe(true);
        expect(Number.isFinite(rect.x) && Number.isFinite(rect.y)).toBe(true);
      }
      expect(layout({ LayoutGap: "=8", PaddingLeft: "=4" }, undefined, width).dynamic)
        .toBe(false);
    }
  });

  it("evaluates responsive spacing without treating the unsupported branch as verified", () => {
    const formula = "=If(App.Width < 500, -4, 8)";
    expect(layout({ LayoutGap: formula }, undefined, 390).dynamic).toBe(true);
    expect(layout({ LayoutGap: formula }, undefined, 768).dynamic).toBe(false);
    expect(layout({ LayoutGap: formula }, undefined, 1366).dynamic).toBe(false);
  });

  it("marks negative FillPortions and inconsistent size constraints approximate", () => {
    const cases: Array<Record<string, string>> = [
      { FillPortions: "=-1" },
      { LayoutMinWidth: "=-1" },
      { LayoutMaxWidth: "=-1" },
      { LayoutMinHeight: "=-1" },
      { LayoutMaxHeight: "=-1" },
      { LayoutMinWidth: "=120", LayoutMaxWidth: "=80" },
      { LayoutMinHeight: "=80", LayoutMaxHeight: "=20" }
    ];
    for (const properties of cases) {
      const first = child();
      Object.assign(first.properties, properties);
      const parent: CanvasControl = {
        id: "host", name: "Host", controlType: "GroupContainer@1.3.0",
        variant: "AutoLayout",
        properties: { LayoutDirection: "=LayoutDirection.Horizontal", LayoutGap: "=8" },
        children: [first, { ...child(), id: "second", name: "Second" }],
        sourceFile: "Src/SyntheticAutoLayout.pa.yaml",
        sourcePath: "Screens/Synthetic/Host", sourceFormat: "pa-yaml-v3", zIndex: 1
      };
      for (const width of [390, 768, 1366]) {
        const rects = autoLayoutChildren(parent, {
          parentWidth: width, parentHeight: 100, appWidth: width, appHeight: 700
        }).map(item => item.rect);
        expect(rects.every(rect => rect.dynamic), JSON.stringify(properties)).toBe(true);
        expect(rects.every(rect => [rect.x, rect.y, rect.width, rect.height]
          .every(Number.isFinite))).toBe(true);
      }
    }
  });

  it("does not certify wrapped geometry with negative FillPortions", () => {
    const first = child();
    first.properties.FillPortions = "=-1";
    const parent: CanvasControl = {
      id: "host", name: "Host", controlType: "GroupContainer@1.3.0",
      variant: "AutoLayout",
      properties: {
        LayoutDirection: "=LayoutDirection.Horizontal",
        LayoutJustifyContent: "=LayoutJustifyContent.Start",
        LayoutWrap: "=true", LayoutGap: "=8"
      },
      children: [first, { ...child(), id: "second", name: "Second" }],
      sourceFile: "Src/SyntheticAutoLayout.pa.yaml",
      sourcePath: "Screens/Synthetic/Host", sourceFormat: "pa-yaml-v3", zIndex: 1
    };
    const rects = autoLayoutChildren(parent, {
      parentWidth: 390, parentHeight: 100, appWidth: 390, appHeight: 700
    });
    expect(rects.every(item => item.rect.dynamic)).toBe(true);
  });

  it("keeps valid responsive FillPortions verified in both selected branches", () => {
    const first = child();
    first.properties.FillPortions = "=If(App.Width < 500, -1, 1)";
    const parent: CanvasControl = {
      id: "host", name: "Host", controlType: "GroupContainer@1.3.0",
      variant: "AutoLayout",
      properties: { LayoutDirection: "=LayoutDirection.Horizontal" },
      children: [first],
      sourceFile: "Src/SyntheticAutoLayout.pa.yaml",
      sourcePath: "Screens/Synthetic/Host", sourceFormat: "pa-yaml-v3", zIndex: 1
    };
    for (const [width, expected] of [[390, true], [768, false], [1366, false]] as const) {
      const rect = autoLayoutChildren(parent, {
        parentWidth: width, parentHeight: 100, appWidth: width, appHeight: 700
      })[0].rect;
      expect(rect.dynamic, String(width)).toBe(expected);
    }
  });


  it.each([
    "=LayoutAlignItems.Center",
    "=LayoutAlignItems.End",
    "=LayoutAlignItems.Stretch",
    "=varCrossAxisAlignment"
  ])("does not certify wrapped children with non-start or unknown alignment %s", align => {
    for (const viewport of [390, 768, 1366]) {
      const rect = layout({
        LayoutWrap: "=true", LayoutAlignItems: align
      }, undefined, viewport);
      expect(rect.dynamic, `${align} at ${viewport}`).toBe(true);
      expect([rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)).toBe(true);
    }
  });

  it("verifies wrapped Start alignment and only the known responsive Start branch", () => {
    const responsive = "=If(App.Width < 600, LayoutAlignItems.Center, LayoutAlignItems.Start)";
    for (const [viewport, unknown] of [
      [390, true], [768, false], [1366, false]
    ] as const) {
      expect(layout({
        LayoutWrap: "=true", LayoutAlignItems: responsive
      }, undefined, viewport).dynamic).toBe(unknown);
      expect(layout({
        LayoutWrap: "=true", LayoutAlignItems: "=LayoutAlignItems.Start"
      }, undefined, viewport).dynamic).toBe(false);
    }
    // Unwrapped cross-axis alignment already has a supported position model.
    expect(layout({
      LayoutWrap: "=false", LayoutAlignItems: "=LayoutAlignItems.Center"
    }).dynamic).toBe(false);
  });

});
