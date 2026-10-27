/**
 * Source-only SVG line window for Canvas labels with Wrap=false.
 *
 * SVG text does not wrap, but explicit source newlines still produce lines.
 * A small clipped label with VerticalAlign.Bottom must show the *last*
 * source lines, not the first lines incorrectly re-anchored to the bottom.
 * For Middle, retain the centered lines. Top retains the first lines.
 *
 * This selects existing lines only; it never evaluates runtime Power Fx,
 * invents SQL records, or claims browser-perfect font metrics.
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/properties-text
 */
export type PreviewSvgVerticalAlign = "top" | "middle" | "bottom" | null;

export interface PreviewSvgTextWindow {
  lines: string[];
  firstIndex: number;
  totalLines: number;
}

export function previewSvgTextWindow(
  value: string,
  height: number,
  lineHeight: number,
  align: PreviewSvgVerticalAlign
): PreviewSvgTextWindow {
  // Canvas text can contain LF, CRLF or a standalone CR (for example from\n  // Char(13)). SVG tspans need one line per source line break; leaving a\n  // bare CR inside a tspan changes the layout and bottom/middle selection.\n  const allLines = value.split(/\r\n|\r|\n/);
  const safeHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
  const safeLineHeight = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 1;
  // Retain the existing SVG budget and two extra lines for partially clipped
  // glyphs. Bound pathological source text to 128 DOM spans per control.
  const budget = Math.max(5, Math.min(128, Math.ceil(safeHeight / safeLineHeight) + 2));
  const count = Math.min(allLines.length, budget);
  const remaining = allLines.length - count;
  const firstIndex = align === "top" ? 0 :
    align === "bottom" ? remaining : Math.floor(remaining / 2);
  return {
    lines: allLines.slice(firstIndex, firstIndex + count),
    firstIndex,
    totalLines: allLines.length
  };
}
