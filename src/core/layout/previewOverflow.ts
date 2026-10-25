import { staticBoolean, staticNumber, type StaticPowerFxValue } from "../powerfx/staticEval";
import { lexPowerFx, significantTokens, type PowerFxToken } from "../powerfx/lexer";

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
  /** Canvas editor Group is not a layout/scroll box; its children stay in parent coordinates. */
  editorGroup?: boolean;
  overflowX?: unknown;
  overflowY?: unknown;
  /** Trailing auto-layout padding can extend the scrollable content bounds. */
  paddingRight?: unknown;
  paddingBottom?: unknown;
  /** Known App/Parent/Self/local-only symbols; no SQL or inferred permissions. */
  symbols?: Record<string, StaticPowerFxValue>;
}

/**
 * Resolve only literal enum members or a selected, statically verified If
 * branch. A Power Fx text value such as "LayoutOverflow.Scroll" is not an
 * enum, even if it appears in an unselected branch or a local variable.
 * https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-if
 */
export function previewOverflowMode(
  raw: unknown,
  symbols?: Record<string, StaticPowerFxValue>,
  depth = 0
): PreviewOverflowMode {
  if (raw === undefined || raw === null) return "hide";
  if (typeof raw !== "string" || depth > 6) return "unknown";
  const source = raw.trim();
  // The serialized Power Fx expression may contain comments or whitespace
  // around the enum member. Tokenize instead of matching the raw source, so
  // valid trivia is accepted but text strings, operators and malformed
  // members can never authorize scrolling.
  const lexed = lexPowerFx(source);
  if (lexed.diagnostics.length) return "unknown";
  const tokens = significantTokens(lexed.tokens);
  if (tokens[0]?.value === "=") tokens.shift();
  if (tokens.length === 3 &&
      tokens[0].kind === "identifier" &&
      tokens[0].value.toLowerCase() === "layoutoverflow" &&
      tokens[1].value === "." &&
      tokens[2].kind === "identifier") {
    const member = tokens[2].value.toLowerCase();
    if (member === "scroll" || member === "hide") return member;
  }
  if (tokens[0]?.value.toLowerCase() !== "if" ||
      tokens[1]?.value !== "(" || tokens[tokens.length - 1]?.value !== ")") {
    return "unknown";
  }

  // Split the outer If arguments only; nested If expressions retain their
  // original token spans and are resolved recursively if selected.
  const inner = tokens.slice(2, -1);
  const args: PowerFxToken[][] = [];
  let nesting = 0;
  let start = 0;
  for (let index = 0; index < inner.length; index += 1) {
    if (inner[index].value === "(") nesting += 1;
    else if (inner[index].value === ")") nesting -= 1;
    else if (inner[index].value === "," && nesting === 0) {
      if (index === start) return "unknown";
      args.push(inner.slice(start, index));
      start = index + 1;
    }
    if (nesting < 0) return "unknown";
  }
  if (nesting !== 0 || start >= inner.length) return "unknown";
  args.push(inner.slice(start));
  if (args.length < 2) return "unknown";

  const expression = (part: PowerFxToken[]): string =>
    "=" + source.slice(part[0].start, part[part.length - 1].end);
  for (let index = 0; index + 1 < args.length; index += 2) {
    const condition = staticBoolean(expression(args[index]), symbols);
    if (condition === null) return "unknown";
    if (condition) {
      return previewOverflowMode(expression(args[index + 1]), symbols, depth + 1);
    }
  }
  return args.length % 2 === 1
    ? previewOverflowMode(expression(args[args.length - 1]), symbols, depth + 1)
    : "unknown";
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
  const byId = new Map(items.map(item => [item.id, item]));
  // Index each visible non-Group node under its nearest real ancestor once.
  // A Canvas editor Group is organizational: its children belong to the
  // surrounding container. Do not flatten through a real nested control.
  // Repeatedly filtering all items per scroll host was quadratic for screens
  // with many nested containers, even when each host had only one child.
  const childrenByHost = new Map<string, PreviewScrollItem[]>();
  for (const item of items) {
    if (item.editorGroup) continue;
    for (let index = item.ancestors.length - 1; index >= 0; index -= 1) {
      const ancestorId = item.ancestors[index];
      const ancestor = byId.get(ancestorId);
      if (!ancestor) break;
      if (ancestor.editorGroup) continue;
      const children = childrenByHost.get(ancestorId) ?? [];
      children.push(item);
      childrenByHost.set(ancestorId, children);
      break;
    }
  }
  for (const host of items) {
    // Editor Groups are organizational only. Their serialized bounding boxes
    // do not contribute layout geometry or create independent scroll hosts.
    if (host.editorGroup) continue;
    const horizontal = previewOverflowMode(host.overflowX, host.symbols) === "scroll";
    const vertical = previewOverflowMode(host.overflowY, host.symbols) === "scroll";
    if ((!horizontal && !vertical) || host.dynamic || host.visibilityUnknown ||
        ![host.x, host.y, host.width, host.height].every(Number.isFinite) ||
        host.width <= 0 || host.height <= 0) continue;
    const children = childrenByHost.get(host.id) ?? [];
    if (!children.length || children.some(item =>
      item.dynamic || item.visibilityUnknown ||
      ![item.x, item.y, item.width, item.height].every(Number.isFinite) ||
      item.width < 0 || item.height < 0
    )) continue;
    // Canvas auto-layout includes trailing padding in the content extent.
    // A runtime-dependent padding value cannot establish a safe scroll range.
    // Only evaluate the padding for axes that are explicitly scrollable.
    const rightPadding = horizontal
      ? host.paddingRight === undefined ? 0 : staticNumber(host.paddingRight, host.symbols)
      : 0;
    const bottomPadding = vertical
      ? host.paddingBottom === undefined ? 0 : staticNumber(host.paddingBottom, host.symbols)
      : 0;
    if (rightPadding === null || bottomPadding === null ||
        !Number.isFinite(rightPadding) || !Number.isFinite(bottomPadding) ||
        rightPadding < 0 || bottomPadding < 0) continue;
    // Avoid spreading child extents into Math.max: large imported screens can
    // exceed the JavaScript argument limit even with valid, finite geometry.
    // Compute only explicitly scrollable axes. Overflow on a hidden axis must
    // not suppress a separately verified scroll range on the other axis.
    const hostRight = host.x + host.width;
    const hostBottom = host.y + host.height;
    let right = horizontal ? hostRight : 0;
    let bottom = vertical ? hostBottom : 0;
    let valid = (!horizontal || Number.isFinite(hostRight)) &&
      (!vertical || Number.isFinite(hostBottom));
    for (const child of children) {
      if (horizontal) {
        const edge = child.x + child.width + rightPadding;
        if (!Number.isFinite(edge)) { valid = false; break; }
        right = Math.max(right, edge);
      }
      if (vertical) {
        const edge = child.y + child.height + bottomPadding;
        if (!Number.isFinite(edge)) { valid = false; break; }
        bottom = Math.max(bottom, edge);
      }
    }
    if (!valid) continue;
    const x = horizontal ? Math.max(0, right - hostRight) : 0;
    const y = vertical ? Math.max(0, bottom - hostBottom) : 0;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x > 0 || y > 0) ranges[host.id] = { x, y };
  }
  return ranges;
}

/**
 * Keep each local scrollbar in its source host's stacking context: after the
 * last visible descendant of that host, but before a later sibling. Index
 * ancestry in a single pass instead of reversing/scanning every item per host.
 * This is only paint ordering; no runtime records or permissions are inferred.
 *
 * .pa.yaml source order determines control ZIndex:
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/power-apps-yaml
 */
export function previewScrollOverlayAnchors(
  items: readonly Pick<PreviewScrollItem, "id" | "ancestors">[],
  scrollHostIds: ReadonlySet<string>
): Map<string, string[]> {
  const lastVisibleByHost = new Map<string, string>();
  for (const item of items) {
    if (scrollHostIds.has(item.id)) lastVisibleByHost.set(item.id, item.id);
    for (const ancestorId of item.ancestors) {
      if (scrollHostIds.has(ancestorId)) lastVisibleByHost.set(ancestorId, item.id);
    }
  }
  // Preserve the original host order when multiple nested scrollbars anchor
  // to the same last descendant. Do not let a later unrelated sibling move
  // an earlier host's scrollbar above that sibling.
  const overlays = new Map<string, string[]>();
  for (const item of items) {
    if (!scrollHostIds.has(item.id)) continue;
    const anchorId = lastVisibleByHost.get(item.id);
    if (!anchorId) continue;
    const hosts = overlays.get(anchorId) ?? [];
    hosts.push(item.id);
    overlays.set(anchorId, hosts);
  }
  return overlays;
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
  // Reject non-finite input deltas, but preserve finite deltas whose sum
  // overflows to +/-Infinity. Those represent movement toward a boundary,
  // not a reason to reset the scroll offset to zero.
  const dx = Number.isFinite(deltaX) ? deltaX : 0;
  const dy = Number.isFinite(deltaY) ? deltaY : 0;
  const horizontalWheel = range.x > 0 && range.y === 0 ? dx + dy : dx;
  // Saturate before previewClampScroll: that helper intentionally treats
  // non-finite *stored offsets* as invalid, whereas a finite wheel movement
  // can legitimately overflow during addition.
  return previewClampScroll({
    x: Math.min(range.x, Math.max(0, current.x + horizontalWheel)),
    y: Math.min(range.y, Math.max(0, current.y + dy))
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
