import { describe, expect, it } from "vitest";
import {
  autoLayoutChildren,
  buildSiblingGeometrySymbols,
  controlRect,
  defaultControlSize,
  galleryTemplateLayout,
  galleryTemplateGuideRect,
  literalNumber,
  literalText,
  rgba
} from "./layout";
import type { CanvasControl } from "../../types/canvas";

describe("Canvas fallback geometry by control family", () => {
  const fixture = (type: string, properties: Record<string, unknown> = {}): CanvasControl => ({
    id: "SyntheticInput", name: "SyntheticInput", controlType: type,
    properties, children: [], sourceFile: "Src/Synthetic.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticInput", sourceFormat: "pa-yaml-v3", zIndex: 1
  });

  it("prefers TextInput over the shorter Text substring in classic and modern controls", () => {
    expect(defaultControlSize("Classic/TextInput@2.3.2")).toEqual({ width: 240, height: 44 });
    expect(defaultControlSize("ModernTextInput@1.0.0")).toEqual({ width: 240, height: 44 });
    expect(defaultControlSize("ModernText@1.0.0")).toEqual({ width: 220, height: 40 });
    expect(defaultControlSize("Classic/HtmlText@1.0.0")).toEqual({ width: 220, height: 40 });
  });

  it("uses the input-family fallback consistently across phone, tablet and desktop", () => {
    for (const [appWidth, appHeight] of [[390, 844], [768, 1024], [1366, 768]]) {
      const rect = controlRect(fixture("Classic/TextInput@2.3.2", {
        X: "=Parent.Width - Self.Width", Y: "=20"
      }), 0, { appWidth, appHeight, parentWidth: appWidth, parentHeight: appHeight });
      expect(rect).toEqual({ x: appWidth - 240, y: 20, width: 240, height: 44, dynamic: false });
    }
  });

  it("does not replace explicitly resolved dimensions with approximate family defaults", () => {
    const rect = controlRect(fixture("ModernTextInput@1.0.0", {
      X: "=Parent.Width - Self.Width", Width: "=120", Height: "=36"
    }), 0, { appWidth: 390, appHeight: 844, parentWidth: 390, parentHeight: 844 });
    expect(rect).toEqual({ x: 270, y: 0, width: 120, height: 36, dynamic: false });
  });
});

describe("Power Fx Switch in responsive Canvas geometry", () => {
  const control: CanvasControl = {
    id: "switch", name: "ResponsiveSwitch", controlType: "Label",
    properties: {
      X: "=Switch(true, App.Width < 600, 12, App.Width < 1024, 24, 48)",
      Y: "=16",
      Width: "=Switch(true, App.Width < 600, 120, App.Width < 1024, 240, 360)",
      Height: "=32"
    },
    children: [], zIndex: 1, sourceFormat: "pa-yaml-v3",
    sourceFile: "Src/SyntheticSwitch.pa.yaml",
    sourcePath: "Screens/Synthetic/ResponsiveSwitch"
  };

  it.each([
    [390, 844, 12, 120],
    [768, 1024, 24, 240],
    [1366, 768, 48, 360]
  ])("resolves verified X/Width at %i px", (appWidth, appHeight, x, width) => {
    const rect = controlRect(control, 0, {
      parentWidth: appWidth, parentHeight: appHeight, appWidth, appHeight
    });
    expect(rect).toEqual({ x, y: 16, width, height: 32, dynamic: false });
  });

  it("preserves unknown geometry when Switch reads SQL-dependent values", () => {
    const unknown: CanvasControl = {
      ...control,
      properties: { ...control.properties, Width: "=Switch(varSqlRole, 1, 120, 240)" }
    };
    const rect = controlRect(unknown, 0, {
      parentWidth: 768, parentHeight: 1024, appWidth: 768, appHeight: 1024
    });
    expect(rect.dynamic).toBe(true);
  });
});

describe("verified Power Fx math in responsive Canvas geometry", () => {
  it.each([[390, 844], [768, 1024], [1366, 768]])(
    "positions a centered control using Power/Sqrt at %i px",
    (appWidth, appHeight) => {
      const control: CanvasControl = {
        id: "math", name: "MathCentered", controlType: "Label",
        properties: {
          X: "=(Parent.Width - Self.Width) / 2",
          Y: "=16", Width: "=Sqrt(Power(App.Width, 2)) / 2",
          Height: "=32"
        },
        children: [], zIndex: 1, sourceFormat: "pa-yaml-v3",
        sourceFile: "Src/SyntheticMath.pa.yaml",
        sourcePath: "Screens/Synthetic/MathCentered"
      };
      const rect = controlRect(control, 0, {
        parentWidth: appWidth, parentHeight: appHeight,
        appWidth, appHeight
      });
      expect(rect.width).toBeCloseTo(appWidth / 2);
      expect(rect.x).toBeCloseTo(appWidth / 4);
      expect(rect.y).toBe(16);
      expect(rect.dynamic).toBe(false);
    }
  );

  it("does not certify geometry when math depends on unknown SQL state", () => {
    const control: CanvasControl = {
      id: "math-unknown", name: "MathUnknown", controlType: "Label",
      properties: {
        X: "=0", Y: "=0", Width: "=Sqrt(Power(varSqlWidth, 2))",
        Height: "=32"
      },
      children: [], zIndex: 1, sourceFormat: "pa-yaml-v3",
      sourceFile: "Src/SyntheticMath.pa.yaml",
      sourcePath: "Screens/Synthetic/MathUnknown"
    };
    const rect = controlRect(control, 0, {
      parentWidth: 768, parentHeight: 1024,
      appWidth: 768, appHeight: 1024
    });
    expect(rect.dynamic).toBe(true);
  });
});

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

  it("resolves documented percentage alpha without browser coercion", () => {
    expect(rgba("=RGBA(255, 128, 0, 50%)")).toBe("rgba(255,128,0,0.5)");
    expect(rgba("=RGBA(0, 0, 0, 0%)")).toBe("rgba(0,0,0,0)");
    expect(rgba("=RGBA(255, 255, 255, 100%)")).toBe("rgba(255,255,255,1)");
    expect(rgba("=RGBA(10.5, 20, 30, .25)")).toBe("rgba(10.5,20,30,0.25)");
  });

  it("rejects out-of-range RGBA channels and alpha instead of CSS clamping", () => {
    for (const source of [
      "=RGBA(256, 0, 0, 1)", "=RGBA(0, 999, 0, 1)",
      "=RGBA(0, 0, 256, 1)", "=RGBA(0, 0, 0, 1.1)",
      "=RGBA(0, 0, 0, 101%)", "=RGBA(0, 0, 0, 1000%)",
      "=RGBA(-1, 0, 0, 1)", "=RGBA(0, 0, 0, -0.1)",
      "=RGBA(0, 0, 0, 1/2)", "=RGBA(0, 0, 0, varAlpha)",
      "=Connector.RGBA(1, 2, 3, 1)"
    ]) {
      expect(rgba(source)).toBeNull();
    }
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
    expect(body.x).toBe(0);
    expect(body.dynamic).toBe(false);
    // Omitted X uses the Canvas default instead of a fabricated offset.
  });
  it("uses Canvas zero defaults instead of fabricated positions", () => {
    const makeControl = (id: string, properties: Record<string, unknown>): CanvasControl => ({
      id, name: id, controlType: "Label", properties, children: [],
      sourceFile: "Src/Home.pa.yaml", sourcePath: "Screens/Home/" + id,
      sourceFormat: "pa-yaml-v3", zIndex: 1
    });
    const context = { parentWidth: 600, parentHeight: 400, appWidth: 600, appHeight: 400 };
    const omitted = controlRect(makeControl("Omitted", {
      Width: "=120", Height: "=25"
    }), 7, context);
    expect(omitted.x).toBe(0);
    expect(omitted.y).toBe(0);
    expect(omitted.dynamic).toBe(false);

    const explicit = controlRect(makeControl("Explicit", {
      X: "=Parent.Width-150", Y: "=12", Width: "=100", Height: "=25"
    }), 3, context);
    expect(explicit.x).toBe(450);
    expect(explicit.y).toBe(12);
    expect(explicit.dynamic).toBe(false);

    const unresolved = controlRect(makeControl("Dynamic", {
      X: "=varMissing", Y: "=25", Width: "=90", Height: "=20"
    }), 2, context);
    expect(unresolved.x).toBe(404);
    expect(unresolved.y).toBe(25);
    expect(unresolved.dynamic).toBe(true);
  });

  it("makes omitted sibling X/Y defaults available to geometry expressions", () => {
    const makeControl = (name: string, properties: Record<string, unknown>): CanvasControl => ({
      id: name, name, controlType: "Label", properties, children: [],
      sourceFile: "Src/Home.pa.yaml", sourcePath: "Screens/Home/" + name,
      sourceFormat: "pa-yaml-v3", zIndex: 1
    });
    const controls = [
      makeControl("Origin", { Width: "=100", Height: "=20" }),
      makeControl("Dependent", { X: "=Origin.X + 15", Y: "=Origin.Y + 40", Width: "=100", Height: "=20" })
    ];
    const context = { parentWidth: 500, parentHeight: 400, appWidth: 500, appHeight: 400 };
    const symbols = buildSiblingGeometrySymbols(controls, context);
    expect(symbols["Origin.X"]).toBe(0);
    expect(symbols["Origin.Y"]).toBe(0);
    const rect = controlRect(controls[1], 1, { ...context, symbols });
    expect(rect.x).toBe(15);
    expect(rect.y).toBe(40);
    expect(rect.dynamic).toBe(false);
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

  it("resolves gallery height using a known Self.Y and unknown unused variables", () => {
    const gallery: CanvasControl = {
      id: "gallery", name: "Catalog", controlType: "Gallery", variant: "Vertical",
      properties: {
        Width: "=App.Width - 48",
        Height: "=Max(180, App.Height - Self.Y - 20)",
        X: "=24",
        Y: "=200 + If(App.Width < 720 && varIsAdmin, 48, 0)"
      },
      children: [], sourceFile: "Src/Demo.pa.yaml", sourcePath: "Catalog",
      zIndex: 1, sourceFormat: "pa-yaml-v3"
    };
    const rect = controlRect(gallery, 0, {
      parentWidth: 1366, parentHeight: 768, appWidth: 1366, appHeight: 768
    });
    expect(rect.x).toBe(24);
    expect(rect.y).toBe(200);
    expect(rect.height).toBe(548);
    expect(rect.dynamic).toBe(false);
  });

  it("resolves dependent sibling Y, Self.Y Height and zero-height layout hosts", () => {
    const child = (name: string, properties: Record<string, unknown>): CanvasControl => ({
      id: name, name, controlType: "GroupContainer",
      properties, children: [], zIndex: 1, sourceFormat: "pa-yaml-v3",
      sourceFile: "Src/Fixture.pa.yaml", sourcePath: "Screens/Fixture/" + name
    });
    const header = child("Header", {
      X: "=24", Y: "=80", Width: "=App.Width - 48", Height: "=140"
    });
    const toolbar = child("Toolbar", {
      X: "=Header.X", Y: "=Header.Y + Header.Height + 16",
      Width: "=Header.Width", Height: "=0// responsive toolbar omitted in design",
      Visible: "=false//hidden by source"
    });
    const gallery = child("Catalogue", {
      X: "=Header.X",
      Y: "=Toolbar.Y + Toolbar.Height + 16 + If(App.Width < 720 && varAdmin, 48, 0)",
      Width: "=Header.Width",
      Height: "=Max(180, App.Height - Self.Y - 20)",
      WrapCount: "=If(App.Width < 720, 1, If(App.Width < 1180, 2, 3))",
      TemplateSize: "=292",
      TemplatePadding: "=8"
    });
    gallery.controlType = "Gallery";
    gallery.variant = "Vertical";
    // Intentionally order the gallery before the toolbar to check fixed
    // point resolution rather than accidental ordering of serialized nodes.
    const items = [gallery, toolbar, header];
    const context = {
      appWidth: 1366, appHeight: 768, parentWidth: 1366, parentHeight: 768
    };
    const symbols = buildSiblingGeometrySymbols(items, context);
    expect(symbols["Header.Y"]).toBe(80);
    expect(symbols["Toolbar.Y"]).toBe(236);
    expect(symbols["Toolbar.Height"]).toBe(0);
    expect(symbols["Catalogue.Y"]).toBe(252);
    expect(symbols["Catalogue.Height"]).toBe(496);
    const rect = controlRect(gallery, 0, { ...context, symbols });
    expect(rect).toMatchObject({ x: 24, y: 252, width: 1318, height: 496, dynamic: false });
    const template = galleryTemplateLayout(gallery, rect, { ...context, symbols });
    expect(template?.wrapCount).toBe(3);
    expect(template?.width).toBeCloseTo(1318 / 3);
    expect(template?.height).toBe(292);
    expect(template?.padding).toBe(8);
  });

  it("evaluates viewport-dependent gallery template sizes against App dimensions", () => {
    const gallery: CanvasControl = {
      id: "gallery", name: "ResponsiveGallery", controlType: "Gallery",
      variant: "Vertical",
      properties: {
        TemplateSize: "=If(App.Width < 720, 140, 292)",
        TemplatePadding: "=If(App.Width < 720, 4, 8)",
        WrapCount: "=If(App.Width < 720, 1, 3)"
      },
      children: [], sourceFile: "Src/Fixture.pa.yaml",
      sourcePath: "Screens/Fixture/ResponsiveGallery",
      sourceFormat: "pa-yaml-v3", zIndex: 1
    };
    const rect = { x: 0, y: 0, width: 900, height: 500, dynamic: false };
    const narrow = galleryTemplateLayout(gallery, rect, {
      appWidth: 390, appHeight: 844, parentWidth: 900, parentHeight: 500
    });
    const desktop = galleryTemplateLayout(gallery, rect, {
      appWidth: 1366, appHeight: 768, parentWidth: 900, parentHeight: 500
    });
    expect(narrow).toMatchObject({ wrapCount: 1, width: 900, height: 140, padding: 4 });
    expect(desktop).toMatchObject({ wrapCount: 3, width: 300, height: 292, padding: 8 });
  });

  it("resolves responsive Gallery.WrapCount from app viewport without inventing records", () => {
    const gallery: CanvasControl = {
      id: "g", name: "Catalog", controlType: "Gallery", variant: "Vertical",
      properties: {
        TemplateSize: "=292",
        TemplatePadding: "=8",
        WrapCount: "=If(App.Width < 720, 1, If(App.Width < 1180, 2, 3))"
      },
      children: [], sourceFile: "Src/Screen.pa.yaml", sourcePath: "Catalog",
      zIndex: 1, sourceFormat: "pa-yaml-v3"
    };
    const rect = { x: 24, y: 236, width: 1200, height: 600, dynamic: false };
    const at = (appWidth: number) => galleryTemplateLayout(gallery, rect, {
      appWidth, appHeight: 768, parentWidth: 1200, parentHeight: 600
    });
    expect(at(1366)?.wrapCount).toBe(3);
    expect(at(1366)?.width).toBe(400);
    expect(at(1366)?.height).toBe(292);
    expect(at(900)?.wrapCount).toBe(2);
    expect(at(900)?.width).toBe(600);
    expect(at(390)?.wrapCount).toBe(1);
    expect(at(390)?.width).toBe(1200);
  });

  it("keeps unknown Gallery.WrapCount explicitly dynamic", () => {
    const gallery: CanvasControl = {
      id: "g", name: "Catalog", controlType: "Gallery", variant: "Vertical",
      properties: { WrapCount: "=varColumns", TemplateSize: "=80" },
      children: [], sourceFile: "Src/Demo.pa.yaml", sourcePath: "Catalog",
      zIndex: 1, sourceFormat: "pa-yaml-v3"
    };
    const resolved = galleryTemplateLayout(gallery,
      { x: 0, y: 0, width: 1000, height: 500, dynamic: false },
      { appWidth: 1200, appHeight: 800, parentWidth: 1000, parentHeight: 500 });
    expect(resolved?.wrapCount).toBe(1);
    expect(resolved?.dynamic).toBe(true);
  });


  it("uses the documented one-pixel Gallery.TemplateSize minimum", () => {
    const makeGallery = (size: string): CanvasControl => ({
      id: "g", name: "Gallery", controlType: "Gallery", variant: "Vertical",
      properties: { TemplateSize: size, WrapCount: "=2", TemplatePadding: "=0" },
      children: [], sourceFile: "Src/Synthetic.pa.yaml",
      sourcePath: "Screens/Synthetic/Gallery", zIndex: 1, sourceFormat: "pa-yaml-v3"
    });
    const rect = { x: 0, y: 0, width: 300, height: 200, dynamic: false };
    expect(galleryTemplateLayout(makeGallery("=0"), rect)?.height).toBe(1);
    expect(galleryTemplateLayout(makeGallery("=-10"), rect)?.height).toBe(1);
    expect(galleryTemplateLayout(makeGallery("=1"), rect)?.height).toBe(1);
  });

  it("marks unresolved TemplatePadding as dynamic rather than verified zero", () => {
    const gallery: CanvasControl = {
      id: "g", name: "Gallery", controlType: "Gallery", variant: "Vertical",
      properties: {
        TemplateSize: "=292", WrapCount: "=2", TemplatePadding: "=varRuntimePadding"
      },
      children: [], sourceFile: "Src/Synthetic.pa.yaml",
      sourcePath: "Screens/Synthetic/Gallery", zIndex: 1, sourceFormat: "pa-yaml-v3"
    };
    const template = galleryTemplateLayout(gallery,
      { x: 0, y: 0, width: 600, height: 400, dynamic: false },
      { parentWidth: 600, parentHeight: 400, appWidth: 900, appHeight: 768 });
    expect(template).toMatchObject({ wrapCount: 2, height: 292, padding: 0, dynamic: true });
  });

  it("resolves TemplatePadding for known viewport branches without marking dynamic", () => {
    const gallery: CanvasControl = {
      id: "g", name: "Gallery", controlType: "Gallery", variant: "Vertical",
      properties: {
        TemplateSize: "=292",
        WrapCount: "=If(App.Width < 720, 1, 3)",
        TemplatePadding: "=If(App.Width < 720, 4, 8)"
      },
      children: [], sourceFile: "Src/Synthetic.pa.yaml",
      sourcePath: "Screens/Synthetic/Gallery", zIndex: 1, sourceFormat: "pa-yaml-v3"
    };
    const rect = { x: 0, y: 0, width: 600, height: 400, dynamic: false };
    const at = (appWidth: number) => galleryTemplateLayout(gallery, rect, {
      parentWidth: 600, parentHeight: 400, appWidth, appHeight: 768
    });
    expect(at(390)).toMatchObject({ wrapCount: 1, padding: 4, dynamic: false });
    expect(at(1366)).toMatchObject({ wrapCount: 3, padding: 8, dynamic: false });
  });

  it("propagates unresolved host geometry to the gallery template", () => {
    const gallery: CanvasControl = {
      id: "g", name: "Gallery", controlType: "Gallery", variant: "Vertical",
      properties: { TemplateSize: "=292", TemplatePadding: "=8", WrapCount: "=3" },
      children: [], sourceFile: "Src/Synthetic.pa.yaml",
      sourcePath: "Screens/Synthetic/Gallery", zIndex: 1, sourceFormat: "pa-yaml-v3"
    };
    const template = galleryTemplateLayout(gallery, {
      x: 0, y: 0, width: 600, height: 400, dynamic: true
    });
    expect(template).toMatchObject({ width: 200, height: 292, padding: 8, dynamic: true });
  });


});


describe("source-only gallery guide geometry", () => {
  const gallery = (variant: string, properties: Record<string, unknown>): CanvasControl => ({
    id: "fixture", name: "Fixture", controlType: "Gallery", variant,
    properties, children: [], sourceFile: "Src/Fixture.pa.yaml",
    sourcePath: "Screens/Fixture/Gallery", sourceFormat: "pa-yaml-v3", zIndex: 1
  });

  it("places responsive vertical WrapCount slots in columns", () => {
    const control = gallery("Vertical", {
      WrapCount: "=If(App.Width < 720, 1, If(App.Width < 1180, 2, 3))",
      TemplateSize: "=292", TemplatePadding: "=8"
    });
    for (const [appWidth, expectedColumns] of [[390, 1], [900, 2], [1366, 3]]) {
      const template = galleryTemplateLayout(control,
        { x: 0, y: 0, width: 600, height: 320, dynamic: false },
        { appWidth, appHeight: 768, parentWidth: 600, parentHeight: 320 });
      expect(template?.wrapCount).toBe(expectedColumns);
      const guide = galleryTemplateGuideRect(template!, 1, 20, 30);
      expect(guide.x).toBeCloseTo(20 + 600 / expectedColumns + 8);
      expect(guide.y).toBe(38);
      expect(guide.width).toBeCloseTo(600 / expectedColumns - 16);
      expect(guide.height).toBe(276);
    }
  });

  it("places horizontal WrapCount slots in rows rather than columns", () => {
    const template = galleryTemplateLayout(gallery("Horizontal", {
      WrapCount: "=3", TemplateSize: "=292", TemplatePadding: "=8"
    }), { x: 0, y: 0, width: 620, height: 300, dynamic: false });
    expect(template?.orientation).toBe("horizontal");
    expect(galleryTemplateGuideRect(template!, 1, 20, 30))
      .toEqual({ x: 28, y: 138, width: 276, height: 84 });
    expect(galleryTemplateGuideRect(template!, 2, 20, 30))
      .toEqual({ x: 28, y: 238, width: 276, height: 84 });
  });

  it("does not generate negative guide dimensions for excessive padding", () => {
    const template = galleryTemplateLayout(gallery("Vertical", {
      WrapCount: "=2", TemplateSize: "=24", TemplatePadding: "=50"
    }), { x: 0, y: 0, width: 100, height: 80, dynamic: false });
    expect(galleryTemplateGuideRect(template!, 1, 0, 0))
      .toEqual({ x: 100, y: 50, width: 0, height: 0 });
  });
});

describe("Canvas zero-size dimensions and responsive viewports", () => {
  const control: CanvasControl = {
    id: "ZeroSized", name: "ZeroSized", controlType: "Classic/Label@2.5.1",
    properties: {
      Width: "=If(App.Width < 720, 0, 180)", Height: "=0",
      X: "=Parent.Width - Self.Width", Y: "=20"
    },
    children: [], sourceFile: "Src/SyntheticZero.pa.yaml",
    sourcePath: "Screens/SyntheticZero/ZeroSized",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };

  it("preserves a known zero width and height without marking the layout unknown", () => {
    const phone = controlRect(control, 0, {
      appWidth: 390, appHeight: 844, parentWidth: 390, parentHeight: 844
    });
    expect(phone).toEqual({ x: 390, y: 20, width: 0, height: 0, dynamic: false });

    const desktop = controlRect(control, 0, {
      appWidth: 1366, appHeight: 768, parentWidth: 1366, parentHeight: 768
    });
    expect(desktop).toEqual({ x: 1186, y: 20, width: 180, height: 0, dynamic: false });
  });

  it("does not mistake unresolved dimensions for known zero", () => {
    const unresolved = { ...control, properties: { ...control.properties, Width: "=varRuntimeWidth" } };
    const rect = controlRect(unresolved, 0, {
      appWidth: 390, appHeight: 844, parentWidth: 390, parentHeight: 844
    });
    expect(rect.width).toBe(220);
    expect(rect.dynamic).toBe(true);
  });
});
