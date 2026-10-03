import type { CanvasControl } from "../../types/canvas";

export interface VisualRect {
  x: number;
  y: number;
  width: number;
  height: number;
  dynamic: boolean;
}

const DEFAULTS: Record<string, { width: number; height: number }> = {
  button: { width: 160, height: 44 },
  label: { width: 220, height: 40 },
  textinput: { width: 240, height: 44 },
  gallery: { width: 420, height: 300 },
  image: { width: 120, height: 100 },
  rectangle: { width: 120, height: 80 },
  container: { width: 600, height: 320 }
};

export function literalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const match = value.trim().match(/^=\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function literalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^=\s*"((?:[^"]|"")*)"\s*$/s);
  return match ? match[1].replaceAll('""', '"') : null;
}

export function rgba(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value
    .trim()
    .match(/^=\s*RGBA\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)\s*$/i);
  if (!match) return null;
  return "rgba(" + match[1] + "," + match[2] + "," + match[3] + "," + match[4] + ")";
}

function defaultsFor(type: string): { width: number; height: number } {
  const lower = type.toLowerCase();
  const key = Object.keys(DEFAULTS).find(candidate => lower.includes(candidate));
  return key ? DEFAULTS[key] : { width: 180, height: 56 };
}

export function controlRect(control: CanvasControl, index: number): VisualRect {
  const defaults = defaultsFor(control.controlType);
  const x = literalNumber(control.properties.X);
  const y = literalNumber(control.properties.Y);
  const width = literalNumber(control.properties.Width);
  const height = literalNumber(control.properties.Height);

  return {
    x: x ?? 24 + (index % 4) * 190,
    y: y ?? 24 + Math.floor(index / 4) * 72,
    width: Math.max(8, width ?? defaults.width),
    height: Math.max(8, height ?? defaults.height),
    dynamic: x === null || y === null || width === null || height === null
  };
}
