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
  for (const host of items) {
    // Editor Groups are organizational only. Their serialized bounding boxes
    // do not contribute layout geometry or create independent scroll hosts.
    if (host.editorGroup) continue;
    const horizontal = previewOverflowMode(host.overflowX, host.symbols) === "scroll";
    const vertical = previewOverflowMode(host.overflowY, host.symbols) === "scroll";
    if ((!horizontal && !vertical) || host.dynamic || host.visibilityUnknown ||
        !Number.isFinite(host.width) || !Number.isFinite(host.height) ||
        host.width <= 0 || host.height <= 0) continue;
    const children = items.filter(item => {
      if (item.editorGroup) return false;
      const hostIndex = item.ancestors.indexOf(host.id);
      if (hostIndex < 0) return false;
      // A Group does not introduce a layout boundary. Count descendants
      // through editor Groups as direct content of the actual scroll host,
      // but stop at real nested containers, galleries and other controls.
      return item.ancestors.slice(hostIndex + 1).every(id =>
        byId.get(id)?.editorGroup === true
      );
    });
    if (!children.length || children.some(item =>
      item.dynamic || item.visibilityUnknown ||
      ![item.x, item.y, item.width, item.height].every(Number.isFinite)
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
    const right = Math.max(host.x + host.width,
      ...children.map(item => item.x + item.width + rightPadding));
    const bottom = Math.max(host.y + host.height,
      ...children.map(item => item.y + item.height + bottomPadding));
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
