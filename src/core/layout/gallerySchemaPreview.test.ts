import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { galleryReferencedFields, gallerySampleCells, galleryTemplatePlaceholderText }
  from "./gallerySchemaPreview";
import type { GalleryTemplateLayout } from "./layout";

function control(name: string, properties: Record<string, unknown>, children: CanvasControl[] = []): CanvasControl {
  return {
    id: name, name, controlType: "GroupContainer", properties, children,
    sourceFile: "Src/Synthetic.pa.yaml", sourcePath: "Screens/Synthetic/" + name,
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
}
const layout: GalleryTemplateLayout = {
  x: 0, y: 0, width: 400, height: 292, wrapCount: 3,
  orientation: "vertical", variableHeight: false, padding: 8, dynamic: false
};

describe("synthetic source-template gallery inspection", () => {
  it("discovers fields used by nested ThisItem formulas, not raw Items SQL state", () => {
    const gallery = control("Gallery", {
      Items: "=SortByColumns(Filter(colApps, IsEnabled), \"SortOrder\")"
    }, [
      control("Card", {}, [
        control("Name", { Text: "=ThisItem.Name" }),
        control("Category", { Text: "=Upper(ThisItem.Category)" }),
        control("Status", { Text: '=If(ThisItem.IsEnabled, "AVAILABLE", "NO ACCESS")' }),
        control("Icon", { AccessibleLabel: '=ThisItem.Name & " icon"' }),
        control("Comment", { Text: '="ThisItem.PrivateField"' }),
        control("Other", { Text: "=ThisRecord.'Long Detail'" })
      ])
    ]);
    expect(galleryReferencedFields(gallery)).toEqual([
      "Name", "Category", "IsEnabled", "Long Detail"
    ]);
  });

  it("brackets field names with sample indices rather than inventing values", () => {
    expect(galleryTemplatePlaceholderText("=ThisItem.Name", 0)).toBe("[Name #1]");
    expect(galleryTemplatePlaceholderText("=Upper(ThisItem.Category)", 5)).toBe("[Category #6]");
    expect(galleryTemplatePlaceholderText('="ThisItem.Name"', 0)).toBeNull();
    expect(galleryTemplatePlaceholderText("=SomeConnector.Get().Name", 0)).toBeNull();
    expect(galleryTemplatePlaceholderText("=ThisItem.'Long Name'", 2)).toBe("[Long Name #3]");
  });

  it("calculates up to six wrapped template cells without synthetic access data", () => {
    const cells = gallerySampleCells(layout, 24, 252, 6);
    expect(cells).toHaveLength(6);
    expect(cells.map(x => [x.x, x.y])).toEqual([
      [24, 252], [424, 252], [824, 252],
      [24, 544], [424, 544], [824, 544]
    ]);
    expect(cells[0].width).toBe(400);
    expect(gallerySampleCells({ ...layout, dynamic: true }, 24, 252)).toEqual([]);
    expect(gallerySampleCells(layout, 24, 252, 100)).toHaveLength(6);
  });

  it("wraps horizontal sample grids in rows", () => {
    const cells = gallerySampleCells({
      ...layout, orientation: "horizontal", width: 292, height: 150, wrapCount: 2
    }, 10, 20, 4);
    expect(cells.map(x => [x.x, x.y])).toEqual([
      [10, 20], [10, 170], [302, 20], [302, 170]
    ]);
  });
});
