/**
 * Bound only the amount of verified text painted in a source-only preview.
 * Canvas source text is not shortened: this is a renderer safety limit.
 *
 * Keep the existing Unicode code-point budget, but never cut through a
 * grapheme cluster when Intl.Segmenter is available (combining marks, flags,
 * emoji skin tones and ZWJ sequences are single visible characters).
 * Segment lazily and stop at the first omitted cluster; do not allocate an
 * unbounded array for an imported Canvas string. Older browsers fall back
 * to the original code-point-safe behavior.
 */
export function previewBoundedText(
  value: string | null | undefined,
  maxCodePoints = 4096
): { text: string | undefined; truncated: boolean } {
  if (value == null) return { text: undefined, truncated: false };
  const limit = Number.isSafeInteger(maxCodePoints) && maxCodePoints >= 0
    ? maxCodePoints : 4096;
  const segmenter = typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
  const segments = segmenter ? segmenter.segment(value) : value;
  let text = "";
  let count = 0;
  for (const entry of segments) {
    const cluster = typeof entry === "string" ? entry : entry.segment;
    let codePoints = 0;
    for (const _ of cluster) {
      codePoints++;
      // Omit the entire cluster when it would exceed the paint budget.
      if (count + codePoints > limit) return { text, truncated: true };
    }
    text += cluster;
    count += codePoints;
  }
  return { text, truncated: false };
}
