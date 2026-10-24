import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import { dependsOnRuntimeGalleryItems, galleryRecordsUnknown } from "./previewDataState";

const control = (type: string, properties: Record<string, unknown>): CanvasControl => ({
  id: "c", name: "Example", controlType: type, properties, children: [],
  sourceFile: "Src/Test.pa.yaml", sourcePath: "Screens/Example",
  sourceFormat: "pa-yaml-v3", zIndex: 1
});

describe("source-only gallery state", () => {
  it("does not imply empty gallery when AllItems is unavailable", () => {
    expect(dependsOnRuntimeGalleryItems(control("GroupContainer", {
      Visible: "=varReady && IsEmpty(galCatalog.AllItems)"
    }))).toBe(true);
    expect(dependsOnRuntimeGalleryItems(control("Label", {
      Visible: "=CountRows(galCatalog.AllItems) = 0"
    }))).toBe(true);
    expect(dependsOnRuntimeGalleryItems(control("Label", {
      Visible: "=varVisible"
    }))).toBe(false);
  });

  it("recognizes direct AllItems access, nested functions and loaded-row counts", () => {
    for (const visible of [
      "=galCatalog.AllItemsCount = 0",
      "=If(galCatalog.AllItemsCount > 0, true, false)",
      "=IsBlank(First(galCatalog.AllItems))",
      "=IsEmpty('gal Catalog'.AllItems)",
      "=CountRows(galCatalog.'AllItems') = 0"
    ]) {
      expect(dependsOnRuntimeGalleryItems(control("Label", { Visible: visible }))).toBe(true);
    }
  });

  it("ignores names in strings, comments and unrelated identifiers", () => {
    for (const visible of [
      '="galCatalog.AllItems"',
      '=If(true, "galCatalog.AllItemsCount", "text")',
      "=true /* galCatalog.AllItems */",
      "=true // galCatalog.AllItemsCount",
      "=varAllItems",
      "=CountRows(OtherTable) = 0"
    ]) {
      expect(dependsOnRuntimeGalleryItems(control("Label", { Visible: visible }))).toBe(false);
    }
  });

  it("withholds gallery template rows even when Items is omitted or appears local", () => {
    for (const properties of [
      {},
      { Items: "=Filter(colApps, IsEnabled)" },
      { Items: '=Table({Title: "Example"})' },
      { Items: "=Table()" }
    ]) {
      expect(galleryRecordsUnknown(control("Classic/VerticalGallery@2.3.0", properties)))
        .toBe(true);
      expect(galleryRecordsUnknown(control("GroupContainer", properties))).toBe(false);
    }
  });
});
