import type { CanvasControl } from "../../types/canvas";
import { literalNumber, literalText, rgba } from "./layout";
import { staticBoolean } from "../powerfx/staticEval";

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
  return Math.min(32, Math.max(9, resolved ?? 14));
}

export function isDefinitelyHidden(control: CanvasControl): boolean {
  return staticBoolean(control.properties.Visible) === false;
}

export function previewIsChecked(control: CanvasControl): boolean {
  return staticBoolean(control.properties.Default) === true ||
    staticBoolean(control.properties.Checked) === true ||
    staticBoolean(control.properties.Value) === true;
}
