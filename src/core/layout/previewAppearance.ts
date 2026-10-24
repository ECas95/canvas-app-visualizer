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

export function previewColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  const rgb = rgba(value);
  if (rgb) return rgb;
  const named = value.match(/^=?\s*Color\.([A-Za-z]+)\s*$/i);
  if (named) return NAMED_COLORS[named[1].toLowerCase()] ?? null;
  const hex = value.match(/^=?\s*ColorValue\(\s*["'](#[a-fA-F0-9]{3,8})["']\s*\)\s*$/i);
  if (hex) return hex[1];
  const literal = literalText(value);
  if (literal && /^#[a-fA-F0-9]{3,8}$/.test(literal)) return literal;
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
    return resolved && /^#[a-fA-F0-9]{3,8}$/.test(resolved) ? resolved : null;
  }
  const scalar = staticString(value, symbols);
  if (scalar && /^#[a-fA-F0-9]{3,8}$/.test(scalar)) return scalar;

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

export function previewFontSize(
  control: CanvasControl,
  symbols?: Record<string, StaticPowerFxValue>
): number {
  const resolved = staticNumber(control.properties.Size, symbols) ??
    staticNumber(control.properties.FontSize, symbols);
  return resolved !== null && resolved > 0 ? Math.min(256, resolved) : 14;
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
function enumValue(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().replace(/^=\s*/, "");
  const match = value.match(/^(?:[A-Za-z]+\.)?([A-Za-z]+)$/);
  return match ? match[1].toLowerCase() : null;
}

export type PreviewHorizontalAlign = "start" | "middle" | "end";
export type PreviewVerticalAlign = "top" | "middle" | "bottom";

export function previewHorizontalAlign(control: CanvasControl): PreviewHorizontalAlign | null {
  const value = enumValue(control.properties.Align ?? control.properties.TextAlign);
  if (value === "center" || value === "middle") return "middle";
  if (value === "right" || value === "end") return "end";
  if (value === "left" || value === "start") return "start";
  return null;
}

export function previewVerticalAlign(control: CanvasControl): PreviewVerticalAlign | null {
  const value = enumValue(control.properties.VerticalAlign ?? control.properties.TextVerticalAlignment);
  if (value === "top") return "top";
  if (value === "bottom") return "bottom";
  if (value === "middle" || value === "center") return "middle";
  return null;
}

export function previewFontWeight(control: CanvasControl): number | undefined {
  const value = enumValue(control.properties.FontWeight);
  if (value === "bold") return 700;
  if (value === "semibold") return 600;
  if (value === "normal" || value === "regular") return 400;
  if (value === "light") return 300;
  return undefined;
}

export function previewItalic(control: CanvasControl): boolean {
  return staticBoolean(control.properties.Italic) === true;
}

export function previewTextDecoration(control: CanvasControl): string | undefined {
  const decorations: string[] = [];
  if (staticBoolean(control.properties.Underline) === true) decorations.push("underline");
  if (staticBoolean(control.properties.Strikethrough) === true) decorations.push("line-through");
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
