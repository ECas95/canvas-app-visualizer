import type { PreviewMediaAsset } from "../../types/canvas";
import { literalText } from "./layout";
import { staticBoolean, staticString, type StaticPowerFxValue } from "../powerfx/staticEval";

/** Resolve only exact, locally imported raster media names. Never fetch remote URLs. */
export function resolvePreviewImage(
  raw: unknown,
  mediaAssets: PreviewMediaAsset[]
): PreviewMediaAsset | undefined {
  if (typeof raw !== "string") return undefined;
  const constant = literalText(raw);
  const symbol = /^=\s*(?:Media\.)?([A-Za-z_][A-Za-z0-9_]*)\s*$/i.exec(raw.trim())?.[1];
  const candidate = constant ?? symbol;
  if (!candidate || /[\\/:?#]/.test(candidate)) return undefined;
  const name = candidate.replace(/\.(png|jpe?g|gif|webp)$/i, "").toLowerCase();
  return mediaAssets.find(asset => asset.name === name);
}

/**
 * Source-only ImagePosition enum. Center and Tile must retain raster pixel
 * dimensions; SVG preserveAspectRatio scales and cannot express either mode.
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/properties-visual
 */
export type PreviewImagePosition = "fit" | "fill" | "stretch" | "center" | "tile";

export function previewImagePosition(
  raw: unknown, symbols?: Record<string, StaticPowerFxValue>
): PreviewImagePosition | null {
  if (typeof raw !== "string") return null;
  const exact = /^=?\s*ImagePosition\.(Fit|Fill|Stretch|Center|Tile)\s*$/i.exec(raw.trim());
  if (exact) return exact[1].toLowerCase() as PreviewImagePosition;
  // Only a proven viewport/local branch selecting a real Power Fx enum may
  // change image layout. Strings that merely spell an enum are not enums.
  if (!/\bImagePosition\.(?:Fit|Fill|Stretch|Center|Tile)\b/i.test(raw) ||
      /["']ImagePosition\.(?:Fit|Fill|Stretch|Center|Tile)["']/i.test(raw)) return null;
  const resolved = staticString(raw, symbols);
  const match = typeof resolved === "string"
    ? /^ImagePosition\.(Fit|Fill|Stretch|Center|Tile)$/i.exec(resolved) : null;
  return match ? match[1].toLowerCase() as PreviewImagePosition : null;
}

/** Map scalable ImagePosition modes to SVG preserveAspectRatio. */
export function previewImageFit(
  raw: unknown, symbols?: Record<string, StaticPowerFxValue>
): string {
  switch (previewImagePosition(raw, symbols)) {
    case "stretch": return "none";
    case "fill": return "xMidYMid slice";
    default: return "xMidYMid meet";
  }
}

/** Only bounded local raster data URLs may be interpolated into CSS. */
export function previewRasterCssImage(dataUrl: string): string | null {
  return /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)
    ? `url("${dataUrl}")` : null;
}

/**
 * Flip only a locally verified image, never the host outline or its clip.
 * An omitted flag has the Canvas default false; an unresolved flag makes the
 * entire transform unknown. SVG coordinates are in the screen's coordinate
 * space, so the reflection must be centered on the image control bounds.
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-image
 */
export function previewImageFlipTransform(
  horizontal: unknown, vertical: unknown,
  x: number, y: number, width: number, height: number,
  symbols?: Record<string, StaticPowerFxValue>
): string | null {
  const resolve = (value: unknown) => value === undefined || value === null
    ? false : staticBoolean(value, symbols);
  const flipX = resolve(horizontal);
  const flipY = resolve(vertical);
  if (flipX === null || flipY === null ||
      ![x, y, width, height].every(Number.isFinite)) return null;
  if (!flipX && !flipY) return "";
  return `translate(${flipX ? 2 * x + width : 0} ${flipY ? 2 * y + height : 0}) scale(${flipX ? -1 : 1} ${flipY ? -1 : 1})`;
}

/**
 * Canvas ImageRotation is an enum, not a free-form numeric angle. Only exact
 * source values can be rendered without evaluating runtime state.
 * Positive SVG angles rotate clockwise in the screen's downward Y axis.
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-image
 */
export function previewImageRotation(
  raw: unknown, symbols?: Record<string, StaticPowerFxValue>
): 0 | 90 | 180 | 270 | null {
  if (raw === undefined || raw === null) return 0;
  if (typeof raw !== "string") return null;
  const exact = /^=?\s*ImageRotation\.(None|Rotate90|Rotate180|Rotate270)\s*$/i.exec(raw.trim());
  if (!exact && (!/\bImageRotation\.(?:None|Rotate90|Rotate180|Rotate270)\b/i.test(raw) ||
      /["']ImageRotation\.(?:None|Rotate90|Rotate180|Rotate270)["']/i.test(raw))) return null;
  const resolved = exact?.[0] ?? staticString(raw, symbols);
  const match = typeof resolved === "string"
    ? /^=?\s*ImageRotation\.(None|Rotate90|Rotate180|Rotate270)\s*$/i.exec(resolved) : null;
  if (!match) return null;
  switch (match[1].toLowerCase()) {
    case "none": return 0;
    case "rotate90": return 90;
    case "rotate180": return 180;
    case "rotate270": return 270;
    default: return null;
  }
}

/** Rotate the bitmap around its control center, leaving its border and clip fixed. */
export function previewImageRotationTransform(
  raw: unknown, x: number, y: number, width: number, height: number,
  symbols?: Record<string, StaticPowerFxValue>
): string | null {
  const angle = previewImageRotation(raw, symbols);
  if (angle === null || ![x, y, width, height].every(Number.isFinite)) return null;
  return angle === 0 ? "" : `rotate(${angle} ${x + width / 2} ${y + height / 2})`;
}
