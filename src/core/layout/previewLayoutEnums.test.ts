import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { autoLayoutChildren, type LayoutContext } from "./layout";
import { previewLayoutEnum } from "./previewLayoutEnums";

function child(name: string, extra: Record<string, unknown> = {}): CanvasControl {
  return {
    id: name, name, controlType: "Classic/Label@2.5.1",
    properties: { Width: "=80", Height: "=30", ...extra },
    children: [], zIndex: 1, sourceFile: "Src/Generic.pa.yaml",
    sourcePath: "Screens/Generic/" + name, sourceFormat: "pa-yaml-v3"
  };
}

function host(properties: Record<string, unknown>): CanvasControl {
  return {
    id: "Host", name: "Host", controlType: "GroupContainer@1.3.0",
    variant: "AutoLayout", layout: "Vertical", properties,
    children: [child("First"), child("Second")],
    zIndex: 1, sourceFile: "Src/Generic.pa.yaml",
    sourcePath: "Screens/Generic/Host", sourceFormat: "pa-yaml-v3"
  };
}

function positions(parent: CanvasControl, viewport = 1366) {
  const context: LayoutContext = {
    parentWidth: 240, parentHeight: 100,
    appWidth: viewport, appHeight: 768
  };
  return autoLayoutChildren(parent, context).map(({ rect }) =>
    [rect.x, rect.y, rect.dynamic]
  );
}

describe("Canvas typed layout enums", () => {
  it("accepts only typed enum tokens, including valid Power Fx comments", () => {
    expect(previewLayoutEnum("=LayoutDirection /* note */ . Horizontal",
      "LayoutDirection")).toBe("horizontal");
    expect(previewLayoutEnum("=LayoutJustifyContent.Start // note",
      "LayoutJustifyContent")).toBe("start");
    expect(previewLayoutEnum("=AlignInContainer.SetByContainer",
      "AlignInContainer")).toBe("setbycontainer");
    expect(previewLayoutEnum('="LayoutDirection.Horizontal"',
      "LayoutDirection")).toBeNull();
    expect(previewLayoutEnum("=LayoutDirection.Horizontal & other",
      "LayoutDirection")).toBeNull();
    expect(previewLayoutEnum("=LayoutDirection.Diagonal",
      "LayoutDirection")).toBeNull();
    expect(previewLayoutEnum("=LayoutDirection.Horizontal /* unclosed",
      "LayoutDirection")).toBeNull();
  });

  it("uses verified responsive If branches without evaluating runtime values", () => {
    const formula = "=If(App.Width < 720, LayoutDirection.Vertical, LayoutDirection.Horizontal)";
    expect(previewLayoutEnum(formula, "LayoutDirection", { "App.Width": 390 }))
      .toBe("vertical");
    expect(previewLayoutEnum(formula, "LayoutDirection", { "App.Width": 1366 }))
      .toBe("horizontal");
    expect(previewLayoutEnum(formula, "LayoutDirection")).toBeNull();
    expect(previewLayoutEnum("=If(varPermission, LayoutDirection.Horizontal, LayoutDirection.Vertical)",
      "LayoutDirection")).toBeNull();
    expect(previewLayoutEnum("=If(true, \"LayoutDirection.Horizontal\", LayoutDirection.Vertical)",
      "LayoutDirection")).toBeNull();
  });

  it("never certifies geometry from text resembling LayoutDirection", () => {
    expect(positions(host({ LayoutDirection: "=LayoutDirection.Horizontal" })))
      .toEqual([[0, 0, false], [80, 0, false]]);
    expect(positions(host({ LayoutDirection: '="LayoutDirection.Horizontal"' })))
      .toEqual([[0, 0, true], [0, 30, true]]);
    expect(positions(host({ LayoutDirection: "=localDirection" })))
      .toEqual([[0, 0, true], [0, 30, true]]);
  });

  it("does not apply text resembling layout justification or alignment", () => {
    expect(positions(host({
      LayoutDirection: "=LayoutDirection.Horizontal",
      LayoutJustifyContent: "=LayoutJustifyContent.End"
    }))).toEqual([[80, 0, false], [160, 0, false]]);
    expect(positions(host({
      LayoutDirection: "=LayoutDirection.Horizontal",
      LayoutJustifyContent: '="LayoutJustifyContent.End"'
    }))).toEqual([[0, 0, true], [80, 0, true]]);

    const aligned = host({ LayoutDirection: "=LayoutDirection.Horizontal" });
    aligned.children[0].properties.AlignInContainer = "=AlignInContainer.End";
    expect(positions(aligned)[0]).toEqual([0, 70, false]);
    aligned.children[0].properties.AlignInContainer = '="AlignInContainer.End"';
    expect(positions(aligned)[0]).toEqual([0, 0, true]);

    const inherited = host({
      LayoutDirection: "=LayoutDirection.Horizontal",
      LayoutAlignItems: '="LayoutAlignItems.Center"'
    });
    expect(positions(inherited)[0]).toEqual([0, 0, true]);
  });

  it("changes axis only for verified viewport branches", () => {
    const parent = host({
      LayoutDirection: "=If(App.Width < 720, LayoutDirection.Vertical, LayoutDirection.Horizontal)",
      LayoutJustifyContent: "=If(App.Width < 720, LayoutJustifyContent.Start, LayoutJustifyContent.End)"
    });
    expect(positions(parent, 390)).toEqual([[0, 0, false], [0, 30, false]]);
    expect(positions(parent, 1366)).toEqual([[80, 0, false], [160, 0, false]]);
  });

  it("does not use a text enum to certify wrapped positions", () => {
    const parent = host({
      LayoutDirection: '="LayoutDirection.Horizontal"',
      LayoutWrap: "=true",
      LayoutJustifyContent: "=LayoutJustifyContent.Start"
    });
    expect(positions(parent).every(([, , dynamic]) => dynamic)).toBe(true);
  });
});
