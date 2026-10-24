import type { CanvasControl } from "../../types/canvas";
import { literalText, rgba } from "./layout";
import { staticBoolean, staticNumber, staticString, type StaticPowerFxValue } from "../powerfx/staticEval";
import { lexPowerFx, significantTokens, type PowerFxToken } from "../powerfx/lexer";

export type PreviewKind =
  | "button" | "label" | "input" | "select" | "checkbox" | "toggle"
  | "gallery" | "form" | "container" | "image" | "icon"
  | "shape" | "unknown";

export function previewKind(controlType: string): PreviewKind {
  const type = controlType.toLowerCase();
  // Microsoft serializes its modern display-only Text control as
  // ModernText@1.0.0, not as a Label. Match the exact control family so
  // ModernTextInput and other text-bearing controls retain their own kind.
  // https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/modern-controls/modern-control-text
  if (/^moderntext(?:@|$)/.test(type)) return "label";
  if (type.includes("gallery")) return "gallery";
  if (type.includes("datacard") || type.includes("form")) return "form";
  if (type.includes("container") || type.includes("group")) return "container";
  if (type.includes("checkbox")) return "checkbox";
  if (type.includes("toggle")) return "toggle";
  if (type.includes("combobox") || type.includes("dropdown") || type.includes("listbox")) return "select";
  if (type.includes("textinput") || type.includes("dateinput") || type.includes("datepicker")) return "input";
  if (type.includes("button")) return "button";
  if (type.includes("label") || type.includes("htmltext")) return "label";
  if (type.includes("image")) return "image";
  if (type.includes("icon")) return "icon";
  if (type.includes("rectangle") || type.includes("circle") || type.includes("shape")) return "shape";
  return "unknown";
}

const NAMED_COLORS: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
  gray: "#808080",
  grey: "#808080",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  orange: "#ffa500",
  purple: "#800080",
  lightgray: "#d3d3d3",
  darkgray: "#a9a9a9"
};

// Browser CSS and the Canvas ColorValue documentation do not define five- or
// seven-digit hex colors. Keep supported shorthand CSS forms for existing
// source previews, but never emit malformed lengths as verified colors.
// https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-colors
const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function previewColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  const rgb = rgba(value);
  if (rgb) return rgb;
  const named = value.match(/^=?\s*Color\.([A-Za-z]+)\s*$/i);
  if (named) return NAMED_COLORS[named[1].toLowerCase()] ?? null;
  const hex = value.match(/^=?\s*ColorValue\(\s*"(#[a-fA-F0-9]+)"\s*\)\s*$/i);
  if (hex && HEX_COLOR_RE.test(hex[1])) return hex[1];
  const literal = literalText(value);
  if (literal && HEX_COLOR_RE.test(literal)) return literal;
  return null;
}


/** Evaluates only the selected branch of a scalar If for visual colors.
 * Unknown variables and unsupported syntax remain unresolved. There is no JS
 * evaluation, connector call, CSS expression injection or arbitrary function.
 */
function splitIfArguments(tokens: PowerFxToken[]): PowerFxToken[][] | null {
  const parts: PowerFxToken[][] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].value === "(") depth++;
    else if (tokens[i].value === ")") depth--;
    else if (tokens[i].value === "," && depth === 0) {
      if (i === start) return null;
      parts.push(tokens.slice(start, i));
      start = i + 1;
    }
    if (depth < 0) return null;
  }
  if (depth !== 0 || start >= tokens.length) return null;
  parts.push(tokens.slice(start));
  return parts;
}

function expressionText(source: string, tokens: PowerFxToken[]): string {
  return tokens.length ? source.slice(tokens[0].start, tokens[tokens.length - 1].end) : "";
}

export function previewColorWithSymbols(
  raw: unknown,
  symbols?: Record<string, StaticPowerFxValue>,
  depth = 0
): string | null {
  const known = previewColor(raw);
  if (known) return known;
  if (!symbols || typeof raw !== "string" || depth > 6) return null;
  const value = raw.trim();

  // Literal text variables and ColorValue(variable) are only accepted as
  // CSS-independent hex colors; never accept arbitrary string CSS.
  const colorValue = /^=?\s*ColorValue\(\s*([A-Za-z_][\w]*)\s*\)\s*$/i.exec(value);
  if (colorValue) {
    const resolved = staticString("=" + colorValue[1], symbols);
    return resolved && HEX_COLOR_RE.test(resolved) ? resolved : null;
  }
  const scalar = staticString(value, symbols);
  if (scalar && HEX_COLOR_RE.test(scalar)) return scalar;

  const lexed = lexPowerFx(value);
  if (lexed.diagnostics.length) return null;
  const tokens = significantTokens(lexed.tokens);
  if (tokens[0]?.value === "=") tokens.shift();
  if (tokens[0]?.value.toLowerCase() !== "if" || tokens[1]?.value !== "(" ||
      tokens[tokens.length - 1]?.value !== ")") return null;
  const branches = splitIfArguments(tokens.slice(2, -1));
  if (!branches || branches.length < 2) return null;

  for (let i = 0; i + 1 < branches.length; i += 2) {
    const condition = staticBoolean("=" + expressionText(value, branches[i]), symbols);
    if (condition === null) return null;
    if (condition) {
      return previewColorWithSymbols("=" + expressionText(value, branches[i + 1]), symbols, depth + 1);
    }
  }
  const fallback = branches.length % 2 === 1 ? branches[branches.length - 1] : undefined;
  return fallback ? previewColorWithSymbols("=" + expressionText(value, fallback), symbols, depth + 1) : null;
}

/**
 * A container shadow must not imply an opaque surface when the source fill
 * resolves to an alpha color. Power Fx ColorValue uses #RRGGBBAA and RGBA
 * uses a 0..1 alpha channel; only a proven fully opaque color qualifies.
 * Unrecognized or runtime-dependent colors fail closed.
 *
 * https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-colors
 */
export function previewIsOpaqueColor(color: string | null): boolean {
  if (!color) return false;
  if (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color)) return true;
  const alphaHex = /^#(?:[0-9a-f]{3}([0-9a-f])|[0-9a-f]{6}([0-9a-f]{2}))$/i.exec(color);
  if (alphaHex) return (alphaHex[1] ?? alphaHex[2]).toLowerCase() ===
    (alphaHex[1] ? "f" : "ff");
  const rgbaColor = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(\d+(?:\.\d*)?|\.\d+)\s*\)$/i.exec(color);
  return rgbaColor !== null && Number(rgbaColor[1]) === 1;
}

/**
 * Canvas container DropShadow is a Power Fx enum. Accept only explicit enum
 * literals from source; unknown runtime formulas must not be interpreted as
 * a confirmed shadow level. CSS values below are visual approximations.
 */
export type PreviewDropShadow =
  | "none" | "light" | "semilight" | "regular" | "semibold" | "bold" | "extrabold";

export function previewDropShadow(raw: unknown): PreviewDropShadow | null {
  if (typeof raw !== "string") return null;
  const match = /^=?\s*DropShadow\.(None|Light|Semilight|Regular|Semibold|Bold|ExtraBold)\s*$/i.exec(raw.trim());
  return match ? match[1].toLowerCase() as PreviewDropShadow : null;
}

const PREVIEW_SHADOW_FILTERS: Record<Exclude<PreviewDropShadow, "none">, string> = {
  light: "drop-shadow(0px 1px 2px rgba(0,0,0,0.12))",
  semilight: "drop-shadow(0px 2px 3px rgba(0,0,0,0.16))",
  regular: "drop-shadow(0px 3px 6px rgba(0,0,0,0.18))",
  semibold: "drop-shadow(0px 4px 8px rgba(0,0,0,0.22))",
  bold: "drop-shadow(0px 6px 12px rgba(0,0,0,0.26))",
  extrabold: "drop-shadow(0px 8px 16px rgba(0,0,0,0.30))"
};

/** Deterministic SVG-compatible CSS; never interpolates imported formulas. */
export function previewDropShadowFilter(raw: unknown): string | undefined {
  const level = previewDropShadow(raw);
  return level && level !== "none" ? PREVIEW_SHADOW_FILTERS[level] : undefined;
}

export type PreviewBorderStyle = "solid" | "dashed" | "dotted" | "none";

/** Read only explicit Canvas BorderStyle enum literals. Dynamic Power Fx stays unknown. */
export function previewBorderStyle(raw: unknown): PreviewBorderStyle | null {
  if (typeof raw !== "string") return null;
  const match = /^=?\s*BorderStyle\.(Solid|Dashed|Dotted|None)\s*$/i.exec(raw.trim());
  return match ? match[1].toLowerCase() as PreviewBorderStyle : null;
}

export type PreviewDisplayMode = "edit" | "disabled" | "view" | "unresolved";

export function previewDisplayMode(
  raw: unknown,
  symbols?: Record<string, StaticPowerFxValue>
): PreviewDisplayMode {
  if (raw === undefined || raw === null) return "edit";
  const resolved = staticString(raw, symbols);
  if (resolved === null) return "unresolved";
  const mode = resolved.toLowerCase();
  if (mode === "displaymode.edit") return "edit";
  if (mode === "displaymode.disabled") return "disabled";
  if (mode === "displaymode.view") return "view";
  return "unresolved";
}

export function previewText(control: CanvasControl): string | null {
  const props = control.properties;
  const kind = previewKind(control.controlType);
  if (kind === "input") {
    return literalText(props.Default) ?? literalText(props.Value) ??
      literalText(props.HintText);
  }
  if (kind === "select") {
    return literalText(props.DefaultSelectedItems) ??
      literalText(props.Default) ??
      literalText(props.InputTextPlaceholder);
  }
  return literalText(props.Text) ?? literalText(props.Label);
}


// Explicit Canvas Font enums are stable source values; runtime formulas are not.
// Limit the CSS output to known font families to avoid treating imported
// Power Fx expressions as arbitrary CSS or inventing an unavailable font.
const PREVIEW_FONT_FAMILIES: Record<string, string> = {
  "segoe ui": '"Segoe UI",system-ui,sans-serif',
  "arial": 'Arial,sans-serif',
  "verdana": 'Verdana,sans-serif',
  "tahoma": 'Tahoma,sans-serif',
  "calibri": 'Calibri,"Segoe UI",sans-serif',
  "open sans": '"Open Sans","Segoe UI",sans-serif',
  "georgia": 'Georgia,serif',
  "times new roman": '"Times New Roman",serif',
  "courier new": '"Courier New",monospace'
};

export const PREVIEW_DEFAULT_FONT = '"Segoe UI",system-ui,sans-serif';

/** Resolve a source-literal Font enum without running Power Fx or loading fonts. */
export function previewFontFamily(control: CanvasControl): string {
  const raw = control.properties.Font;
  if (typeof raw !== "string") return PREVIEW_DEFAULT_FONT;
  const source = raw.trim();
  const enumMatch = /^=?\s*Font\.(?:'([^']+)'|([A-Za-z][A-Za-z ]*))\s*$/i.exec(source);
  const family = enumMatch ? (enumMatch[1] ?? enumMatch[2]) : staticString(raw);
  return (family && PREVIEW_FONT_FAMILIES[family.trim().toLowerCase()]) ||
    PREVIEW_DEFAULT_FONT;
}

export function previewFontSize(
  control: CanvasControl,
  symbols?: Record<string, StaticPowerFxValue>
): number {
  const resolved = staticNumber(control.properties.Size, symbols) ??
    staticNumber(control.properties.FontSize, symbols);
  // The documented ModernText default is 15 pt; classic labels keep their
  // existing approximation. Explicit Size / legacy FontSize always wins.
  return resolved !== null && resolved > 0 ? Math.min(256, resolved) :
    /^moderntext(?:@|$)/i.test(control.controlType) ? 15 : 14;
}

export type PreviewVisibility = "visible" | "hidden" | "unknown";

/** Unknown runtime conditions are not interpreted as true or false. */
export function previewVisibility(
  control: CanvasControl,
  symbols?: Record<string, StaticPowerFxValue>
): PreviewVisibility {
  if (control.properties.Visible === undefined) return "visible";
  const visible = staticBoolean(control.properties.Visible, symbols);
  return visible === true ? "visible" : visible === false ? "hidden" : "unknown";
}

/** Only a provably true Canvas Wrap formula enables browser-measured label wrapping.
 * Unknown runtime values keep the existing conservative SVG text fallback.
 */
export function previewLabelWrap(
  control: CanvasControl,
  symbols?: Record<string, StaticPowerFxValue>
): boolean {
  return previewKind(control.controlType) === "label" &&
    staticBoolean(control.properties.Wrap, symbols) === true;
}

export function isDefinitelyHidden(
  control: CanvasControl,
  symbols?: Record<string, StaticPowerFxValue>
): boolean {
  return previewVisibility(control, symbols) === "hidden";
}

export function previewIsChecked(control: CanvasControl): boolean {
  return staticBoolean(control.properties.Default) === true ||
    staticBoolean(control.properties.Checked) === true ||
    staticBoolean(control.properties.Value) === true;
}

/**
 * Only serialized styling may override approximate defaults. Unknown or
 * runtime-dependent values stay undefined rather than being guessed.
 */
function enumValue(
  raw: unknown, namespace: "Align" | "VerticalAlign" | "FontWeight",
  symbols?: Record<string, StaticPowerFxValue>
): string | null {
  if (typeof raw !== "string") return null;
  // Power Fx enum members must belong to their documented namespace.
  // Bare identifiers, quoted strings and unrelated records (e.g. User.Right)
  // are not evidence of a static alignment or font weight.
  const exact = /^=?\s*([A-Za-z]+)\.([A-Za-z]+)\s*$/i.exec(raw.trim());
  if (exact) return exact[1].toLowerCase() === namespace.toLowerCase()
    ? exact[2].toLowerCase() : null;

  // A three-argument If with literal enum-valued arms can be selected using
  // verified App/Parent/Self/local symbols. Never promote a string variable
  // or a quoted enum lookalike into an enum value.
  if (!symbols) return null;
  const conditional = /^=?\s*If\(\s*[\s\S]+?,\s*([A-Za-z]+)\.([A-Za-z]+)\s*,\s*([A-Za-z]+)\.([A-Za-z]+)\s*\)$/i.exec(raw.trim());
  if (!conditional || conditional[1].toLowerCase() !== namespace.toLowerCase() ||
      conditional[3].toLowerCase() !== namespace.toLowerCase()) return null;
  const resolved = staticString(raw, symbols);
  const selected = typeof resolved === "string"
    ? /^([A-Za-z]+)\.([A-Za-z]+)$/i.exec(resolved) : null;
  return selected && selected[1].toLowerCase() === namespace.toLowerCase()
    ? selected[2].toLowerCase() : null;
}

export type PreviewHorizontalAlign = "start" | "middle" | "end" | "justify";
export type PreviewVerticalAlign = "top" | "middle" | "bottom";

export function previewHorizontalAlign(
  control: CanvasControl, symbols?: Record<string, StaticPowerFxValue>
): PreviewHorizontalAlign | null {
  const value = enumValue(control.properties.Align ?? control.properties.TextAlign, "Align", symbols);
  if (value === "center" || value === "middle") return "middle";
  if (value === "justify") return "justify";
  if (value === "right" || value === "end") return "end";
  if (value === "left" || value === "start") return "start";
  return null;
}

export function previewVerticalAlign(
  control: CanvasControl, symbols?: Record<string, StaticPowerFxValue>
): PreviewVerticalAlign | null {
  const value = enumValue(control.properties.VerticalAlign ?? control.properties.TextVerticalAlignment, "VerticalAlign", symbols);
  if (value === "top") return "top";
  if (value === "bottom") return "bottom";
  if (value === "middle" || value === "center") return "middle";
  return null;
}

export function previewFontWeight(
  control: CanvasControl, symbols?: Record<string, StaticPowerFxValue>
): number | undefined {
  const value = enumValue(control.properties.FontWeight, "FontWeight", symbols);
  if (value === "bold") return 700;
  if (value === "semibold") return 600;
  if (value === "normal" || value === "regular") return 400;
  if (value === "light" || value === "lighter") return 300;
  return undefined;
}

export function previewItalic(
  control: CanvasControl, symbols?: Record<string, StaticPowerFxValue>
): boolean {
  return staticBoolean(control.properties.Italic, symbols) === true;
}

export function previewTextDecoration(
  control: CanvasControl, symbols?: Record<string, StaticPowerFxValue>
): string | undefined {
  const decorations: string[] = [];
  if (staticBoolean(control.properties.Underline, symbols) === true) decorations.push("underline");
  if (staticBoolean(control.properties.Strikethrough, symbols) === true) decorations.push("line-through");
  return decorations.length ? decorations.join(" ") : undefined;
}

/**
 * Safe interaction preview: only trigger OnSelect when DisplayMode is known
 * to permit user input. Unknown formulas must not grant interaction.
 * An omitted property uses the control's normal editable default in preview.
 * Microsoft: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/modern-controls/modern-control-button
 */
export function previewCanRunOnSelect(
  control: CanvasControl,
  symbols?: Record<string, StaticPowerFxValue>
): boolean {
  return previewDisplayMode(control.properties.DisplayMode, symbols) === "edit";
}

/**
 * Source-only preview must not execute local OnSelect behavior from controls
 * that might be hidden, including descendants of unresolved Visible hosts.
 * Inspecting a node remains allowed; only behavior simulation is gated.
 * Gallery templates with Items are not evidence of actual loaded records.
 */
export function previewSelectionBehaviorGate(
  control: CanvasControl,
  symbols: Record<string, StaticPowerFxValue>,
  options: {
    ancestorVisibilityUnknown?: boolean;
    runtimeGalleryStateUnknown?: boolean;
    galleryRecordsUnknown?: boolean;
  } = {}
): "allowed" | "visibility-unverified" | "gallery-unverified" | "display-mode-unverified" {
  if (options.ancestorVisibilityUnknown || previewVisibility(control, symbols) !== "visible") {
    return "visibility-unverified";
  }
  if (options.runtimeGalleryStateUnknown || options.galleryRecordsUnknown) {
    return "gallery-unverified";
  }
  return previewCanRunOnSelect(control, symbols) ? "allowed" : "display-mode-unverified";
}
