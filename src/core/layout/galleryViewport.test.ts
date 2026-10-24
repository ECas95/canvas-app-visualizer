import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { galleryTemplateGuideRect, galleryTemplateLayout } from "./layout";
import { galleryRecordsUnknown } from "./previewDataState";

// Synthetic source fixture: no real app YAML, data records, identity or permissions.
const gallery: CanvasControl = {
  id: "synthetic-gallery",
  name: "ResponsiveCatalog",
  controlType: "Classic/Gallery@2.15.0",
  variant: "Vertical",
  properties: {
    Items: "=CatalogSource",
    WrapCount: "=If(App.Width < 600, 1, App.Width < 1000, 2, 3)",
    TemplateSize: "=240",
    TemplatePadding: "=10"
  },
  children: [],
  sourceFile: "Src/Synthetic.pa.yaml",
  sourcePath: "Screens/Synthetic/ResponsiveCatalog",
  sourceFormat: "pa-yaml-v3",
  zIndex: 1
};

describe("synthetic Canvas gallery viewport geometry", () => {
  it.each([
    { viewport: 390, height: 844, columns: 1, cellWidth: 350 },
    { viewport: 768, height: 1024, columns: 2, cellWidth: 364 },
    { viewport: 1366, height: 768, columns: 3, cellWidth: 442 }
  ])("resolves template columns at $viewport px without fabricating records", ({
    viewport, height, columns, cellWidth
  }) => {
    const template = galleryTemplateLayout(gallery,
      { x: 0, y: 0, width: viewport - 40, height: 600, dynamic: false },
      { parentWidth: viewport - 40, parentHeight: 600, appWidth: viewport, appHeight: height });
    expect(template).not.toBeNull();
    expect(template).toMatchObject({
      wrapCount: columns, width: cellWidth, height: 240,
      padding: 10, orientation: "vertical", dynamic: false
    });
    const first = galleryTemplateGuideRect(template!, 0, 20, 30);
    const last = galleryTemplateGuideRect(template!, columns - 1, 20, 30);
    expect(first).toEqual({ x: 30, y: 40, width: cellWidth - 20, height: 220 });
    expect(last.x).toBe(30 + (columns - 1) * cellWidth);
    expect(last.x + last.width).toBeLessThanOrEqual(viewport - 10);
    // Template geometry does not prove that even one runtime item was loaded.
    expect(galleryRecordsUnknown(gallery)).toBe(true);
  });

  it.each([
    { variant: "Vertical", width: 320, height: 120,
      expectedWidth: 320, expectedHeight: 292, guideWidth: 304, guideHeight: 276 },
    { variant: "Horizontal", width: 120, height: 320,
      expectedWidth: 292, expectedHeight: 320, guideWidth: 276, guideHeight: 304 }
  ])("keeps $variant TemplateSize when the gallery viewport is smaller", ({
    variant, width, height, expectedWidth, expectedHeight, guideWidth, guideHeight
  }) => {
    const source: CanvasControl = {
      ...gallery,
      variant,
      properties: {
        ...gallery.properties, WrapCount: "=1", TemplateSize: "=292",
        TemplatePadding: "=8"
      }
    };
    const template = galleryTemplateLayout(source,
      { x: 0, y: 0, width, height, dynamic: false },
      { parentWidth: width, parentHeight: height, appWidth: 390, appHeight: 844 });
    expect(template).toMatchObject({
      width: expectedWidth, height: expectedHeight, padding: 8, dynamic: false
    });
    // Guide geometry may extend beyond the viewport. SVG clips it to the
    // gallery bounds; never shrink the underlying Canvas template.
    expect(galleryTemplateGuideRect(template!, 0, 10, 20)).toEqual({
      x: 18, y: 28, width: guideWidth, height: guideHeight
    });
    // This is template geometry only, not proof of any loaded record.
    expect(galleryRecordsUnknown(source)).toBe(true);
  });

  it("marks runtime-dependent WrapCount as unknown at every viewport", () => {
    const unresolved = {
      ...gallery,
      properties: { ...gallery.properties, WrapCount: "=If(varAuthorized, 3, 1)" }
    };
    for (const viewport of [390, 768, 1366]) {
      const template = galleryTemplateLayout(unresolved,
        { x: 0, y: 0, width: viewport - 40, height: 600, dynamic: false },
        { parentWidth: viewport - 40, parentHeight: 600, appWidth: viewport, appHeight: 768 });
      expect(template?.dynamic).toBe(true);
      expect(galleryRecordsUnknown(unresolved)).toBe(true);
    }
  });
});
