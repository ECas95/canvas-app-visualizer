import type { StaticPowerFxValue } from "../powerfx/staticEval";

/** Local UI-only data, never inferred from SQL or given access authority. */
export type GalleryLocalRow = Record<string, StaticPowerFxValue>;

export const MAX_GALLERY_JSON_BYTES = 64 * 1024;
const MAX_ROWS = 6;
const MAX_FIELDS = 48;
const MAX_TEXT_LENGTH = 512;
const FIELD_RE = /^[\p{L}_][\p{L}\p{N}_ ]{0,63}$/u;

export interface GallerySnapshotResult {
  rows: GalleryLocalRow[] | null;
  error: string | null;
}

/**
 * Parse an intentionally bounded, untrusted JSON array of local scalar
 * records. No reviver, remote fetch, persistence, executable expressions,
 * nested objects, arrays, or arbitrary CSS/HTML behavior is accepted.
 *
 * This is a visual fixture; it is NOT a verified Gallery.Items snapshot.
 */
export function parseGallerySnapshotJson(source: string): GallerySnapshotResult {
  const reject = (error: string): GallerySnapshotResult => ({ rows: null, error });
  if (new TextEncoder().encode(source).length > MAX_GALLERY_JSON_BYTES)
    return reject("JSON exceeds the 64 KB local file limit.");
  let parsed: unknown;
  try { parsed = JSON.parse(source); }
  catch { return reject("Invalid JSON. Supply an array of record objects."); }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > MAX_ROWS)
    return reject("Provide an array of 1 to 6 local record objects.");

  const rows: GalleryLocalRow[] = [];
  for (const [index, entry] of parsed.entries()) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry) ||
        Object.getPrototypeOf(entry) !== Object.prototype)
      return reject("Row " + (index + 1) + " must be a plain object.");

    const keys = Object.keys(entry);
    if (keys.length < 1 || keys.length > MAX_FIELDS)
      return reject("Each row must contain 1 to 48 scalar fields.");
    const output: GalleryLocalRow = Object.create(null);
    const seen = new Set<string>();
    for (const key of keys) {
      const lowered = key.toLowerCase();
      if (!FIELD_RE.test(key) ||
          ["__proto__", "constructor", "prototype"].includes(lowered) ||
          seen.has(lowered))
        return reject("Unsupported or duplicate field name in row " + (index + 1) + ": " + key);
      seen.add(lowered);
      const value = (entry as Record<string, unknown>)[key];
      if (typeof value === "string") {
        if (value.length > MAX_TEXT_LENGTH) return reject("Text fields must be 512 characters or fewer.");
      } else if (typeof value === "number") {
        if (!Number.isFinite(value)) return reject("Numbers must be finite.");
      } else if (typeof value !== "boolean") {
        return reject("Only text, number and Boolean values are supported (row " + (index + 1) + ").");
      }
      output[key] = value as StaticPowerFxValue;
    }
    rows.push(output);
  }
  return { rows, error: null };
}

/** Source formula bindings for a single explicitly supplied local record. */
export function localGalleryRowSymbols(row: GalleryLocalRow):
  Record<string, StaticPowerFxValue> {
  const symbols: Record<string, StaticPowerFxValue> = Object.create(null);
  for (const [key, value] of Object.entries(row)) {
    symbols["ThisItem." + key] = value;
    symbols["ThisRecord." + key] = value;
  }
  return symbols;
}
