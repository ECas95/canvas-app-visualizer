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

  it("distinguishes galleries with an Items formula from static containers", () => {
    expect(galleryRecordsUnknown(control("Gallery", {
      Items: "=Filter(colApps, IsEnabled)"
    }))).toBe(true);
    expect(galleryRecordsUnknown(control("GroupContainer", {
      Items: "=Filter(colApps, IsEnabled)"
    }))).toBe(false);
  });
});
