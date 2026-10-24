import type { CanvasControl } from "../../types/canvas";
import { lexPowerFx, significantTokens, type PowerFxToken } from "../powerfx/lexer";

function identifierName(token: PowerFxToken | undefined): string | null {
  if (token?.kind === "identifier") return token.value;
  if (token?.kind === "quotedIdentifier") {
    return token.value.slice(1, -1).replaceAll("''", "'");
  }
  return null;
}

/**
 * AllItems and AllItemsCount describe records loaded into a gallery at runtime,
 * which can differ from its Items data source. Do not infer empty/populated
 * results, permissions, or loading status from a serialized Visible formula.
 *
 * Inspect member-access tokens rather than searching raw text: quoted strings
 * and Power Fx comments mentioning AllItems are not runtime dependencies.
 * This is source analysis only; it never evaluates the formula or queries data.
 *
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-gallery
 */
export function dependsOnRuntimeGalleryItems(control: CanvasControl): boolean {
  const visible = control.properties.Visible;
  if (typeof visible !== "string") return false;
  const tokens = significantTokens(lexPowerFx(visible).tokens);
  return tokens.some((token, index) =>
    /^(?:AllItems|AllItemsCount)$/i.test(identifierName(token) ?? "") &&
    tokens[index - 1]?.value === "." &&
    identifierName(tokens[index - 2]) !== null
  );
}

/**
 * Gallery children are template definitions, not evidence of a rendered row.
 * Even if Items is omitted from .pa.yaml (which serializes only non-default
 * properties), the source does not prove that a runtime record exists.
 * A literal Table(...) formula is also not a verified loaded-row snapshot.
 * Until explicit local snapshot support exists, keep all gallery descendants
 * out of the source-only preview. This never queries data or infers access.
 *
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-gallery
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/power-apps-yaml
 */
export function galleryRecordsUnknown(control: CanvasControl): boolean {
  return control.controlType.toLowerCase().includes("gallery");
}
