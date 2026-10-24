import { literalNumber } from "./layout";
import { staticNumber, type StaticPowerFxValue } from "../powerfx/staticEval";

/**
 * Canvas controls expose four independent radius properties. SVG rect.rx
 * rounds every corner equally, so construct a source-based outline instead.
 * Unspecified/dynamic values retain the existing approximate 4px preview
 * default; they are not treated as verified runtime values. Do not cap each
 * corner at half the shorter side: Microsoft explicitly documents 300px
 * opposite corners on a 300px square button as a leaf shape.
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-button
 */
export interface PreviewCornerRadii {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

export function previewCornerRadii(
  properties: Record<string, unknown>,
  width: number,
  height: number,
  symbols?: Record<string, StaticPowerFxValue>
): PreviewCornerRadii {
  const radius = (raw: unknown): number => {
    const source = literalNumber(raw) ?? (symbols ? staticNumber(raw, symbols) : null);
    const approximate = source !== null && Number.isFinite(source) ? source : 4;
    return Math.max(0, approximate);
  };
  return {
    topLeft: radius(properties.RadiusTopLeft),
    topRight: radius(properties.RadiusTopRight),
    bottomRight: radius(properties.RadiusBottomRight),
    bottomLeft: radius(properties.RadiusBottomLeft)
  };
}

/** Generates a bounded SVG path without evaluating any Power Fx formula. */
export function previewRoundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  corners: PreviewCornerRadii
): string {
  const w = Number.isFinite(width) ? Math.max(0, width) : 0;
  const h = Number.isFinite(height) ? Math.max(0, height) : 0;
  const clamp = (radius: number) =>
    Number.isFinite(radius) ? Math.max(0, radius) : 0;
  const topLeft = clamp(corners.topLeft);
  const topRight = clamp(corners.topRight);
  const bottomRight = clamp(corners.bottomRight);
  const bottomLeft = clamp(corners.bottomLeft);
  // Match CSS corner-radius overlap normalization: all corners share one
  // scale factor when adjacent radii exceed an edge. A single large corner
  // can legitimately exceed half the shortest edge (e.g. Canvas leaf buttons).
  // This applies identically to the visual outline and descendant clipping.
  const edgeScale = (edge: number, first: number, second: number) =>
    first + second > 0 ? Math.min(1, edge / (first + second)) : 1;
  const scale = Math.min(
    1,
    edgeScale(w, topLeft, topRight),
    edgeScale(w, bottomLeft, bottomRight),
    edgeScale(h, topLeft, bottomLeft),
    edgeScale(h, topRight, bottomRight)
  );
  const tl = topLeft * scale;
  const tr = topRight * scale;
  const br = bottomRight * scale;
  const bl = bottomLeft * scale;
  return [
    `M ${x + tl} ${y}`,
    `H ${x + w - tr}`,
    `Q ${x + w} ${y} ${x + w} ${y + tr}`,
    `V ${y + h - br}`,
    `Q ${x + w} ${y + h} ${x + w - br} ${y + h}`,
    `H ${x + bl}`,
    `Q ${x} ${y + h} ${x} ${y + h - bl}`,
    `V ${y + tl}`,
    `Q ${x} ${y} ${x + tl} ${y}`,
    "Z"
  ].join(" ");
}


/**
 * Child clipping uses only provable radii, including formulas resolved from
 * known App/Parent/Self symbols. Unknown runtime formulas do not authorize
 * rounded clipping: a square fallback avoids hiding content
 * based on an invented corner value. This differs intentionally from the
 * approximate 4px outline used for visual control placeholders.
 */
export function previewChildClipPath(
  properties: Record<string, unknown>,
  x: number,
  y: number,
  width: number,
  height: number,
  symbols?: Record<string, StaticPowerFxValue>
): string {
  const radius = (key: string): number => {
    const value = literalNumber(properties[key]) ??
      (symbols ? staticNumber(properties[key], symbols) : null);
    return value !== null && Number.isFinite(value) ? Math.max(0, value) : 0;
  };
  return previewRoundedRectPath(x, y, width, height, {
    topLeft: radius("RadiusTopLeft"),
    topRight: radius("RadiusTopRight"),
    bottomRight: radius("RadiusBottomRight"),
    bottomLeft: radius("RadiusBottomLeft")
  });
}
