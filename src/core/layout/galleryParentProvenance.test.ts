import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { galleryTemplateLayout } from "./layout";
import { galleryRecordsUnknown } from "./previewDataState";

// Synthetic gallery only: no user YAML, SQL rows, identities or permissions.
const gallery: CanvasControl = {
  id: "synthetic-parent-provenance",
  name: "SyntheticGallery",
  controlType: "Classic/Gallery@2.15.0",
  variant: "Vertical",
  properties: {
    Items: "=SyntheticSource",
    Width: "=Parent.Width - 20",
    Height: "=600",
    WrapCount: "=If(Self.Width > 600, 3, 1)",
    TemplateSize: "=If(Parent.Width > 600, 292, 128)",
    TemplatePadding: "=If(Self.Width > 600, 8, 16)"
  },
  children: [],
  zIndex: 1,
  sourceFile: "Src/Synthetic.pa.yaml",
  sourcePath: "Screens/Synthetic/SyntheticGallery",
  sourceFormat: "pa-yaml-v3"
};

describe("gallery source geometry provenance", () => {
  it.each([390, 768, 1366])(
    "does not promote fallback Parent geometry to verified gallery template values at %i px",
    viewport => {
      // Parent.Width=800 is a paint fallback, not an observed Canvas runtime
      // measurement. The matching gallery width cannot certify Self.Width.
      const template = galleryTemplateLayout(gallery,
        { x: 0, y: 0, width: 780, height: 600, dynamic: true },
        { parentWidth: 800, parentHeight: 768, appWidth: viewport, appHeight: 768 });
      expect(template).toMatchObject({
        wrapCount: 1, width: 780, height: 72, padding: 0, dynamic: true
      });
      expect(galleryRecordsUnknown(gallery)).toBe(true);
    }
  );

  it.each([
    { viewport: 390, columns: 1, size: 240, padding: 8 },
    { viewport: 768, columns: 2, size: 292, padding: 16 },
    { viewport: 1366, columns: 3, size: 292, padding: 16 }
  ])(
    "still resolves independently verified App/Self dimensions at $viewport px",
    ({ viewport, columns, size, padding }) => {
      const source: CanvasControl = {
        ...gallery,
        properties: {
          ...gallery.properties,
          Width: "=App.Width - 40",
          WrapCount: "=If(Self.Width < 600, 1, Self.Width < 1000, 2, 3)",
          TemplateSize: "=If(App.Width < 600, 240, 292)",
          TemplatePadding: "=If(Self.Width < 600, 8, 16)"
        }
      };
      const width = viewport - 40;
      const template = galleryTemplateLayout(source,
        { x: 0, y: 0, width, height: 600, dynamic: true },
        { parentWidth: 800, parentHeight: 768, appWidth: viewport, appHeight: 768 });
      expect(template).toMatchObject({
        wrapCount: columns, width: width / columns,
        height: size, padding, dynamic: true
      });
      expect(galleryRecordsUnknown(source)).toBe(true);
    }
  );
});
