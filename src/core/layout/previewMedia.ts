import type { PreviewMediaAsset } from "../../types/canvas";
import { literalText } from "./layout";

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

/** Power Apps image fit modes mapped to SVG preserveAspectRatio. */
export function previewImageFit(raw: unknown): string {
  if (typeof raw !== "string") return "xMidYMid meet";
  const match = /^=?\s*ImagePosition\.(Fit|Fill|Stretch|Center)\s*$/i.exec(raw.trim());
  switch (match?.[1]?.toLowerCase()) {
    case "stretch": return "none";
    case "fill": return "xMidYMid slice";
    default: return "xMidYMid meet";
  }
}
