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

/**
 * Read a complete Power Fx enum literal using lexer tokens. Canvas formulas
 * may contain whitespace and comments around an enum member; those trivia
 * must not turn a known state into an approximation. Strings, identifiers,
 * operators and malformed expressions must never masquerade as enums.
 * This remains source-only analysis, not a Power Fx runtime evaluator.
 */
function sourceEnumMember(
  raw: string,
  namespace: string,
  members: readonly string[]
): string | null {
  const lexed = lexPowerFx(raw);
  if (lexed.diagnostics.length) return null;
  const tokens = significantTokens(lexed.tokens);
  if (tokens[0]?.value === "=") tokens.shift();
  if (tokens.length !== 3 ||
      tokens[0].kind !== "identifier" ||
      tokens[0].value.toLowerCase() !== namespace.toLowerCase() ||
      tokens[1].value !== "." ||
      tokens[2].kind !== "identifier") return null;
  const member = tokens[2].value.toLowerCase();
  return members.includes(member) ? member : null;
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

export function previewDropShadow(
  raw: unknown,
  symbols?: Record<string, StaticPowerFxValue>,
  depth = 0
): PreviewDropShadow | null {
  if (typeof raw !== "string" || depth > 6) return null;
  const source = raw.trim();
  const literal = sourceEnumMember(source, "DropShadow",
    ["none", "light", "semilight", "regular", "semibold", "bold", "extrabold"]);
  if (literal) return literal as PreviewDropShadow;
  if (!symbols) return null;

  // Resolve only a proven Power Fx If branch. Unavailable runtime conditions,
  // unsupported enum names, strings and arbitrary calls remain unknown.
  // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-if
  const lexed = lexPowerFx(source);
  if (lexed.diagnostics.length) return null;
  const tokens = significantTokens(lexed.tokens);
  if (tokens[0]?.value === "=") tokens.shift();
  if (tokens[0]?.value.toLowerCase() !== "if" || tokens[1]?.value !== "(" ||
      tokens[tokens.length - 1]?.value !== ")") return null;
  const branches = splitIfArguments(tokens.slice(2, -1));
  if (!branches || branches.length < 2) return null;

  for (let i = 0; i + 1 < branches.length; i += 2) {
    const condition = staticBoolean("=" + expressionText(source, branches[i]), symbols);
    if (condition === null) return null;
    if (condition) {
      return previewDropShadow("=" + expressionText(source, branches[i + 1]), symbols, depth + 1);
    }
  }
  const fallback = branches.length % 2 === 1 ? branches[branches.length - 1] : undefined;
  return fallback ? previewDropShadow("=" + expressionText(source, fallback), symbols, depth + 1) : null;
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
export function previewDropShadowFilter(
  raw: unknown,
  symbols?: Record<string, StaticPowerFxValue>
): string | undefined {
  const level = previewDropShadow(raw, symbols);
  return level && level !== "none" ? PREVIEW_SHADOW_FILTERS[level] : undefined;
}

export type PreviewBorderStyle = "solid" | "dashed" | "dotted" | "none";

/**
 * Resolve a Canvas BorderStyle only from an explicit enum or a provably
 * selected Power Fx If branch. Unknown runtime conditions, text that merely
 * resembles an enum and unsupported expressions remain unresolved.
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/properties-color-border
 * https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-if
 */
export function previewBorderStyle(
  raw: unknown,
  symbols?: Record<string, StaticPowerFxValue>,
  depth = 0
): PreviewBorderStyle | null {
  if (typeof raw !== "string" || depth > 6) return null;
  const source = raw.trim();
  const literal = sourceEnumMember(source, "BorderStyle", ["solid", "dashed", "dotted", "none"]);
  if (literal) return literal as PreviewBorderStyle;
  if (!symbols) return null;

  const lexed = lexPowerFx(source);
  if (lexed.diagnostics.length) return null;
  const tokens = significantTokens(lexed.tokens);
  if (tokens[0]?.value === "=") tokens.shift();
  if (tokens[0]?.value.toLowerCase() !== "if" || tokens[1]?.value !== "(" ||
      tokens[tokens.length - 1]?.value !== ")") return null;
  const branches = splitIfArguments(tokens.slice(2, -1));
  if (!branches || branches.length < 2) return null;

  for (let i = 0; i + 1 < branches.length; i += 2) {
    const condition = staticBoolean("=" + expressionText(source, branches[i]), symbols);
    if (condition === null) return null;
    if (condition) {
      return previewBorderStyle("=" + expressionText(source, branches[i + 1]), symbols, depth + 1);
    }
  }
  const fallback = branches.length % 2 === 1 ? branches[branches.length - 1] : undefined;
  return fallback ? previewBorderStyle("=" + expressionText(source, fallback), symbols, depth + 1) : null;
}

export type PreviewDisplayMode = "edit" | "disabled" | "view" | "unresolved";

/**
 * A DisplayMode enum is not interchangeable with a Power Fx text value.
 * staticString deliberately represents both as strings for general preview
 * expressions, so using it here would allow ="DisplayMode.Edit" (or a local
 * string variable) to enable simulated OnSelect. Resolve only source enum
 * tokens, optionally through a statically verified If branch.
 *
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-card
 * https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-if
 */
export function previewDisplayMode(
  raw: unknown,
  symbols?: Record<string, StaticPowerFxValue>,
  depth = 0
): PreviewDisplayMode {
  if (raw === undefined || raw === null) return "edit";
  if (typeof raw !== "string" || depth > 6) return "unresolved";
  const source = raw.trim();
  const literal = sourceEnumMember(source, "DisplayMode", ["edit", "disabled", "view"]);
  if (literal) return literal as "edit" | "disabled" | "view";

  const lexed = lexPowerFx(source);
  if (lexed.diagnostics.length) return "unresolved";
  const tokens = significantTokens(lexed.tokens);
  if (tokens[0]?.value === "=") tokens.shift();
  if (tokens[0]?.value.toLowerCase() !== "if" || tokens[1]?.value !== "(" ||
      tokens[tokens.length - 1]?.value !== ")") return "unresolved";
  const branches = splitIfArguments(tokens.slice(2, -1));
  if (!branches || branches.length < 2) return "unresolved";

  for (let i = 0; i + 1 < branches.length; i += 2) {
    const condition = staticBoolean("=" + expressionText(source, branches[i]), symbols);
    if (condition === null) return "unresolved";
    if (condition) {
      return previewDisplayMode("=" + expressionText(source, branches[i + 1]), symbols, depth + 1);
    }
  }
  const fallback = branches.length % 2 === 1 ? branches[branches.length - 1] : undefined;
  return fallback
    ? previewDisplayMode("=" + expressionText(source, fallback), symbols, depth + 1)
    : "unresolved";
}

export type PreviewInputState = "value" | "hint" | "empty" | "unknown";

/**
 * Distinguish a verified empty field from an unresolved runtime value.
 * Classic TextInput uses HintText; ModernTextInput@1.0.0 uses Placeholder.
 * A local, statically resolved empty Default permits the hint to appear;
 * SQL/connector-dependent values never imply an empty field or access.
 *
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-text-input
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/modern-controls/modern-control-text-input
 */
export function previewInputContent(
  control: CanvasControl,
  symbols?: Record<string, StaticPowerFxValue>
): { text: string | null; state: PreviewInputState } {
  const props = control.properties;
  const modern = /^modern\/?textinput(?:@|$)/i.test(control.controlType);
  const hint = modern ? props.Placeholder ?? props.HintText : props.HintText;
  const source = props.Default !== undefined ? props.Default : props.Value;
  if (source !== undefined && source !== null) {
    const initial = staticString(source, symbols);
    if (initial === null) return { text: null, state: "unknown" };
    if (initial !== "") return { text: initial, state: "value" };
  }
  if (hint === undefined || hint === null) return { text: "", state: "empty" };
  const placeholder = staticString(hint, symbols);
  if (placeholder === null) return { text: null, state: "unknown" };
  return { text: placeholder, state: placeholder === "" ? "empty" : "hint" };
}

/**
 * A ComboBox DefaultSelectedItems formula yields a table of records, not
 * display text. Without a verified Items snapshot and ItemDisplayText scope,
 * its selected caption is unknown even when a fallback placeholder is known.
 * A Dropdown may implicitly select its first Items row, also unavailable in
 * source-only previews. Do not fabricate either selection from SQL.
 *
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-combo-box
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-drop-down
 */
export type PreviewSelectState = "value" | "hint" | "empty" | "unknown";
export function previewSelectContent(
  control: CanvasControl,
  symbols?: Record<string, StaticPowerFxValue>
): { text: string | null; state: PreviewSelectState } {
  const props = control.properties;
  const combo = /combobox/i.test(control.controlType);
  if (combo && props.DefaultSelectedItems !== undefined &&
      props.DefaultSelectedItems !== null) {
    return { text: null, state: "unknown" };
  }
  if (props.Default !== undefined && props.Default !== null) {
    const value = staticString(props.Default, symbols);
    if (value === null) return { text: null, state: "unknown" };
    if (value !== "") return { text: value, state: "value" };
  }
  if (props.InputTextPlaceholder !== undefined &&
      props.InputTextPlaceholder !== null) {
    const hint = staticString(props.InputTextPlaceholder, symbols);
    if (hint === null) return { text: null, state: "unknown" };
    return { text: hint, state: hint === "" ? "empty" : "hint" };
  }
  // A dropdown with Items but no serialized Default may select the first
  // record at runtime. ComboBox without DefaultSelectedItems does not.
  return !combo && props.Items !== undefined
    ? { text: null, state: "unknown" }
    : { text: "", state: "empty" };
}

export function previewText(
  control: CanvasControl,
  symbols?: Record<string, StaticPowerFxValue>
): string | null {
  const props = control.properties;
  const kind = previewKind(control.controlType);
  if (kind === "input") return previewInputContent(control, symbols).text;
  if (kind === "select") return previewSelectContent(control, symbols).text;
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

/**
 * Select a Font family only from a known literal or a verified Power Fx If
 * branch. Unresolved runtime conditions, unknown fonts and CSS-like strings
 * retain the local fallback; no arbitrary source expression reaches CSS.
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-text-box
 * https://github.com/microsoft/PowerApps-Tooling/tree/master/schemas/pa-yaml/v3.0
 */
function sourceFontFamily(
  raw: unknown,
  symbols?: Record<string, StaticPowerFxValue>,
  depth = 0
): string | null {
  if (typeof raw !== "string" || depth > 6) return null;
  const source = raw.trim();
  // Power Fx permits whitespace and comments around member access.
  // Parse complete tokens: neither text nor partial expressions are enums.
  // Only the allowlisted family below is ever emitted as browser CSS.
  const lexed = lexPowerFx(source);
  if (lexed.diagnostics.length) return null;
  const tokens = significantTokens(lexed.tokens);
  if (tokens[0]?.value === "=") tokens.shift();
  const fontMember = tokens.length === 3 &&
    tokens[0].kind === "identifier" &&
    tokens[0].value.toLowerCase() === "font" &&
    tokens[1].value === "." &&
    (tokens[2].kind === "identifier" || tokens[2].kind === "quotedIdentifier")
      ? tokens[2].kind === "quotedIdentifier"
        ? tokens[2].value.slice(1, -1).replaceAll("''", "'")
        : tokens[2].value
      : null;
  const family = fontMember ?? staticString(raw);
  if (family) return PREVIEW_FONT_FAMILIES[family.trim().toLowerCase()] ?? null;
  if (!symbols) return null;
  if (tokens[0]?.value.toLowerCase() !== "if" || tokens[1]?.value !== "(" ||
      tokens[tokens.length - 1]?.value !== ")") return null;
  const branches = splitIfArguments(tokens.slice(2, -1));
  if (!branches || branches.length < 2) return null;

  for (let i = 0; i + 1 < branches.length; i += 2) {
    const condition = staticBoolean("=" + expressionText(source, branches[i]), symbols);
    if (condition === null) return null;
    if (condition) {
      return sourceFontFamily("=" + expressionText(source, branches[i + 1]), symbols, depth + 1);
    }
  }
  const fallback = branches.length % 2 === 1 ? branches[branches.length - 1] : undefined;
  return fallback ? sourceFontFamily("=" + expressionText(source, fallback), symbols, depth + 1) : null;
}

export function previewFontFamily(
  control: CanvasControl,
  symbols?: Record<string, StaticPowerFxValue>
): string {
  return sourceFontFamily(control.properties.Font, symbols) ?? PREVIEW_DEFAULT_FONT;
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

/**
 * Source-only initial checked state, not the live user-edited Value.
 * Modern checkbox/toggle controls serialize Checked; classic controls
 * serialize Default. A runtime formula must not be painted as false.
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-check-box
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/modern-controls/modern-control-checkbox
 */
export type PreviewCheckedState = "checked" | "unchecked" | "unknown";

export function previewCheckedState(
  control: CanvasControl,
  symbols?: Record<string, StaticPowerFxValue>
): PreviewCheckedState {
  const props = control.properties;
  // Prefer the source-controlled property over Value, which may be a runtime
  // output. Never OR contradictory properties into an invented true state.
  const raw = props.Checked !== undefined ? props.Checked :
    props.Default !== undefined ? props.Default : props.Value;
  if (raw === undefined || raw === null) return "unchecked";
  const resolved = staticBoolean(raw, symbols);
  return resolved === null ? "unknown" : resolved ? "checked" : "unchecked";
}

/** Legacy boolean convenience; visual callers should use the tri-state API. */
export function previewIsChecked(control: CanvasControl): boolean {
  return previewCheckedState(control) === "checked";
}

/**
 * Only serialized styling may override approximate defaults. Unknown or
 * runtime-dependent values stay undefined rather than being guessed.
 */
function enumValue(
  raw: unknown, namespace: "Align" | "VerticalAlign" | "FontWeight",
  symbols?: Record<string, StaticPowerFxValue>, depth = 0
): string | null {
  if (typeof raw !== "string" || depth > 6) return null;
  const source = raw.trim();
  // Typography enums share the same Power Fx token semantics as
  // DisplayMode/BorderStyle: comments and whitespace are trivia, while a
  // quoted string, extra operator or unknown member is not a valid enum.
  // Restrict recognized members rather than treating arbitrary identifiers
  // as verified formatting.
  const allowed: Record<typeof namespace, readonly string[]> = {
    Align: ["left", "right", "center", "middle", "start", "end", "justify"],
    VerticalAlign: ["top", "middle", "center", "bottom"],
    FontWeight: ["bold", "semibold", "normal", "regular", "light", "lighter"]
  };
  const literal = sourceEnumMember(source, namespace, allowed[namespace]);
  if (literal) return literal;

  if (!symbols) return null;
  // Power Fx If supports condition/result pairs and an optional default,
  // including nested If expressions. Only evaluate a selected branch when
  // every preceding condition is statically proven false. No connectors or
  // runtime-only variables are evaluated.
  // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-if
  const lexed = lexPowerFx(source);
  if (lexed.diagnostics.length) return null;
  const tokens = significantTokens(lexed.tokens);
  if (tokens[0]?.value === "=") tokens.shift();
  if (tokens[0]?.value.toLowerCase() !== "if" || tokens[1]?.value !== "(" ||
      tokens[tokens.length - 1]?.value !== ")") return null;
  const branches = splitIfArguments(tokens.slice(2, -1));
  if (!branches || branches.length < 2) return null;
  for (let i = 0; i + 1 < branches.length; i += 2) {
    const condition = staticBoolean("=" + expressionText(source, branches[i]), symbols);
    if (condition === null) return null;
    if (condition) {
      return enumValue("=" + expressionText(source, branches[i + 1]), namespace, symbols, depth + 1);
    }
  }
  const fallback = branches.length % 2 === 1 ? branches[branches.length - 1] : undefined;
  return fallback
    ? enumValue("=" + expressionText(source, fallback), namespace, symbols, depth + 1)
    : null;
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
