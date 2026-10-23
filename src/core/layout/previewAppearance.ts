import type { CanvasControl } from "../../types/canvas";
import { literalNumber, literalText, rgba } from "./layout";
import { staticBoolean, type StaticPowerFxValue } from "../powerfx/staticEval";

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

export function previewFontSize(control: CanvasControl): number {
  const resolved = literalNumber(control.properties.Size) ??
    literalNumber(control.properties.FontSize);
  return resolved !== null && resolved > 0 ? Math.min(256, resolved) : 14;
}

export function isDefinitelyHidden(
  control: CanvasControl,
  symbols?: Record<string, StaticPowerFxValue>
): boolean {
  return staticBoolean(control.properties.Visible, symbols) === false;
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
