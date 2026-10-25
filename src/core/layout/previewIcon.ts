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
import { staticBoolean, staticNumber, type StaticPowerFxValue } from "../powerfx/staticEval";
import { lexPowerFx, significantTokens, type PowerFxToken } from "../powerfx/lexer";

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
/**
 * Resolve a source Icon only from an explicit supported literal or a
 * provably selected Power Fx If branch. Conditions are evaluated locally
 * with known App/Parent/Self/simulation symbols; no connector or behavior
 * expression is executed. An unresolved condition or unsupported glyph
 * stays unknown rather than silently choosing a fallback.
 *
 * https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-if
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-shapes-icons
 */
export function previewIconName(
  raw: unknown,
  modern = false,
  symbols?: Record<string, StaticPowerFxValue>,
  depth = 0
): PreviewIconResult {
  if (typeof raw !== "string" || depth > 6) return null;
  const source = raw.trim();
  const enumMatch = /^=?\s*Icon\.([A-Za-z]+)\s*$/i.exec(source);
  let name = enumMatch?.[1]?.toLowerCase();
  if (!name && modern) {
    // Modern Icon.Icon is a Fluent string; classic Icon enums are distinct.
    const literal = /^=?\s*"([A-Za-z]+)"\s*$/.exec(source);
    name = literal?.[1]?.toLowerCase();
  }
  if (name === "none") return "none";
  if (modern && name === "delete") name = "trash";
  if (name && iconNames.has(name)) return name as PreviewIconName;
  if (!symbols) return null;

  const lexed = lexPowerFx(source);
  if (lexed.diagnostics.length) return null;
  const tokens = significantTokens(lexed.tokens);
  if (tokens[0]?.value === "=") tokens.shift();
  if (tokens[0]?.value.toLowerCase() !== "if" || tokens[1]?.value !== "(" ||
      tokens[tokens.length - 1]?.value !== ")") return null;

  // Split only at the top-level commas of If(...); nested If and other
  // parentheses remain intact. Malformed or empty arguments fail closed.
  const inner = tokens.slice(2, -1);
  const args: PowerFxToken[][] = [];
  let nesting = 0;
  let begin = 0;
  for (let index = 0; index < inner.length; index++) {
    const value = inner[index].value;
    if (value === "(") nesting++;
    else if (value === ")") nesting--;
    else if (value === "," && nesting === 0) {
      if (index === begin) return null;
      args.push(inner.slice(begin, index));
      begin = index + 1;
    }
    if (nesting < 0) return null;
  }
  if (nesting !== 0 || begin >= inner.length) return null;
  args.push(inner.slice(begin));
  if (args.length < 2) return null;

  const expression = (part: PowerFxToken[]) =>
    "=" + source.slice(part[0].start, part[part.length - 1].end);
  for (let index = 0; index + 1 < args.length; index += 2) {
    const condition = staticBoolean(expression(args[index]), symbols);
    if (condition === null) return null;
    if (condition) {
      return previewIconName(expression(args[index + 1]), modern, symbols, depth + 1);
    }
  }
  return args.length % 2 === 1
    ? previewIconName(expression(args[args.length - 1]), modern, symbols, depth + 1)
    : null;
}

/**
 * Classic Canvas Icon.Rotation is measured in degrees. Only a statically
 * provable number may rotate the local preview glyph; unresolved Power Fx
 * leaves the icon unrotated rather than guessing a runtime value.
 * Normalization avoids unbounded SVG transform strings for large angles.
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-shapes-icons
 */
export function previewIconRotation(
  raw: unknown,
  symbols?: Record<string, StaticPowerFxValue>
): number | null {
  const degrees = staticNumber(raw, symbols);
  if (degrees === null) return null;
  const angle = degrees % 360;
  return Object.is(angle, -0) ? 0 : angle;
}
