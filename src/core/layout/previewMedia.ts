import type { PreviewMediaAsset } from "../../types/canvas";
import { literalText } from "./layout";
import { staticBoolean, type StaticPowerFxValue } from "../powerfx/staticEval";

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

export function previewImagePosition(raw: unknown): PreviewImagePosition | null {
  if (typeof raw !== "string") return null;
  const match = /^=?\s*ImagePosition\.(Fit|Fill|Stretch|Center|Tile)\s*$/i.exec(raw.trim());
  return match ? match[1].toLowerCase() as PreviewImagePosition : null;
}

/** Map scalable ImagePosition modes to SVG preserveAspectRatio. */
export function previewImageFit(raw: unknown): string {
  switch (previewImagePosition(raw)) {
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
