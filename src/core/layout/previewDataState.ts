import type { CanvasControl } from "../../types/canvas";

/**
 * AllItems is a runtime table. In a source-only preview, do not assert
 * that it is empty or populated: neither state is supported by YAML.
 */
export function dependsOnRuntimeGalleryItems(control: CanvasControl): boolean {
  const visible = control.properties.Visible;
  if (typeof visible !== "string") return false;
  return /\b(?:IsEmpty|CountRows)\s*\(\s*(?:[A-Za-z_][A-Za-z0-9_]*\.)?AllItems\s*\)/i.test(visible);
}

/**
 * Gallery.Items may depend on external data or runtime collections. Until
 * evaluated against a verified local table, only the template is known.
 */
export function galleryRecordsUnknown(control: CanvasControl): boolean {
  return control.controlType.toLowerCase().includes("gallery") &&
    control.properties.Items !== undefined;
}
