import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { controlRect, galleryTemplateLayout } from "./layout";
import { galleryRecordsUnknown } from "./previewDataState";

// Public synthetic Canvas source only. No records, permissions, identities or SQL calls.
const gallery = (properties: Record<string, unknown>, variant = "Vertical"): CanvasControl => ({
  id: "synthetic-gallery", name: "Catalog",
  controlType: "Classic/Gallery@2.15.0", variant,
  properties: { Items: "=SqlProducts", ...properties },
  children: [], zIndex: 1, sourceFormat: "pa-yaml-v3",
  sourceFile: "Src/Synthetic.pa.yaml", sourcePath: "Screens/Synthetic/Catalog"
});
const ctx = (width: number) => ({
  parentWidth: width, parentHeight: 768, appWidth: width, appHeight: 768
});

describe("gallery Self dimensions independent of unknown placement", () => {
  it.each([
    [390, 1, 8], [768, 2, 12], [1366, 3, 16]
  ])("uses verified Width/Height despite an unknown X at %i px", (viewport, columns, padding) => {
    const source = gallery({
      X: "=varRuntimeX", Y: "=20",
      Width: "=App.Width - 40", Height: "=600",
      WrapCount: "=If(Self.Width < 600, 1, Self.Width < 1000, 2, 3)",
      TemplateSize: "=Self.Height / 4",
      TemplatePadding: "=If(Self.Width < 600, 8, Self.Width < 1000, 12, 16)"
    });
    const rect = controlRect(source, 0, ctx(viewport));
    expect(rect.dynamic).toBe(true);
    const template = galleryTemplateLayout(source, rect, ctx(viewport));
    expect(template).toMatchObject({
      wrapCount: columns, padding, width: (viewport - 40) / columns,
      height: 150, dynamic: true
    });
    expect(galleryRecordsUnknown(source)).toBe(true);
  });

  it.each([390, 768, 1366])(
    "never treats a runtime Width fallback as Self.Width at %i px", viewport => {
      const source = gallery({
        X: "=varRuntimeX", Width: "=If(varSqlAccess, 480, 900)",
        Height: "=600",
        WrapCount: "=If(Self.Width < 600, 2, 3)",
        TemplateSize: "=Self.Height / 4",
        TemplatePadding: "=Self.Width / 100"
      });
      const rect = controlRect(source, 0, ctx(viewport));
      const template = galleryTemplateLayout(source, rect, ctx(viewport));
      expect(template).toMatchObject({
        wrapCount: 1, padding: 0, height: 150, dynamic: true
      });
      expect(galleryRecordsUnknown(source)).toBe(true);
    }
  );

  it("does not certify Self dimensions from a mismatched or container-managed rect", () => {
    const base = {
      X: "=varRuntimeX", Width: "=400", Height: "=600",
      WrapCount: "=If(Self.Width = 400, 2, 1)",
      TemplateSize: "=Self.Height / 4"
    };
    const mismatched = gallery(base);
    expect(galleryTemplateLayout(mismatched,
      { x: 24, y: 0, width: 420, height: 300, dynamic: true }, ctx(768)))
      .toMatchObject({ wrapCount: 1, height: 72, dynamic: true });

    const managed = gallery({ ...base, FillPortions: "=1" });
    expect(galleryTemplateLayout(managed,
      { x: 24, y: 0, width: 400, height: 600, dynamic: true }, ctx(768)))
      .toMatchObject({ wrapCount: 1, height: 72, dynamic: true });
  });

  it("resolves horizontal Self.Height slots without asserting runtime items", () => {
    const source = gallery({
      X: "=varRuntimeX", Width: "=App.Width - 40", Height: "=600",
      WrapCount: "=If(Self.Height >= 600, 3, 1)",
      TemplateSize: "=Self.Width / 4"
    }, "Horizontal");
    const rect = controlRect(source, 0, ctx(768));
    const template = galleryTemplateLayout(source, rect, ctx(768));
    expect(template).toMatchObject({
      wrapCount: 3, width: 182, height: 200,
      orientation: "horizontal", dynamic: true
    });
    expect(galleryRecordsUnknown(source)).toBe(true);
  });
});
