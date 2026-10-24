/**
 * Source-only glyph selection for Canvas Icon controls.
 *
 * Classic controls use Icon.X enum literals; modern Icon controls can use
 * literal Fluent names (for example ="Add"). This deliberately supports a
 * small, explicit subset. Unknown formulas must not be treated as a glyph.
 *
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-shapes-icons
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/modern-controls/modern-control-icon
 */
export const PREVIEW_ICON_PATHS = {
  add: "M12 4V20 M4 12H20",
  search: "M10.5 4A6.5 6.5 0 1 0 10.5 17A6.5 6.5 0 1 0 10.5 4 M15.5 15.5L21 21",
  cancel: "M5 5L19 19 M19 5L5 19",
  check: "M4 12L9 17L20 6",
  chevronleft: "M15 5L8 12L15 19",
  chevronright: "M9 5L16 12L9 19",
  chevronup: "M5 15L12 8L19 15",
  chevrondown: "M5 9L12 16L19 9",
  arrowleft: "M20 12H4 M11 5L4 12L11 19",
  arrowright: "M4 12H20 M13 5L20 12L13 19",
  arrowup: "M12 20V4 M5 11L12 4L19 11",
  arrowdown: "M12 4V20 M5 13L12 20L19 13",
  edit: "M4 20L8.5 19L19 8.5L15.5 5L5 15.5L4 20 M13.5 7L17 10.5",
  trash: "M5 7H19 M9 7V4H15V7 M7 7L8 20H16L17 7 M10 10V17 M14 10V17",
  home: "M3 11L12 4L21 11 M6 10V20H18V10 M10 20V14H14V20"
} as const;

export type PreviewIconName = keyof typeof PREVIEW_ICON_PATHS;
export type PreviewIconResult = PreviewIconName | "none" | null;

const iconNames = new Set<string>(Object.keys(PREVIEW_ICON_PATHS));

/** No substring matching: Icon.AddressBook must never be rendered as Add. */
export function previewIconName(raw: unknown, modern = false): PreviewIconResult {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  const enumMatch = /^=?\s*Icon\.([A-Za-z]+)\s*$/i.exec(value);
  let name = enumMatch?.[1]?.toLowerCase();
  if (!name && modern) {
    // Modern Icon property is a Fluent icon name string, not a classic enum.
    const literal = /^=?\s*"([A-Za-z]+)"\s*$/.exec(value);
    name = literal?.[1]?.toLowerCase();
  }
  if (name === "none") return "none";
  return name && iconNames.has(name) ? name as PreviewIconName : null;
}
