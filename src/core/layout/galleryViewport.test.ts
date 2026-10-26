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


describe("gallery WrapCount source fidelity and bounded guides", () => {
  it.each(["=0", "=-2", "=1.5", "=65", "=1000000000"])(
    "does not certify %s as a valid whole slot count", raw => {
      const source: CanvasControl = {
        ...gallery, properties: { ...gallery.properties, WrapCount: raw }
      };
      for (const viewport of [390, 768, 1366]) {
        const template = galleryTemplateLayout(source,
          { x: 0, y: 0, width: viewport - 40, height: 600, dynamic: false },
          { parentWidth: viewport - 40, parentHeight: 600, appWidth: viewport, appHeight: 768 });
        expect(template).toMatchObject({ wrapCount: 1, dynamic: true });
        expect(galleryRecordsUnknown(source)).toBe(true);
      }
    }
  );

  it("marks only the unsupported responsive branch as approximate", () => {
    const source: CanvasControl = {
      ...gallery,
      properties: {
        ...gallery.properties,
        WrapCount: "=If(App.Width < 600, 1, App.Width < 1000, 2, 65)"
      }
    };
    for (const [viewport, expectedCount, unknown] of [
      [390, 1, false], [768, 2, false], [1366, 1, true]
    ] as const) {
      const template = galleryTemplateLayout(source,
        { x: 0, y: 0, width: viewport - 40, height: 600, dynamic: false },
        { parentWidth: viewport - 40, parentHeight: 600, appWidth: viewport, appHeight: 768 });
      expect(template).toMatchObject({ wrapCount: expectedCount, dynamic: unknown });
    }
  });

  it("keeps omitted and supported integer counts verified without loading Items", () => {
    for (const raw of [undefined, "=1", "=64"]) {
      const source: CanvasControl = {
        ...gallery,
        properties: {
          ...gallery.properties,
          ...(raw === undefined ? { WrapCount: undefined } : { WrapCount: raw })
        }
      };
      const template = galleryTemplateLayout(source,
        { x: 0, y: 0, width: 1280, height: 600, dynamic: false },
        { parentWidth: 1280, parentHeight: 600, appWidth: 1366, appHeight: 768 });
      expect(template).toMatchObject({
        wrapCount: raw === "=64" ? 64 : 1, dynamic: false
      });
      expect(galleryRecordsUnknown(source)).toBe(true);
    }
  });
});

describe("gallery TemplateSize precedence and unverifiable source geometry", () => {
  const viewportTemplate = (
    properties: Record<string, unknown>,
    viewport: number
  ) => galleryTemplateLayout(
    { ...gallery, properties: { ...gallery.properties, ...properties } },
    { x: 0, y: 0, width: viewport - 40, height: 600, dynamic: false },
    { parentWidth: viewport - 40, parentHeight: 600,
      appWidth: viewport, appHeight: 768 }
  );

  it.each([390, 768, 1366])(
    "does not replace an unknown TemplateSize with a known TemplateHeight at %s px",
    viewport => {
      const template = viewportTemplate({
        TemplateSize: "=If(varCanRead, 292, 128)",
        TemplateHeight: "=80"
      }, viewport);
      expect(template).toMatchObject({
        height: 72, dynamic: true, orientation: "vertical"
      });
      expect(galleryRecordsUnknown(gallery)).toBe(true);
    }
  );

  it("honors a known TemplateSize before TemplateHeight and the legacy fallback when absent", () => {
    expect(viewportTemplate({
      TemplateSize: "=292", TemplateHeight: "=128"
    }, 768)).toMatchObject({ height: 292, dynamic: false });

    expect(viewportTemplate({
      TemplateSize: undefined, TemplateHeight: "=128"
    }, 768)).toMatchObject({ height: 128, dynamic: false });
  });

  it.each(["=0", "=-20"])(
    "marks out-of-range TemplateSize %s as approximate rather than exact",
    value => {
      expect(viewportTemplate({ TemplateSize: value }, 390))
        .toMatchObject({ height: 1, dynamic: true });
    }
  );

  it("marks negative and runtime-dependent TemplatePadding as approximate", () => {
    expect(viewportTemplate({ TemplatePadding: "=-8" }, 768))
      .toMatchObject({ padding: 0, dynamic: true });
    expect(viewportTemplate({ TemplatePadding: "=varPadding" }, 768))
      .toMatchObject({ padding: 0, dynamic: true });
  });

  it("verifies only the valid branch of responsive template sizing and padding", () => {
    const properties = {
      TemplateSize: "=If(App.Width < 600, 0, 292)",
      TemplatePadding: "=If(App.Width < 600, 8, 16)"
    };
    expect(viewportTemplate(properties, 390))
      .toMatchObject({ height: 1, padding: 8, dynamic: true });
    expect(viewportTemplate(properties, 768))
      .toMatchObject({ height: 292, padding: 16, dynamic: false });
  });
});

describe("gallery Self geometry formula scope", () => {
  const selfGallery: CanvasControl = {
    ...gallery,
    properties: {
      ...gallery.properties,
      WrapCount: "=If(Self.Width < 600, 1, Self.Width < 1000, 2, 3)",
      TemplateSize: "=Max(1, Self.Height / 4)",
      TemplatePadding: "=If(Self.Width < 600, 8, Self.Width < 1000, 12, 16)"
    }
  };

  it.each([
    { viewport: 390, wrapCount: 1, padding: 8 },
    { viewport: 768, wrapCount: 2, padding: 12 },
    { viewport: 1366, wrapCount: 3, padding: 16 }
  ])("resolves gallery Self.Width and Self.Height at $viewport px", ({
    viewport, wrapCount, padding
  }) => {
    const galleryWidth = viewport - 40;
    const template = galleryTemplateLayout(selfGallery,
      { x: 0, y: 0, width: galleryWidth, height: 600, dynamic: false },
      { parentWidth: viewport, parentHeight: 768, appWidth: viewport, appHeight: 768 });
    expect(template).toMatchObject({
      wrapCount, padding, height: 150,
      width: galleryWidth / wrapCount, dynamic: false
    });
    expect(galleryRecordsUnknown(selfGallery)).toBe(true);
  });

  it("keeps Parent.Width separate from the gallery's Self.Width", () => {
    const source: CanvasControl = {
      ...selfGallery,
      properties: {
        ...selfGallery.properties,
        WrapCount: "=If(Parent.Width > Self.Width, 2, 1)"
      }
    };
    const template = galleryTemplateLayout(source,
      { x: 0, y: 0, width: 400, height: 600, dynamic: false },
      { parentWidth: 768, parentHeight: 768, appWidth: 768, appHeight: 768 });
    expect(template).toMatchObject({ wrapCount: 2, dynamic: false });
  });

  it.each([390, 768, 1366])(
    "does not certify Self-dependent template values from a fallback rect at %i px",
    viewport => {
      const template = galleryTemplateLayout(selfGallery,
        { x: 0, y: 0, width: viewport - 40, height: 600, dynamic: true },
        { parentWidth: viewport, parentHeight: 768, appWidth: viewport, appHeight: 768 });
      expect(template).toMatchObject({
        wrapCount: 1, height: 72, padding: 0, dynamic: true
      });
      expect(galleryRecordsUnknown(selfGallery)).toBe(true);
    }
  );
});
