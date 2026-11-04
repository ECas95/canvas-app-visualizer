import type { CanvasControl } from "../../types/canvas";
import { evaluateStaticPowerFx, staticString, type StaticPowerFxValue } from "../powerfx/staticEval";
import { galleryReferencedFields, galleryTemplatePlaceholderText } from "./gallerySchemaPreview";
import { localGalleryRowSymbols, type GalleryLocalRow } from "./galleryLocalSnapshot";

/** A Form's Form.Item is a runtime expression. DataField is a source usage hint. */
export function previewFormFields(form: CanvasControl): string[] {
  const discovered = new Map<string, string>();
  function add(name: string): void {
    if (name && name.length <= 64 && !discovered.has(name.toLowerCase()))
      discovered.set(name.toLowerCase(), name);
  }
  for (const name of galleryReferencedFields(form)) add(name);
  function walk(items: CanvasControl[], depth: number): void {
    if (depth > 12) return;
    for (const item of items) {
      const value = staticString(item.properties.DataField);
      if (value) add(value);
      walk(item.children, depth + 1);
    }
  }
  walk(form.children, 0);
  return [...discovered.values()].slice(0, 48);
}

/**
 * Bind only explicitly supplied scalar example rows to ThisItem.* and a
 * DataCard's Parent.Default when its source formula is locally resolvable.
 * Unknown SQL/Dataverse Form.Item records remain unknown.
 */
export function previewFormSymbols(
  row?: GalleryLocalRow,
  parentDataCard?: CanvasControl,
  existingSymbols: Record<string, StaticPowerFxValue> = {}
): Record<string, StaticPowerFxValue> {
  const symbols = { ...existingSymbols, ...(row ? localGalleryRowSymbols(row) : {}) };
  if (parentDataCard) {
    const source = parentDataCard.properties.Default;
    const value = evaluateStaticPowerFx(source, { symbols });
    if (value !== null) symbols["Parent.Default"] = value;
  }
  return symbols;
}

/** Paint only a copy of the Canvas source, never rewriting imported formulas. */
export function previewFormControl(
  control: CanvasControl,
  symbols: Record<string, StaticPowerFxValue>,
  displaySamples: boolean,
  parentDataCard?: CanvasControl
): CanvasControl {
  if (!displaySamples) return control;
  const fields = ["Text", "Default", "Value", "HintText", "Placeholder"];
  let changed: Record<string, unknown> | null = null;
  for (const field of fields) {
    const raw = control.properties[field];
    if (raw === undefined || staticString(raw, symbols) !== null) continue;
    let placeholder = galleryTemplatePlaceholderText(raw, 0);
    if (!placeholder && typeof raw === "string" &&
        /^\s*=?\s*Parent\.Default\s*$/i.test(raw)) {
      const dataField = parentDataCard && staticString(parentDataCard.properties.DataField);
      if (dataField) placeholder = "[" + dataField + " #example]";
    }
    if (!placeholder) continue;
    changed ??= { ...control.properties };
    changed[field] = '="' + placeholder.replaceAll('"', '""') + '"';
  }
  return changed ? { ...control, properties: changed } : control;
}
