import type { CanvasControl } from "../../types/canvas";
import {
  staticNumber,
  staticString,
  type StaticPowerFxValue
} from "../powerfx/staticEval";

export interface VisualRect {
  x: number;
  y: number;
  width: number;
  height: number;
  dynamic: boolean;
}

export interface LayoutContext {
  parentWidth: number;
  parentHeight: number;
  appWidth: number;
  appHeight: number;
  templateWidth?: number;
  templateHeight?: number;
}

const DEFAULTS: Record<string, { width: number; height: number }> = {
  button: { width: 160, height: 44 },
  label: { width: 220, height: 40 },
  text: { width: 220, height: 40 },
  textinput: { width: 240, height: 44 },
  dropdown: { width: 220, height: 44 },
  combobox: { width: 240, height: 44 },
  gallery: { width: 420, height: 300 },
  form: { width: 520, height: 420 },
  image: { width: 120, height: 100 },
  icon: { width: 44, height: 44 },
  rectangle: { width: 120, height: 80 },
  container: { width: 600, height: 320 },
  group: { width: 600, height: 320 }
};

function layoutSymbols(
  context?: LayoutContext,
  selfWidth?: number,
  selfHeight?: number
): Record<string, StaticPowerFxValue> | undefined {
  if (!context) return undefined;

  const symbols: Record<string, StaticPowerFxValue> = {
    "Parent.Width": context.parentWidth,
    "Parent.Height": context.parentHeight,
    "App.Width": context.appWidth,
    "App.Height": context.appHeight
  };

  if (context.templateWidth !== undefined) {
    symbols["Parent.TemplateWidth"] = context.templateWidth;
  }
  if (context.templateHeight !== undefined) {
    symbols["Parent.TemplateHeight"] = context.templateHeight;
  }
  if (selfWidth !== undefined) symbols["Self.Width"] = selfWidth;
  if (selfHeight !== undefined) symbols["Self.Height"] = selfHeight;

  return symbols;
}

export function literalNumber(value: unknown): number | null {
  return staticNumber(value);
}

export function literalText(value: unknown): string | null {
  return staticString(value);
}

export function rgba(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const match = value
    .trim()
    .match(
      /^=\s*RGBA\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)\s*$/i
    );

  if (!match) return null;

  return (
    "rgba(" +
    match[1] +
    "," +
    match[2] +
    "," +
    match[3] +
    "," +
    match[4] +
    ")"
  );
}

function defaultsFor(type: string): { width: number; height: number } {
  const lower = type.toLowerCase();
  const key = Object.keys(DEFAULTS).find(candidate =>
    lower.includes(candidate)
  );
  return key ? DEFAULTS[key] : { width: 180, height: 56 };
}

function resolvedNumber(
  value: unknown,
  symbols: Record<string, StaticPowerFxValue> | undefined
): number | null {
  return staticNumber(value, symbols);
}

export function controlRect(
  control: CanvasControl,
  index: number,
  context?: LayoutContext
): VisualRect {
  const defaults = defaultsFor(control.controlType);
  const baseSymbols = layoutSymbols(context);

  const width = resolvedNumber(control.properties.Width, baseSymbols);
  const height = resolvedNumber(control.properties.Height, baseSymbols);

  const finalWidth = Math.max(8, width ?? defaults.width);
  const finalHeight = Math.max(8, height ?? defaults.height);

  const selfSymbols = layoutSymbols(
    context,
    finalWidth,
    finalHeight
  );

  const x = resolvedNumber(control.properties.X, selfSymbols);
  const y = resolvedNumber(control.properties.Y, selfSymbols);

  return {
    x: x ?? 24 + (index % 4) * 190,
    y: y ?? 24 + Math.floor(index / 4) * 72,
    width: finalWidth,
    height: finalHeight,
    dynamic:
      x === null ||
      y === null ||
      width === null ||
      height === null
  };
}
