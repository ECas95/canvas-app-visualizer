import type { PreviewMediaAsset } from "../../types/canvas";
import { literalText } from "./layout";
import { evaluateStaticPowerFx, staticBoolean, type StaticPowerFxValue } from "../powerfx/staticEval";
import { lexPowerFx, significantTokens, type PowerFxToken } from "../powerfx/lexer";

// Defense in depth: even if an asset did not come from the bounded .msapp
// importer, never place an external URL into SVG href or CSS background-image.
// Only the locally supported raster formats may be rendered.
const LOCAL_RASTER_DATA_URL = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function isLocalRasterDataUrl(value: unknown): value is string {
  return typeof value === "string" && LOCAL_RASTER_DATA_URL.test(value);
}

/**
 * Resolve only exact, locally imported raster media names. Never fetch remote
 * URLs or evaluate connector-backed Image formulas. Power Fx comments are
 * trivia, so a verified Media . Logo reference remains a valid local asset.
 *
 * https://learn.microsoft.com/en-us/power-platform/power-fx/expression-grammar
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/power-apps-yaml
 */
type SourceMediaCandidate = {
  name: string;
  origin: "identifier" | "media" | "literal" | "blank";
};

/**
 * Select a source branch only when Power Fx If/Switch conditions are known.
 * An empty string means a verified Blank result (no matching branch/default).
 * Null means an unsupported or runtime-dependent expression. Switch limits
 * its selector to numeric/Boolean scalars: text/enum equality requires Power
 * Fx binding and locale semantics that the source-only preview cannot prove.
 * https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-if
 */
function selectVerifiedImageBranch(
  source: string, tokens: PowerFxToken[],
  symbols?: Record<string, StaticPowerFxValue>
): string | null {
  if (tokens[0]?.kind !== "identifier") return null;
  const functionName = tokens[0].value.toLowerCase();
  if ((functionName !== "if" && functionName !== "switch") ||
      tokens[1]?.value !== "(" || tokens[tokens.length - 1]?.value !== ")") return null;

  const inner = tokens.slice(2, -1);
  const args: PowerFxToken[][] = [];
  let nesting = 0;
  let begin = 0;
  for (let index = 0; index < inner.length; index += 1) {
    if (inner[index].value === "(") nesting += 1;
    else if (inner[index].value === ")") nesting -= 1;
    else if (inner[index].value === "," && nesting === 0) {
      if (index === begin) return null;
      args.push(inner.slice(begin, index));
      begin = index + 1;
    }
    if (nesting < 0) return null;
  }
  if (nesting !== 0 || begin >= inner.length) return null;
  args.push(inner.slice(begin));
  if (args.length < (functionName === "switch" ? 3 : 2)) return null;

  const expression = (part: PowerFxToken[]) =>
    "=" + source.slice(part[0].start, part[part.length - 1].end);

  if (functionName === "switch") {
    const selector = evaluateStaticPowerFx(expression(args[0]), { symbols });
    if (selector === null || (typeof selector !== "number" &&
        typeof selector !== "boolean")) return null;
    for (let index = 1; index + 1 < args.length; index += 2) {
      const match = evaluateStaticPowerFx(expression(args[index]), { symbols });
      // A preceding unknown match could win; never skip it to a later case.
      if (match === null || typeof match !== typeof selector) return null;
      if (match === selector) return expression(args[index + 1]);
    }
    return args.length % 2 === 0 ? expression(args[args.length - 1]) : "";
  }

  for (let index = 0; index + 1 < args.length; index += 2) {
    const condition = staticBoolean(expression(args[index]), symbols);
    if (condition === null) return null;
    if (condition) return expression(args[index + 1]);
  }
  return args.length % 2 === 1 ? expression(args[args.length - 1]) : "";
}

function sourceMediaName(
  raw: string,
  symbols?: Record<string, StaticPowerFxValue>,
  depth = 0
): SourceMediaCandidate | null {
  if (depth > 6) return null;
  const source = raw.trim();
  const lexed = lexPowerFx(source);
  if (lexed.diagnostics.length) return null;
  const tokens = significantTokens(lexed.tokens);
  if (tokens[0]?.value === "=") tokens.shift();

  if (tokens.length === 1) {
    if (tokens[0].kind === "identifier") {
      return { name: tokens[0].value, origin: "identifier" };
    }
    if (tokens[0].kind === "string") {
      return { name: tokens[0].value.slice(1, -1).replaceAll('""', '"'), origin: "literal" };
    }
  }
  // Power Fx allows single-quoted identifiers for media names containing
  // whitespace or apostrophes (escaped as two single quotes). This remains
  // a source-only lookup against already imported, local raster assets.
  if (tokens.length === 3 && tokens[0].kind === "identifier" &&
      tokens[0].value.toLowerCase() === "media" && tokens[1].value === "." &&
      (tokens[2].kind === "identifier" || tokens[2].kind === "quotedIdentifier")) {
    const name = tokens[2].kind === "quotedIdentifier"
      ? tokens[2].value.slice(1, -1).replaceAll("''", "'")
      : tokens[2].value;
    return { name, origin: "media" };
  }

  // A known Blank() is an intentional empty image, not an unavailable
  // resource or an unknown SQL-backed value. The empty sentinel is never
  // eligible for asset lookup. https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-isblank-isempty
  if (tokens.length === 3 && tokens[0].kind === "identifier" &&
      tokens[0].value.toLowerCase() === "blank" &&
      tokens[1].value === "(" && tokens[2].value === ")") return { name: "", origin: "blank" };

  const selected = selectVerifiedImageBranch(source, tokens, symbols);
  if (selected === null) return null;
  return selected === ""
    ? { name: "", origin: "blank" }
    : sourceMediaName(selected, symbols, depth + 1);
}

export function resolvePreviewImage(
  raw: unknown,
  mediaAssets: PreviewMediaAsset[],
  symbols?: Record<string, StaticPowerFxValue>
): PreviewMediaAsset | undefined {
  if (typeof raw !== "string") return undefined;
  const candidate = sourceMediaName(raw, symbols)?.name ?? literalText(raw);
  if (!candidate || /[\\/:?#]/.test(candidate)) return undefined;
  const name = candidate.replace(/\.(png|jpe?g|gif|webp)$/i, "").toLowerCase();
  return mediaAssets.find(asset => asset.name === name && isLocalRasterDataUrl(asset.dataUrl));
}

/**
 * Distinguish a missing local media resource from an Image formula whose
 * result cannot be known without Power Apps runtime data (e.g. ThisItem,
 * a connector, or a security variable). Neither state authorizes an image
 * request or implies that a record or permission exists.
 *
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-image
 */
export function previewImageSourceState(
  raw: unknown,
  mediaAssets: PreviewMediaAsset[],
  symbols?: Record<string, StaticPowerFxValue>
): "verified" | "runtime-unknown" | "source-unavailable" | "source-blank" {
  if (resolvePreviewImage(raw, mediaAssets, symbols)) return "verified";
  if (typeof raw !== "string") return "source-unavailable";

  const lexed = lexPowerFx(raw.trim());
  if (lexed.diagnostics.length) return "source-unavailable";
  const tokens = significantTokens(lexed.tokens);
  if (tokens[0]?.value === "=") tokens.shift();

  const candidate = sourceMediaName(raw, symbols);
  // Unlike a missing media asset, a provable Blank() or empty text value
  // should leave the image control visually empty (no broken-image glyph).
  if (candidate?.name === "") return "source-blank";
  if (candidate !== null || literalText(raw) !== null) {
    // The selected If branch may itself be a bare variable. Preserve its
    // origin through recursion: a missing variable is not a missing media
    // resource, even when the condition selecting it is statically known.
    if (candidate?.origin === "identifier" &&
        !mediaAssets.some(asset => asset.name === candidate.name.toLowerCase())) {
      return "runtime-unknown";
    }
    return "source-unavailable";
  }
  if (!tokens.length || (tokens.length === 3 &&
      tokens[0].kind === "identifier" && tokens[0].value.toLowerCase() === "blank" &&
      tokens[1].value === "(" && tokens[2].value === ")")) {
    return "source-unavailable";
  }
  // Unknown formulas are not necessarily errors or empty images. Do not
  // evaluate them, select a branch, or issue network requests.
  return "runtime-unknown";
}

/**
 * Source-only ImagePosition enum. Center and Tile must retain raster pixel
 * dimensions; SVG preserveAspectRatio scales and cannot express either mode.
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/properties-visual
 */
export type PreviewImagePosition = "fit" | "fill" | "stretch" | "center" | "tile";

/**
 * Resolve only a genuine Power Fx enum member, or the selected result of a
 * statically verified If. Never coerce text (including local text variables)
 * into an enum merely because it spells "ImagePosition.Fit" or similar.
 * Comments and whitespace around the member are valid Power Fx trivia.
 *
 * https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-if
 */
function sourceImageEnum(
  raw: unknown,
  namespace: "ImagePosition" | "ImageRotation",
  members: readonly string[],
  symbols?: Record<string, StaticPowerFxValue>,
  depth = 0
): string | null {
  if (typeof raw !== "string" || depth > 6) return null;
  const source = raw.trim();
  const lexed = lexPowerFx(source);
  if (lexed.diagnostics.length) return null;
  const tokens = significantTokens(lexed.tokens);
  if (tokens[0]?.value === "=") tokens.shift();
  if (tokens.length === 3 &&
      tokens[0].kind === "identifier" &&
      tokens[0].value.toLowerCase() === namespace.toLowerCase() &&
      tokens[1].value === "." &&
      tokens[2].kind === "identifier") {
    const member = tokens[2].value.toLowerCase();
    return members.includes(member) ? member : null;
  }
  const selected = selectVerifiedImageBranch(source, tokens, symbols);
  return selected ? sourceImageEnum(selected, namespace, members, symbols, depth + 1) : null;
}

export function previewImagePosition(
  raw: unknown, symbols?: Record<string, StaticPowerFxValue>
): PreviewImagePosition | null {
  return sourceImageEnum(raw, "ImagePosition",
    ["fit", "fill", "stretch", "center", "tile"], symbols) as PreviewImagePosition | null;
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
  return isLocalRasterDataUrl(dataUrl) ? `url("${dataUrl}")` : null;
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
  const member = sourceImageEnum(raw, "ImageRotation",
    ["none", "rotate90", "rotate180", "rotate270"], symbols);
  switch (member) {
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
