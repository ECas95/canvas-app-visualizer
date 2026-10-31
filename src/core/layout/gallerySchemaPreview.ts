import type { CanvasControl } from "../../types/canvas";
import { lexPowerFx, significantTokens } from "../powerfx/lexer";
import type { GalleryTemplateLayout } from "./layout";

/**
 * Schema hints are mined exclusively from template formulas. They do not
 * describe SQL results, database schema, authorization or loaded Gallery rows.
 */
export function galleryReferencedFields(gallery: CanvasControl): string[] {
  const fields = new Map<string, string>();
  function walk(control: CanvasControl, depth: number): void {
    if (depth > 16 || fields.size >= 48) return;
    for (const raw of Object.values(control.properties)) {
      if (typeof raw !== "string" || !raw.includes("ThisItem") && !raw.includes("ThisRecord")) continue;
      const result = lexPowerFx(raw);
      if (result.diagnostics.length) continue;
      const tokens = significantTokens(result.tokens);
      for (let i = 0; i + 2 < tokens.length; i++) {
        if (tokens[i].kind !== "identifier" ||
            !/^(?:ThisItem|ThisRecord)$/i.test(tokens[i].value) ||
            tokens[i + 1].value !== ".") continue;
        const token = tokens[i + 2];
        if (token.kind !== "identifier" && token.kind !== "quotedIdentifier") continue;
        const name = token.kind === "quotedIdentifier"
          ? token.value.slice(1, -1).replaceAll("''", "'") : token.value;
        if (!name || name.length > 64 || fields.size >= 48) continue;
        if (!fields.has(name.toLowerCase())) fields.set(name.toLowerCase(), name);
      }
    }
    for (const child of control.children) walk(child, depth + 1);
  }
  for (const control of gallery.children) walk(control, 0);
  return [...fields.values()];
}

/** Text clues rendered as [Field], never a synthetic database value. */
export function galleryTemplatePlaceholderText(
  raw: unknown,
  slot: number
): string | null {
  if (typeof raw !== "string" || raw.length > 8192) return null;
  const result = lexPowerFx(raw);
  if (result.diagnostics.length) return null;
  const tokens = significantTokens(result.tokens);
  for (let i = 0; i + 2 < tokens.length; i++) {
    if (tokens[i].kind !== "identifier" ||
        !/^(?:ThisItem|ThisRecord)$/i.test(tokens[i].value) ||
        tokens[i + 1].value !== ".") continue;
    const token = tokens[i + 2];
    if (token.kind !== "identifier" && token.kind !== "quotedIdentifier") continue;
    const name = token.kind === "quotedIdentifier"
      ? token.value.slice(1, -1).replaceAll("''", "'") : token.value;
    if (name.length > 64) continue;
    return "[" + name + " #" + (slot + 1) + "]";
  }
  return null;
}

export interface GallerySampleCell {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Slot grid only; records are not inferred or fetched. */
export function gallerySampleCells(
  template: GalleryTemplateLayout,
  x: number,
  y: number,
  requested = 6
): GallerySampleCell[] {
  if (template.dynamic || !Number.isFinite(template.width) ||
      !Number.isFinite(template.height) || template.width <= 0 || template.height <= 0 ||
      !Number.isInteger(template.wrapCount) || template.wrapCount < 1) return [];
  return Array.from({ length: Math.max(0, Math.min(6, Math.floor(requested))) }, (_, i) => {
    const row = template.orientation === "vertical"
      ? Math.floor(i / template.wrapCount) : i % template.wrapCount;
    const col = template.orientation === "vertical"
      ? i % template.wrapCount : Math.floor(i / template.wrapCount);
    return { index: i, x: x + col * template.width, y: y + row * template.height,
      width: template.width, height: template.height };
  });
}
