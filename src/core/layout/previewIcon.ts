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
import { evaluateStaticPowerFx, staticBoolean, staticNumber, type StaticPowerFxValue } from "../powerfx/staticEval";
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
  home: "M3 11L12 4L21 11 M6 10V20H18V10 M10 20V14H14V20",
  // Classic Icon.Lock and Icon.ShoppingCart are documented Microsoft Canvas icons.
  // These are bounded local SVG approximations, not Power Apps runtime assets.
  lock: "M6 11V8A6 6 0 0 1 18 8V11 M5 11H19V21H5Z",
  shoppingcart: "M3 4H5L7.5 16H19L21 7H6 M8.5 20A1 1 0 1 0 10.5 20A1 1 0 1 0 8.5 20 M17.5 20A1 1 0 1 0 19.5 20A1 1 0 1 0 17.5 20"
} as const;

export type PreviewIconName = keyof typeof PREVIEW_ICON_PATHS;
export type PreviewIconResult = PreviewIconName | "none" | null;

const iconNames = new Set<string>(Object.keys(PREVIEW_ICON_PATHS));

/** No substring matching: Icon.AddressBook must never be rendered as Add. */
/**
 * Resolve a source Icon only from an explicit supported literal or a
 * provably selected Power Fx If/Switch branch. Conditions are evaluated locally
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
  // Icon enums and modern Fluent names have different Power Fx types.
  // Tokenize first so valid comments/trivia do not hide an enum, while
  // strings, concatenations and malformed formulas cannot impersonate one.
  const lexed = lexPowerFx(source);
  if (lexed.diagnostics.length) return null;
  const tokens = significantTokens(lexed.tokens);
  if (tokens[0]?.value === "=") tokens.shift();

  let name: string | undefined;
  if (tokens.length === 3 &&
      tokens[0].kind === "identifier" &&
      tokens[0].value.toLowerCase() === "icon" &&
      tokens[1].value === "." &&
      tokens[2].kind === "identifier") {
    name = tokens[2].value.toLowerCase();
  } else if (modern && tokens.length === 1 && tokens[0].kind === "string") {
    // Fluent icon names are text only on modern Icon controls.
    const literal = tokens[0].value.slice(1, -1).replaceAll('""', '"');
    if (/^[A-Za-z]+$/.test(literal)) name = literal.toLowerCase();
  }
  // Blank() is a provably empty Icon value, not an unknown runtime glyph.
  // Power Fx permits Blank for any data type; this is not Icon.None syntax.
  // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-isblank-isempty
  if (tokens.length === 3 && tokens[0].kind === "identifier" &&
      tokens[0].value.toLowerCase() === "blank" &&
      tokens[1].value === "(" && tokens[2].value === ")") return "none";
  if (name === "none") return "none";
  if (modern && name === "delete") name = "trash";
  if (name && iconNames.has(name)) return name as PreviewIconName;

  // Only typed, provably selected If/Switch branches may produce a glyph.
  // Runtime-dependent conditions stay unknown (fail closed).
  const functionName = tokens[0]?.value.toLowerCase();
  if ((functionName !== "if" && functionName !== "switch") ||
      tokens[1]?.value !== "(" ||
      tokens[tokens.length - 1]?.value !== ")") return null;

  // Split only at the top-level commas; nested functions and other
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

  if (functionName === "switch") {
    // Switch matches an ordered scalar selector, then returns a typed Icon
    // result. Avoid text selectors here: the scalar evaluator cannot tell a
    // text value from an enum member serialized as a string. Unknown earlier
    // matches cannot be skipped, and no default means a known Blank icon.
    // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-if
    if (args.length < 3) return null;
    const selector = evaluateStaticPowerFx(expression(args[0]), { symbols });
    if (selector === null || (typeof selector !== "boolean" &&
        typeof selector !== "number")) return null;
    for (let index = 1; index + 1 < args.length; index += 2) {
      const match = evaluateStaticPowerFx(expression(args[index]), { symbols });
      if (match === null || typeof match !== typeof selector) return null;
      if (selector === match) {
        return previewIconName(expression(args[index + 1]), modern, symbols, depth + 1);
      }
    }
    return args.length % 2 === 0
      ? previewIconName(expression(args[args.length - 1]), modern, symbols, depth + 1)
      : "none";
  }

  for (let index = 0; index + 1 < args.length; index += 2) {
    const condition = staticBoolean(expression(args[index]), symbols);
    if (condition === null) return null;
    if (condition) {
      return previewIconName(expression(args[index + 1]), modern, symbols, depth + 1);
    }
  }
  // Microsoft Power Fx If returns Blank when no condition matches and no
  // default was supplied. This is a known empty icon, not runtime unknown.
  return args.length % 2 === 1
    ? previewIconName(expression(args[args.length - 1]), modern, symbols, depth + 1)
    : "none";
}

/**
 * Modern Icon has four Power Fx padding properties. Use their verified
 * values to position the local SVG; runtime-only values remain unknown.
 * A 4px fallback preserves the previous approximation for omitted padding,
 * not a claim about the actual runtime theme default.
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/modern-controls/modern-control-icon
 */
export interface PreviewIconBox { x: number; y: number; size: number }

export function previewIconBox(
  props: Record<string, unknown>,
  x: number, y: number, width: number, height: number,
  modern: boolean,
  symbols?: Record<string, StaticPowerFxValue>
): PreviewIconBox | null {
  if (![x, y, width, height].every(Number.isFinite) ||
      width < 0 || height < 0) return null;

  const inset = (property: string): number | null =>
    modern && props[property] != null
      ? staticNumber(props[property], symbols)
      : 4;
  const left = inset("PaddingLeft");
  const right = inset("PaddingRight");
  const top = inset("PaddingTop");
  const bottom = inset("PaddingBottom");
  if (left === null || right === null || top === null || bottom === null ||
      ![left, right, top, bottom].every(value => Number.isFinite(value) && value >= 0)) {
    return null;
  }

  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  // Excess known padding collapses the icon content area, not runtime state.
  if (innerWidth <= 0 || innerHeight <= 0) {
    return { x: x + width / 2, y: y + height / 2, size: 0 };
  }
  const size = Math.min(innerWidth, innerHeight);
  return {
    x: x + left + (innerWidth - size) / 2,
    y: y + top + (innerHeight - size) / 2,
    size
  };
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
