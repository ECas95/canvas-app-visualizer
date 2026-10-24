/**
 * Source-only scroll geometry for Canvas auto-layout containers.
 *
 * Microsoft Canvas serializes Horizontal/Vertical Overflow as LayoutOverflow
 * enums. Only explicit Scroll is interactive here; unresolved Power Fx never
 * grants scrolling or implies that runtime data has been loaded.
 *
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-vertical-container
 * https://github.com/microsoft/PowerApps-Tooling/tree/master/schemas/pa-yaml/v3.0
 */
export type PreviewOverflowMode = "scroll" | "hide" | "unknown";
export interface PreviewScrollOffset { x: number; y: number }
export interface PreviewScrollRange { x: number; y: number }

export interface PreviewScrollItem {
  id: string;
  ancestors: readonly string[];
  x: number;
  y: number;
  width: number;
  height: number;
  dynamic: boolean;
  visibilityUnknown: boolean;
  overflowX?: unknown;
  overflowY?: unknown;
}

export function previewOverflowMode(raw: unknown): PreviewOverflowMode {
  if (raw === undefined || raw === null) return "hide";
  if (typeof raw !== "string") return "unknown";
  const match = /^=?\s*LayoutOverflow\.(Scroll|Hide)\s*$/i.exec(raw.trim());
  return match ? match[1].toLowerCase() as "scroll" | "hide" : "unknown";
}

/**
 * Compute conservative scroll ranges from immediate children only.
 * Unknown child geometry disables the host's scroll simulation rather than
 * fabricating a scrollable content size. No gallery rows are synthesized.
 */
export function previewScrollRanges(
  items: readonly PreviewScrollItem[]
): Record<string, PreviewScrollRange> {
  const ranges: Record<string, PreviewScrollRange> = Object.create(null);
  for (const host of items) {
    const horizontal = previewOverflowMode(host.overflowX) === "scroll";
    const vertical = previewOverflowMode(host.overflowY) === "scroll";
    if ((!horizontal && !vertical) || host.dynamic || host.visibilityUnknown ||
        !Number.isFinite(host.width) || !Number.isFinite(host.height) ||
        host.width <= 0 || host.height <= 0) continue;
    const children = items.filter(item => item.ancestors.at(-1) === host.id);
    if (!children.length || children.some(item =>
      item.dynamic || item.visibilityUnknown ||
      ![item.x, item.y, item.width, item.height].every(Number.isFinite)
    )) continue;
    const right = Math.max(host.x + host.width,
      ...children.map(item => item.x + item.width));
    const bottom = Math.max(host.y + host.height,
      ...children.map(item => item.y + item.height));
    const x = horizontal ? Math.max(0, right - host.x - host.width) : 0;
    const y = vertical ? Math.max(0, bottom - host.y - host.height) : 0;
    if (x > 0 || y > 0) ranges[host.id] = { x, y };
  }
  return ranges;
}

export function previewClampScroll(
  offset: PreviewScrollOffset | undefined,
  range: PreviewScrollRange
): PreviewScrollOffset {
  const x = Number.isFinite(offset?.x) ? offset!.x : 0;
  const y = Number.isFinite(offset?.y) ? offset!.y : 0;
  return {
    x: Math.min(Math.max(0, x), range.x),
    y: Math.min(Math.max(0, y), range.y)
  };
}

/** Scroll only axes proven scrollable. Vertical wheel scrolls horizontal-only hosts. */
export function previewWheelScroll(
  offset: PreviewScrollOffset | undefined,
  range: PreviewScrollRange,
  deltaX: number,
  deltaY: number
): PreviewScrollOffset {
  const current = previewClampScroll(offset, range);
  const horizontalWheel = range.x > 0 && range.y === 0 ? deltaX + deltaY : deltaX;
  return previewClampScroll({
    x: current.x + (Number.isFinite(horizontalWheel) ? horizontalWheel : 0),
    y: current.y + (Number.isFinite(deltaY) ? deltaY : 0)
  }, range);
}

/** A scrolled host stays fixed; only its descendants move within its clip. */
export function previewScrolledPosition(
  item: Pick<PreviewScrollItem, "x" | "y" | "ancestors">,
  offsets: Readonly<Record<string, PreviewScrollOffset>>
): { x: number; y: number } {
  let x = item.x;
  let y = item.y;
  for (const ancestor of item.ancestors) {
    x -= offsets[ancestor]?.x ?? 0;
    y -= offsets[ancestor]?.y ?? 0;
  }
  return { x, y };
}
