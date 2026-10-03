import { describe, expect, it } from "vitest";
import {
  autoLayoutChildren,
  buildSiblingGeometrySymbols,
  controlRect,
  galleryTemplateLayout,
  literalNumber,
  literalText,
  rgba
} from "./layout";
import type { CanvasControl } from "../../types/canvas";

describe("layout literal helpers", () => {
  it("parses numeric formulas", () => {
    expect(literalNumber("=40")).toBe(40);
    expect(literalNumber("=Parent.Width")).toBeNull();
  });

  it("parses constant text expressions", () => {
    expect(literalText('="Hello"')).toBe("Hello");
    expect(literalText('="Hello " & "world"')).toBe("Hello world");
  });

  it("parses RGBA formulas", () => {
    expect(rgba("=RGBA(1, 2, 3, 0.5)")).toBe("rgba(1,2,3,0.5)");
  });

  it("resolves common Parent and Self geometry expressions", () => {
    const control: CanvasControl = {
      id: "1",
      name: "Centered",
      controlType: "Label",
      properties: {
        Width: "=Parent.Width / 2",
        Height: "=40",
        X: "=(Parent.Width - Self.Width) / 2",
        Y: "=20"
      },
      children: [],
      sourceFile: "Src/Home.pa.yaml",
      sourcePath: "Screens/Home/Centered",
      zIndex: 1,
      sourceFormat: "pa-yaml-v3"
    };

    const rect = controlRect(control, 0, {
      parentWidth: 1000,
      parentHeight: 600,
      appWidth: 1000,
      appHeight: 600
    });

    expect(rect.width).toBe(500);
    expect(rect.x).toBe(250);
    expect(rect.dynamic).toBe(false);
  });
  it("lays out horizontal AutoLayout children with FillPortions", () => {
    const parent: CanvasControl = {
      id: "root",
      name: "Root",
      controlType: "GroupContainer",
      variant: "AutoLayout",
      properties: {
        LayoutDirection: "=LayoutDirection.Horizontal",
        LayoutGap: "=10",
        PaddingLeft: "=10",
        PaddingRight: "=10"
      },
      children: [
        {
          id: "a",
          name: "A",
          controlType: "Label",
          properties: {
            FillPortions: "=1",
            Height: "=40"
          },
          children: [],
          sourceFile: "Src/Home.pa.yaml",
          sourcePath: "Screens/Home/Root/A",
          zIndex: 1,
          sourceFormat: "pa-yaml-v3"
        },
        {
          id: "b",
          name: "B",
          controlType: "Label",
          properties: {
            FillPortions: "=1",
            Height: "=40"
          },
          children: [],
          sourceFile: "Src/Home.pa.yaml",
          sourcePath: "Screens/Home/Root/B",
          zIndex: 2,
          sourceFormat: "pa-yaml-v3"
        }
      ],
      sourceFile: "Src/Home.pa.yaml",
      sourcePath: "Screens/Home/Root",
      zIndex: 1,
      sourceFormat: "pa-yaml-v3"
    };

    const items = autoLayoutChildren(parent, {
      parentWidth: 1000,
      parentHeight: 100,
      appWidth: 1000,
      appHeight: 600
    });

    expect(items).toHaveLength(2);
    expect(items[0].rect.x).toBe(10);
    expect(items[0].rect.width).toBe(485);
    expect(items[1].rect.x).toBe(505);
    expect(items[1].rect.width).toBe(485);
  });

  it("resolves responsive AutoLayout direction with known parent width", () => {
    const parent: CanvasControl = {
      id: "root",
      name: "Root",
      controlType: "GroupContainer",
      variant: "AutoLayout",
      properties: {
        LayoutDirection:
          "=If(Parent.Width < 640, LayoutDirection.Vertical, LayoutDirection.Horizontal)",
        LayoutGap: "=8"
      },
      children: [
        {
          id: "a",
          name: "A",
          controlType: "Button",
          properties: { Width: "=100", Height: "=44", FillPortions: "=0" },
          children: [],
          sourceFile: "Src/Home.pa.yaml",
          sourcePath: "Screens/Home/Root/A",
          zIndex: 1,
          sourceFormat: "pa-yaml-v3"
        },
        {
          id: "b",
          name: "B",
          controlType: "Button",
          properties: { Width: "=100", Height: "=44", FillPortions: "=0" },
          children: [],
          sourceFile: "Src/Home.pa.yaml",
          sourcePath: "Screens/Home/Root/B",
          zIndex: 2,
          sourceFormat: "pa-yaml-v3"
        }
      ],
      sourceFile: "Src/Home.pa.yaml",
      sourcePath: "Screens/Home/Root",
      zIndex: 1,
      sourceFormat: "pa-yaml-v3"
    };

    const narrow = autoLayoutChildren(parent, {
      parentWidth: 390,
      parentHeight: 400,
      appWidth: 390,
      appHeight: 844
    });

    expect(narrow[0].rect.y).toBe(0);
    expect(narrow[1].rect.y).toBe(52);
  });

  it("resolves sibling geometry dependencies from current Canvas source", () => {
    const controls: CanvasControl[] = [
      {
        id: "body",
        name: "Body",
        controlType: "GroupContainer",
        variant: "AutoLayout",
        properties: {
          Width: "=Parent.Width",
          Height: "=Parent.Height - Header.Height",
          Y: "=Header.Height"
        },
        children: [],
        sourceFile: "Src/Home.pa.yaml",
        sourcePath: "Screens/Home/Body",
        zIndex: 1,
        sourceFormat: "pa-yaml-v3"
      },
      {
        id: "header",
        name: "Header",
        controlType: "CanvasComponent",
        componentName: "SubScreenHeader",
        properties: {
          Width: "=App.Width",
          Height: "=54",
          X: "=0",
          Y: "=0"
        },
        children: [],
        sourceFile: "Src/Home.pa.yaml",
        sourcePath: "Screens/Home/Header",
        zIndex: 2,
        sourceFormat: "pa-yaml-v3"
      }
    ];

    const context = {
      parentWidth: 1366,
      parentHeight: 768,
      appWidth: 1366,
      appHeight: 768
    };
    const symbols = buildSiblingGeometrySymbols(controls, context);
    const body = controlRect(controls[0], 0, { ...context, symbols });

    expect(symbols["Header.Height"]).toBe(54);
    expect(symbols["Header.Width"]).toBe(1366);
    expect(body.height).toBe(714);
    expect(body.y).toBe(54);
    expect(body.dynamic).toBe(true);
    // X is not serialized in this fixture, so the preview still marks the
    // control as partially unresolved even though Height and Y were solved.
  });
  it("models a vertical gallery template from TemplateSize", () => {
    const gallery: CanvasControl = {
      id: "gallery",
      name: "Gallery1",
      controlType: "Gallery",
      variant: "Vertical",
      properties: {
        TemplateSize: "=73",
        TemplatePadding: "=4"
      },
      children: [],
      sourceFile: "Src/Home.pa.yaml",
      sourcePath: "Screens/Home/Gallery1",
      zIndex: 1,
      sourceFormat: "pa-yaml-v3"
    };

    const template = galleryTemplateLayout(gallery, {
      x: 40,
      y: 100,
      width: 600,
      height: 400,
      dynamic: false
    });

    expect(template).not.toBeNull();
    expect(template?.orientation).toBe("vertical");
    expect(template?.width).toBe(600);
    expect(template?.height).toBe(73);
    expect(template?.padding).toBe(4);
    expect(template?.dynamic).toBe(false);
  });

  it("marks VariableHeight gallery templates as dynamic", () => {
    const gallery: CanvasControl = {
      id: "gallery",
      name: "Gallery1",
      controlType: "Gallery",
      variant: "VariableHeight",
      properties: {
        TemplateSize: "=200"
      },
      children: [],
      sourceFile: "Src/Home.pa.yaml",
      sourcePath: "Screens/Home/Gallery1",
      zIndex: 1,
      sourceFormat: "pa-yaml-v3"
    };

    const template = galleryTemplateLayout(gallery, {
      x: 0,
      y: 0,
      width: 500,
      height: 600,
      dynamic: false
    });

    expect(template?.height).toBe(200);
    expect(template?.variableHeight).toBe(true);
    expect(template?.dynamic).toBe(true);
  });

  it("models a horizontal gallery template along the horizontal axis", () => {
    const gallery: CanvasControl = {
      id: "gallery",
      name: "Gallery1",
      controlType: "Gallery",
      variant: "Horizontal",
      properties: {
        TemplateSize: "=180"
      },
      children: [],
      sourceFile: "Src/Home.pa.yaml",
      sourcePath: "Screens/Home/Gallery1",
      zIndex: 1,
      sourceFormat: "pa-yaml-v3"
    };

    const template = galleryTemplateLayout(gallery, {
      x: 20,
      y: 30,
      width: 700,
      height: 220,
      dynamic: false
    });

    expect(template?.orientation).toBe("horizontal");
    expect(template?.width).toBe(180);
    expect(template?.height).toBe(220);
  });

});
