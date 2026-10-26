import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../../types/canvas";
import { buildCanvasModel } from "../model/normalize";
import { CanvasPreview } from "../../components/CanvasPreview";
import { autoLayoutChildren, buildSiblingGeometrySymbols, controlRect } from "./layout";

function control(name: string, type: string, properties: Record<string, unknown>): CanvasControl {
  return {
    id: name, name, controlType: type, properties, children: [],
    sourceFile: "Src/SyntheticAutoHeight.pa.yaml",
    sourcePath: "Screens/Synthetic/" + name,
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
}

function context(appWidth: number) {
  return {
    appWidth, appHeight: 844, parentWidth: appWidth, parentHeight: 600
  };
}

describe("Canvas AutoHeight source-only geometry", () => {
  it("does not certify a classic label's output Height from serialized Height", () => {
    const label = control("Title", "Classic/Label@2.5.1", {
      Width: "=220", Height: "=24", AutoHeight: "=true", Text: '="Synthetic text"'
    });
    expect(controlRect(label, 0, context(390))).toMatchObject({
      width: 220, height: 24, dynamic: true
    });
  });

  it("preserves verified geometry when AutoHeight is explicitly false or omitted", () => {
    for (const autoHeight of ["=false", undefined]) {
      const label = control("Title", "Classic/Label@2.5.1", {
        Width: "=220", Height: "=24",
        ...(autoHeight ? { AutoHeight: autoHeight } : {})
      });
      expect(controlRect(label, 0, context(390)).dynamic).toBe(false);
    }
  });

  it.each([390, 768, 1366])(
    "resolves viewport-only AutoHeight conservatively at %i px", appWidth => {
      const label = control("Title", "Classic/Label@2.5.1", {
        Width: "=200", Height: "=24",
        AutoHeight: "=If(App.Width < 720, true, false)"
      });
      expect(controlRect(label, 0, context(appWidth)).dynamic)
        .toBe(appWidth < 720);
    }
  );

  it("keeps runtime-dependent AutoHeight unknown, never assumes false", () => {
    const label = control("Title", "Classic/Label@2.5.1", {
      Height: "=24", AutoHeight: "=varCanExpand"
    });
    expect(controlRect(label, 0, context(390)).dynamic).toBe(true);
  });

  it("recognizes ModernText and HTML text without applying AutoHeight to inputs", () => {
    for (const type of ["ModernText@1.0.0", "Classic/HtmlText@1.0.0"]) {
      expect(controlRect(control("Title", type, {
        Height: "=24", AutoHeight: "=true"
      }), 0, context(390)).dynamic).toBe(true);
    }
    for (const type of ["ModernTextInput@1.0.0", "Classic/TextInput@2.3.2",
      "Classic/Button@2.2.0"]) {
      expect(controlRect(control("Other", type, {
        Height: "=24", AutoHeight: "=true"
      }), 0, context(390)).dynamic).toBe(false);
    }
  });

  it("does not use an auto-growing label's source Height to position siblings", () => {
    const title = control("Title", "Classic/Label@2.5.1", {
      Width: "=220", Height: "=24", AutoHeight: "=true"
    });
    const next = control("Next", "Classic/Label@2.5.1", {
      X: "=12", Y: "=Title.Height + 8", Width: "=200", Height: "=20"
    });
    const symbols = buildSiblingGeometrySymbols([title, next], context(390));
    expect(symbols["Title.Height"]).toBeUndefined();
    expect(symbols["Next.Y"]).toBeUndefined();
    expect(controlRect(next, 1, { ...context(390), symbols }).dynamic).toBe(true);
  });

  it("resolves dependent sibling Height references when AutoHeight is provably false", () => {
    const title = control("Title", "Classic/Label@2.5.1", {
      Width: "=220", Height: "=24",
      AutoHeight: "=If(App.Width < 720, true, false)"
    });
    const next = control("Next", "Classic/Label@2.5.1", {
      X: "=12", Y: "=Title.Height + 8", Width: "=200", Height: "=20"
    });
    const narrow = buildSiblingGeometrySymbols([title, next], context(390));
    const wide = buildSiblingGeometrySymbols([title, next], context(1366));
    expect(narrow["Title.Height"]).toBeUndefined();
    expect(wide["Title.Height"]).toBe(24);
    expect(wide["Next.Y"]).toBe(32);
    expect(controlRect(next, 1, { ...context(1366), symbols: wide }).dynamic)
      .toBe(false);
  });

  it("does not resolve Self.Height for an auto-growing label's own position", () => {
    const label = control("Title", "Classic/Label@2.5.1", {
      Width: "=220", Height: "=24", AutoHeight: "=true",
      Y: "=Parent.Height - Self.Height"
    });
    expect(controlRect(label, 0, context(390)).dynamic).toBe(true);
    const symbols = buildSiblingGeometrySymbols([label], context(390));
    expect(symbols["Title.Y"]).toBeUndefined();
  });

  it("marks all siblings in vertical AutoLayout approximate when text auto-grows", () => {
    const first = control("Title", "Classic/Label@2.5.1", {
      Width: "=200", Height: "=24", AutoHeight: "=true"
    });
    const second = control("Next", "Classic/Label@2.5.1", {
      Width: "=200", Height: "=24"
    });
    const host = control("Stack", "GroupContainer@1.3.0", {
      LayoutDirection: "=LayoutDirection.Vertical", LayoutGap: "=8",
      LayoutWrap: "=false"
    });
    host.variant = "AutoLayout";
    host.children = [first, second];
    expect(autoLayoutChildren(host, context(390)).every(item => item.rect.dynamic))
      .toBe(true);
    first.properties.AutoHeight = "=false";
    expect(autoLayoutChildren(host, context(390)).every(item => !item.rect.dynamic))
      .toBe(true);
  });

  it("keeps horizontal AutoHeight layout approximate until text height is measured", () => {
    const first = control("Title", "Classic/Label@2.5.1", {
      Width: "=200", Height: "=24", AutoHeight: "=true"
    });
    const second = control("Next", "Classic/Label@2.5.1", {
      Width: "=200", Height: "=24"
    });
    const host = control("Row", "GroupContainer@1.3.0", {
      LayoutDirection: "=LayoutDirection.Horizontal",
      LayoutWrap: "=false"
    });
    host.variant = "AutoLayout";
    host.children = [first, second];
    expect(autoLayoutChildren(host, context(1366)).every(item => item.rect.dynamic))
      .toBe(true);
    first.properties.AutoHeight = "=false";
    expect(autoLayoutChildren(host, context(1366)).every(item => !item.rect.dynamic))
      .toBe(true);
  });

  it("imports only a synthetic .pa.yaml and shows unverified layout in preview", () => {
    const yaml = `Screens:
  Synthetic:
    Properties:
      Fill: =Color.White
    Children:
      - AutoLabel:
          Control: Classic/Label@2.5.1
          Properties:
            X: =12
            Y: =16
            Width: =240
            Height: =24
            AutoHeight: =true
            Text: ="Synthetic example"
      - Dependent:
          Control: Classic/Label@2.5.1
          Properties:
            X: =12
            Y: =AutoLabel.Height + 8
            Width: =240
            Height: =24
            Text: ="Another synthetic label"
`;
    const model = buildCanvasModel([{
      path: "Src/SyntheticAutoHeight.pa.yaml",
      name: "SyntheticAutoHeight.pa.yaml",
      content: yaml, origin: "yaml", format: "pa-yaml-v3"
    }], "yaml");
    expect(model.screens).toHaveLength(1);
    const screen = model.screens[0];
    const symbols = buildSiblingGeometrySymbols(screen.children, context(1366));
    expect(symbols["AutoLabel.Height"]).toBeUndefined();
    const html = renderToStaticMarkup(
      <CanvasPreview screen={screen} onSelect={() => {}} />
    );
    expect(html).toContain("Inspect AutoLabel");
    expect(html).toContain("Inspect Dependent");
    expect(html).toContain("2 unresolved layouts");
    expect(html).not.toContain("SQL");
  });
});
