import { literalNumber } from "./layout";

/**
 * Canvas controls expose four independent radius properties. SVG rect.rx
 * rounds every corner equally, so construct a source-based outline instead.
 * Unspecified/dynamic values retain the existing approximate 4px preview
 * default; they are not treated as verified runtime values.
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
  height: number
): PreviewCornerRadii {
  const maximum = Math.max(0, Math.min(width, height) / 2);
  const radius = (raw: unknown): number => {
    const source = literalNumber(raw);
    const approximate = source !== null && Number.isFinite(source) ? source : 4;
    return Math.min(maximum, Math.max(0, approximate));
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
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  const cap = Math.min(w, h) / 2;
  const clamp = (radius: number) =>
    Number.isFinite(radius) ? Math.max(0, Math.min(cap, radius)) : 0;
  const tl = clamp(corners.topLeft);
  const tr = clamp(corners.topRight);
  const br = clamp(corners.bottomRight);
  const bl = clamp(corners.bottomLeft);
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
 * Child clipping uses only provable source radii. Unknown runtime formulas do
 * not authorize rounded clipping: a square fallback avoids hiding content
 * based on an invented corner value. This differs intentionally from the
 * approximate 4px outline used for visual control placeholders.
 */
export function previewChildClipPath(
  properties: Record<string, unknown>,
  x: number,
  y: number,
  width: number,
  height: number
): string {
  const radius = (key: string): number => {
    const value = literalNumber(properties[key]);
    return value !== null && Number.isFinite(value) ? Math.max(0, value) : 0;
  };
  return previewRoundedRectPath(x, y, width, height, {
    topLeft: radius("RadiusTopLeft"),
    topRight: radius("RadiusTopRight"),
    bottomRight: radius("RadiusBottomRight"),
    bottomLeft: radius("RadiusBottomLeft")
  });
}
