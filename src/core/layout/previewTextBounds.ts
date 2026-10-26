/**
 * Bound only the amount of verified text painted in a source-only preview.
 * Canvas source text is not shortened: this is a renderer safety limit.
 *
 * Iterate Unicode code points so the last displayed glyph never contains
 * half of a UTF-16 surrogate pair. Stop at the first omitted code point,
 * rather than walking an unbounded imported string.
 */
export function previewBoundedText(
  value: string | null | undefined,
  maxCodePoints = 4096
): { text: string | undefined; truncated: boolean } {
  if (value == null) return { text: undefined, truncated: false };
  const limit = Number.isSafeInteger(maxCodePoints) && maxCodePoints >= 0
    ? maxCodePoints : 4096;
  let text = "";
  let count = 0;
  for (const character of value) {
    if (count >= limit) return { text, truncated: true };
    text += character;
    count++;
  }
  return { text, truncated: false };
}
