import type { CanvasControl } from "../../types/canvas";
import { previewLayoutEnum } from "./previewLayoutEnums";
import {
  staticBoolean,
  staticNumber,
  staticString,
  type StaticPowerFxValue
} from "../powerfx/staticEval";

export interface VisualRect {
  x: number;
  y: number;
  width: number;
  height: number;
  dynamic: boolean;
}

export interface LayoutContext {
  parentWidth: number;
  parentHeight: number;
  appWidth: number;
  appHeight: number;
  templateWidth?: number;
  templateHeight?: number;
  symbols?: Record<string, StaticPowerFxValue>;
}

export interface PositionedControl {
  control: CanvasControl;
  rect: VisualRect;
}

const DEFAULTS: Record<string, { width: number; height: number }> = {
  button: { width: 160, height: 44 },
  label: { width: 220, height: 40 },
  text: { width: 220, height: 40 },
  textinput: { width: 240, height: 44 },
  dropdown: { width: 220, height: 44 },
  combobox: { width: 240, height: 44 },
  gallery: { width: 420, height: 300 },
  form: { width: 520, height: 420 },
  image: { width: 120, height: 100 },
  icon: { width: 44, height: 44 },
  rectangle: { width: 120, height: 80 },
  container: { width: 600, height: 320 },
  group: { width: 600, height: 320 }
};

function layoutSymbols(
  context?: LayoutContext,
  selfWidth?: number,
  selfHeight?: number
): Record<string, StaticPowerFxValue> | undefined {
  if (!context) return undefined;

  const symbols: Record<string, StaticPowerFxValue> = {
    ...(context.symbols ?? {}),
    "Parent.Width": context.parentWidth,
    "Parent.Height": context.parentHeight,
    "App.Width": context.appWidth,
    "App.Height": context.appHeight
  };

  if (context.templateWidth !== undefined) {
    symbols["Parent.TemplateWidth"] = context.templateWidth;
  }
  if (context.templateHeight !== undefined) {
    symbols["Parent.TemplateHeight"] = context.templateHeight;
  }
  if (selfWidth !== undefined) symbols["Self.Width"] = selfWidth;
  if (selfHeight !== undefined) symbols["Self.Height"] = selfHeight;

  return symbols;
}

export function literalNumber(value: unknown): number | null {
  return staticNumber(value);
}

export function literalText(value: unknown): string | null {
  return staticString(value);
}

/**
 * Resolve only literal Power Fx RGBA colors. Microsoft accepts numeric alpha
 * from 0 to 1 or percentage alpha from 0% to 100%; channels are 0..255.
 * Invalid inputs remain unknown instead of relying on browser CSS clamping.
 * https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-colors
 */
export function rgba(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const number = String.raw`(?:\d+(?:\.\d*)?|\.\d+)`;
  const pattern = new RegExp(
    String.raw`^=?\s*RGBA\(\s*(${number})\s*,\s*(${number})\s*,\s*(${number})\s*,\s*(${number})(%)?\s*\)\s*$`,
    "i"
  );
  const match = pattern.exec(value.trim());
  if (!match) return null;
  const channels = match.slice(1, 4).map(Number);
  const alpha = Number(match[4]) / (match[5] ? 100 : 1);
  if (channels.some(channel => !Number.isFinite(channel) || channel < 0 || channel > 255) ||
      !Number.isFinite(alpha) || alpha < 0 || alpha > 1) return null;
  return `rgba(${channels.join(',')},${alpha})`;
}

// More specific control families must win over substrings such as "text":
// Classic/TextInput and ModernTextInput must not inherit Text label geometry.
// These are preview fallbacks only when Width/Height cannot be resolved.
const DEFAULT_SIZE_KEYS = Object.keys(DEFAULTS).sort((a, b) => b.length - a.length);

export function defaultControlSize(
  type: string
): { width: number; height: number } {
  const lower = type.toLowerCase();
  const key = DEFAULT_SIZE_KEYS.find(candidate => lower.includes(candidate));
  return key ? DEFAULTS[key] : { width: 180, height: 56 };
}

/**
 * Canvas Label, HTML text and ModernText can grow their rendered Height when
 * AutoHeight is enabled. The resulting height depends on browser font metrics,
 * wrapping and potentially runtime Text; a serialized Height is only a preview
 * fallback, not proof of the output Height. Unresolved AutoHeight is equally
 * unverified. Do not apply this rule to TextInput/Button or other controls.
 *
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-text-box
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/modern-controls/modern-control-text
 */
function hasUnverifiedAutoHeight(
  control: CanvasControl,
  symbols?: Record<string, StaticPowerFxValue>
): boolean {
  const type = control.controlType.toLowerCase();
  const textControl = /(?:^|\/)(?:label|htmltext)(?:@|$)/.test(type) ||
    /^moderntext(?:@|$)/.test(type);
  if (!textControl || control.properties.AutoHeight === undefined) return false;
  return staticBoolean(control.properties.AutoHeight, symbols) !== false;
}

function resolvedNumber(
  value: unknown,
  symbols: Record<string, StaticPowerFxValue> | undefined
): number | null {
  return staticNumber(value, symbols);
}

function clamp(
  value: number,
  min: number | null,
  max: number | null
): number {
  let result = value;
  if (min !== null) result = Math.max(result, min);
  if (max !== null) result = Math.min(result, max);
  return Math.max(0, result);
}

export function buildSiblingGeometrySymbols(
  controls: CanvasControl[],
  context: LayoutContext
): Record<string, StaticPowerFxValue> {
  const resolved: Record<string, StaticPowerFxValue> = {
    ...(context.symbols ?? {})
  };

  const maxPasses = Math.max(2, controls.length * 4);

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;

    for (const control of controls) {
      const baseContext: LayoutContext = {
        ...context,
        symbols: resolved
      };
      const baseSymbols = layoutSymbols(baseContext) ?? {};

      const width = staticNumber(control.properties.Width, baseSymbols);
      const height = staticNumber(control.properties.Height, baseSymbols);
      const autoHeightUnverified = hasUnverifiedAutoHeight(control, baseSymbols);
      const setNumber = (key: string, value: number | null): void => {
        if (value === null || resolved[key] === value) return;
        resolved[key] = value;
        changed = true;
      };

      // Power Apps formulas may derive Height from Self.Y, while Self.Y
      // depends on a preceding sibling (for example gallery below toolbar).
      // Resolve positions with any known sizes, then retry dimensions using
      // the resolved Self.X/Y. The outer passes resolve sibling dependencies.
      const firstSymbols: Record<string, StaticPowerFxValue> = {
        ...baseSymbols,
        ...(width !== null ? { "Self.Width": width } : {}),
        ...(height !== null && !autoHeightUnverified ? { "Self.Height": height } : {})
      };
      const earlyX = control.properties.X === undefined
        ? 0 : staticNumber(control.properties.X, firstSymbols);
      const earlyY = control.properties.Y === undefined
        ? 0 : staticNumber(control.properties.Y, firstSymbols);
      const positionedSymbols: Record<string, StaticPowerFxValue> = {
        ...firstSymbols,
        ...(earlyX !== null ? { "Self.X": earlyX } : {}),
        ...(earlyY !== null ? { "Self.Y": earlyY } : {})
      };
      const finalWidth = staticNumber(control.properties.Width, positionedSymbols) ?? width;
      const finalHeight = staticNumber(control.properties.Height, positionedSymbols) ?? height;
      const finalSymbols: Record<string, StaticPowerFxValue> = {
        ...positionedSymbols,
        ...(finalWidth !== null ? { "Self.Width": finalWidth } : {}),
        ...(finalHeight !== null && !autoHeightUnverified
          ? { "Self.Height": finalHeight } : {})
      };
      setNumber(control.name + ".Width", finalWidth);
      // AutoHeight is an output measurement. Never certify its source Height
      // for sibling formulas, even when a numeric Height was serialized.
      setNumber(control.name + ".Height", autoHeightUnverified ? null : finalHeight);
      setNumber(
        control.name + ".X",
        control.properties.X === undefined ? 0 : staticNumber(control.properties.X, finalSymbols)
      );
      setNumber(
        control.name + ".Y",
        control.properties.Y === undefined ? 0 : staticNumber(control.properties.Y, finalSymbols)
      );
    }

    if (!changed) break;
  }

  return resolved;
}

export function controlRect(
  control: CanvasControl,
  index: number,
  context?: LayoutContext
): VisualRect {
  const defaults = defaultControlSize(control.controlType);
  const baseSymbols = layoutSymbols(context);

  const width = resolvedNumber(control.properties.Width, baseSymbols);
  const height = resolvedNumber(control.properties.Height, baseSymbols);
  const autoHeightUnverified = hasUnverifiedAutoHeight(control, baseSymbols);

  // Zero is a valid resolved Canvas dimension; do not invent an 8px control.
  // Keep fallback defaults only for dimensions that are genuinely unresolved.
  const finalWidth = Math.max(0, width ?? defaults.width);
  const finalHeight = Math.max(0, height ?? defaults.height);

  const selfSymbols = layoutSymbols(
    context,
    finalWidth,
    autoHeightUnverified ? undefined : finalHeight
  );

  const initialX = resolvedNumber(control.properties.X, selfSymbols);
  const initialY = resolvedNumber(control.properties.Y, selfSymbols);

  // Canvas supports formulas such as Height = App.Height - Self.Y - 20.
  // Resolve the known position before making a second, side-effect-free size pass.
  const positionedSymbols = {
    ...(selfSymbols ?? {}),
    ...(initialX !== null ? { "Self.X": initialX } : {}),
    ...(initialY !== null ? { "Self.Y": initialY } : {})
  };
  const resolvedWidth = resolvedNumber(control.properties.Width, positionedSymbols) ?? width;
  const resolvedHeight = resolvedNumber(control.properties.Height, positionedSymbols) ?? height;
  const effectiveWidth = Math.max(0, resolvedWidth ?? defaults.width);
  const effectiveHeight = Math.max(0, resolvedHeight ?? defaults.height);
  const finalSymbols = {
    ...(layoutSymbols(context, effectiveWidth,
      autoHeightUnverified ? undefined : effectiveHeight) ?? {}),
    ...positionedSymbols,
    "Self.Width": effectiveWidth,
    ...(!autoHeightUnverified ? { "Self.Height": effectiveHeight } : {})
  };
  const x = resolvedNumber(control.properties.X, finalSymbols) ?? initialX;
  const y = resolvedNumber(control.properties.Y, finalSymbols) ?? initialY;

  return {
    x: x ?? (control.properties.X === undefined ? 0 : 24 + (index % 4) * 190),
    y: y ?? (control.properties.Y === undefined ? 0 : 24 + Math.floor(index / 4) * 72),
    width: effectiveWidth,
    height: effectiveHeight,
    dynamic:
      autoHeightUnverified ||
      (control.properties.X !== undefined && x === null) ||
      (control.properties.Y !== undefined && y === null) ||
      (control.properties.Width !== undefined && resolvedWidth === null) ||
      (control.properties.Height !== undefined && resolvedHeight === null)
  };
}

export function isAutoLayout(control: CanvasControl | undefined): boolean {
  return (
    control?.controlType.toLowerCase().includes("groupcontainer") === true &&
    control.variant?.toLowerCase() === "autolayout"
  );
}

export function autoLayoutChildren(
  parent: CanvasControl,
  context: LayoutContext
): PositionedControl[] {
  const children = parent.children;
  if (children.length === 0) return [];

  const symbols = layoutSymbols(context) ?? {};
  const resolvedDirection = previewLayoutEnum(parent.properties.LayoutDirection, "LayoutDirection", symbols);
  const direction = resolvedDirection ?? parent.layout?.toLowerCase() ?? "vertical";
  const directionUnknown = parent.properties.LayoutDirection !== undefined &&
    !["horizontal", "vertical"].includes(resolvedDirection ?? "");
  const horizontal = direction.includes("horizontal");

  const gap = staticNumber(parent.properties.LayoutGap, symbols) ?? 0;
  const paddingLeft = staticNumber(parent.properties.PaddingLeft, symbols) ?? 0;
  const paddingRight = staticNumber(parent.properties.PaddingRight, symbols) ?? 0;
  const paddingTop = staticNumber(parent.properties.PaddingTop, symbols) ?? 0;
  const paddingBottom = staticNumber(parent.properties.PaddingBottom, symbols) ?? 0;
  // An unresolved layout formula is not equivalent to its fallback value.
  // Keep approximate positions inspectable without claiming exact geometry.
  const spacingUnknown = [
    parent.properties.LayoutGap,
    parent.properties.PaddingLeft, parent.properties.PaddingRight,
    parent.properties.PaddingTop, parent.properties.PaddingBottom
  ].some(value => {
    if (value === undefined) return false;
    const resolved = staticNumber(value, symbols);
    // The source-only layout model does not verify negative spacing.
    // Keep its approximate position, but never label it source-exact.
    return resolved === null || !Number.isFinite(resolved) || resolved < 0;
  });

  const innerWidth = Math.max(
    0,
    context.parentWidth - paddingLeft - paddingRight
  );
  const innerHeight = Math.max(
    0,
    context.parentHeight - paddingTop - paddingBottom
  );
  const mainAvailable =
    (horizontal ? innerWidth : innerHeight) -
    Math.max(0, children.length - 1) * gap;
  const crossAvailable = horizontal ? innerHeight : innerWidth;

  const sizing = children.map(control => {
    const defaults = defaultControlSize(control.controlType);
    const width = staticNumber(control.properties.Width, symbols);
    const height = staticNumber(control.properties.Height, symbols);
    const fill = Math.max(
      0,
      staticNumber(control.properties.FillPortions, symbols) ?? 0
    );

    const minWidth = staticNumber(control.properties.LayoutMinWidth, symbols);
    const minHeight = staticNumber(control.properties.LayoutMinHeight, symbols);
    const maxWidth = staticNumber(control.properties.LayoutMaxWidth, symbols);
    const maxHeight = staticNumber(control.properties.LayoutMaxHeight, symbols);

    const baseWidth = clamp(width ?? defaults.width, minWidth, maxWidth);
    const baseHeight = clamp(height ?? defaults.height, minHeight, maxHeight);

    return {
      control,
      fill,
      width,
      height,
      minWidth,
      minHeight,
      maxWidth,
      maxHeight,
      baseWidth,
      baseHeight
    };
  });

  // Microsoft Canvas Wrap moves fixed-size children to the next row/column
  // when they no longer fit on the main axis. Child AlignInContainer is
  // ignored with Wrap (Microsoft responsive-layout documented limitation).
  // Only claim exact geometry for a fully static, Start-justified case.
  const wrap = staticBoolean(parent.properties.LayoutWrap, symbols);
  const numericKnown = (value: unknown): boolean =>
    value === undefined || staticNumber(value, symbols) !== null;
  const justifyRaw = parent.properties.LayoutJustifyContent;
  const justifyStart = justifyRaw === undefined ||
    previewLayoutEnum(justifyRaw, "LayoutJustifyContent", symbols) === "start";
  // Wrap lays out successive rows/columns. Our verified wrap branch places
  // every child at the start of its line's cross axis; Center/End/Stretch or
  // an unresolved parent alignment can change those positions. Preserve the
  // source geometry as an approximation instead of certifying Start layout.
  // https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-vertical-container
  const alignRaw = parent.properties.LayoutAlignItems;
  const wrapAlignStart = alignRaw === undefined ||
    previewLayoutEnum(alignRaw, "LayoutAlignItems", symbols) === "start";
  const knownSpacing = [
    parent.properties.LayoutGap,
    parent.properties.PaddingLeft, parent.properties.PaddingRight,
    parent.properties.PaddingTop, parent.properties.PaddingBottom
  ].every(numericKnown) &&
    gap >= 0 && paddingLeft >= 0 && paddingRight >= 0 &&
    paddingTop >= 0 && paddingBottom >= 0;
  // AutoHeight can change a horizontal row's cross-axis placement and the
  // height of a wrapped line, not only the main-axis size of vertical stacks.
  // Without measured runtime text, neither orientation is source-exact.
  // https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-text-box
  const autoHeightUnverified = children.some(control =>
    hasUnverifiedAutoHeight(control, symbols));
  // Negative FillPortions and contradictory/negative size constraints are
  // outside the renderer's verified layout model. Math.max/clamp can still
  // paint a safe approximation, but must not silently certify its geometry.
  // This is a preview limitation, not an assertion about Canvas validation.
  const sizingUnsupported = children.some(control => {
    const props = control.properties;
    const fill = props.FillPortions === undefined
      ? null : staticNumber(props.FillPortions, symbols);
    const minWidth = staticNumber(props.LayoutMinWidth, symbols);
    const maxWidth = staticNumber(props.LayoutMaxWidth, symbols);
    const minHeight = staticNumber(props.LayoutMinHeight, symbols);
    const maxHeight = staticNumber(props.LayoutMaxHeight, symbols);
    return (fill !== null && fill < 0) ||
      [minWidth, maxWidth, minHeight, maxHeight]
        .some(value => value !== null && value < 0) ||
      (minWidth !== null && maxWidth !== null && minWidth > maxWidth) ||
      (minHeight !== null && maxHeight !== null && minHeight > maxHeight);
  });
  const fixedChildren = !sizingUnsupported && sizing.every(item =>
    !hasUnverifiedAutoHeight(item.control, symbols) &&
    item.fill === 0 && item.width !== null && item.height !== null &&
    [
      item.control.properties.FillPortions,
      item.control.properties.LayoutMinWidth,
      item.control.properties.LayoutMinHeight,
      item.control.properties.LayoutMaxWidth,
      item.control.properties.LayoutMaxHeight
    ].every(numericKnown)
  );
  const knownDirection = parent.properties.LayoutDirection === undefined || resolvedDirection !== null;

  // A source-only preview cannot certify AutoLayout placement when a child
  // size, FillPortions or size constraint depends on runtime state. Such a
  // value can redistribute available space and move *other* siblings, even
  // when their own dimensions are literal. Keep fallback geometry inspectable
  // but mark the entire sibling layout approximate. Omitted .pa.yaml
  // properties are defaults, not unresolved formulas.
  const sizingUnknown = autoHeightUnverified || sizingUnsupported || children.some(control => [
    control.properties.Width, control.properties.Height,
    control.properties.FillPortions,
    control.properties.LayoutMinWidth, control.properties.LayoutMinHeight,
    control.properties.LayoutMaxWidth, control.properties.LayoutMaxHeight
  ].some(value => value !== undefined && staticNumber(value, symbols) === null));

  if (wrap === true && justifyStart && wrapAlignStart && knownSpacing &&
      fixedChildren && knownDirection) {
    const startMain = horizontal ? paddingLeft : paddingTop;
    const maxMain = startMain + (horizontal ? innerWidth : innerHeight);
    let cursorMain = startMain;
    let cursorCross = horizontal ? paddingTop : paddingLeft;
    let lineCrossSize = 0;

    return sizing.map(item => {
      const mainSize = horizontal ? item.baseWidth : item.baseHeight;
      const crossSize = horizontal ? item.baseHeight : item.baseWidth;
      if (cursorMain > startMain && cursorMain + mainSize > maxMain) {
        cursorMain = startMain;
        cursorCross += lineCrossSize + gap;
        lineCrossSize = 0;
      }
      const rect: VisualRect = {
        x: horizontal ? cursorMain : cursorCross,
        y: horizontal ? cursorCross : cursorMain,
        width: Math.max(0, item.baseWidth),
        height: Math.max(0, item.baseHeight),
        dynamic: false
      };
      cursorMain += mainSize + gap;
      lineCrossSize = Math.max(lineCrossSize, crossSize);
      return { control: item.control, rect };
    });
  }

  // A dynamic Wrap condition, or a combination whose wrap behavior cannot
  // be established from source alone, must not appear as verified geometry.
  const wrapUncertain = wrap === true ||
    (parent.properties.LayoutWrap !== undefined && wrap === null);

  const fixedMain = sizing.reduce((sum, item) => {
    if (item.fill > 0) return sum;
    return sum + (horizontal ? item.baseWidth : item.baseHeight);
  }, 0);
  const fillTotal = sizing.reduce((sum, item) => sum + item.fill, 0);
  const remainingForFill = Math.max(0, mainAvailable - fixedMain);

  const provisional = sizing.map(item => {
    let width = item.baseWidth;
    let height = item.baseHeight;
    let fallback = false;

    if (item.fill > 0 && fillTotal > 0) {
      const allocated = remainingForFill * (item.fill / fillTotal);
      if (horizontal) {
        width = clamp(allocated, item.minWidth, item.maxWidth);
      } else {
        height = clamp(allocated, item.minHeight, item.maxHeight);
      }
    } else if (
      (horizontal ? item.width : item.height) === null &&
      item.fill === 0
    ) {
      fallback = true;
    }

    const parentAlignValue = previewLayoutEnum(parent.properties.LayoutAlignItems, "LayoutAlignItems", symbols);
    const childAlignValue = previewLayoutEnum(item.control.properties.AlignInContainer, "AlignInContainer", symbols);
    // SetByContainer inherits the container's cross-axis alignment.
    const inheritsAlign = childAlignValue === null || childAlignValue === "setbycontainer";
    const childAlign = inheritsAlign ? parentAlignValue ?? "start" : childAlignValue ?? "start";
    const alignUnknown =
      (item.control.properties.AlignInContainer !== undefined && childAlignValue === null) ||
      (inheritsAlign && parent.properties.LayoutAlignItems !== undefined && parentAlignValue === null) ||
      !["start", "center", "end", "stretch"].includes(childAlign);
    if (alignUnknown) fallback = true;

    if (childAlign === "stretch") {
      if (horizontal) {
        height = clamp(
          crossAvailable,
          item.minHeight,
          item.maxHeight
        );
      } else {
        width = clamp(
          crossAvailable,
          item.minWidth,
          item.maxWidth
        );
      }
    } else if (
      (horizontal ? item.height : item.width) === null
    ) {
      fallback = true;
    }

    return {
      ...item,
      width: Math.max(0, width),
      height: Math.max(0, height),
      fallback,
      childAlign
    };
  });

  const usedMain = provisional.reduce(
    (sum, item) => sum + (horizontal ? item.width : item.height),
    0
  );
  const extra = Math.max(0, mainAvailable - usedMain);
  const resolvedJustify = previewLayoutEnum(parent.properties.LayoutJustifyContent, "LayoutJustifyContent", symbols);
  const justify = resolvedJustify ?? "start";
  const justifyUnknown = parent.properties.LayoutJustifyContent !== undefined &&
    !["start", "center", "end", "spacebetween"].includes(resolvedJustify ?? "");

  let leading = 0;
  let effectiveGap = gap;

  if (fillTotal === 0) {
    if (justify === "center") leading = extra / 2;
    else if (justify === "end") leading = extra;
    else if (justify === "spacebetween" && children.length > 1) {
      effectiveGap = gap + extra / (children.length - 1);
    }
  }

  let cursor = (horizontal ? paddingLeft : paddingTop) + leading;

  return provisional.map(item => {
    let x = horizontal ? cursor : paddingLeft;
    let y = horizontal ? paddingTop : cursor;

    if (item.childAlign === "center") {
      if (horizontal) y += (crossAvailable - item.height) / 2;
      else x += (crossAvailable - item.width) / 2;
    } else if (item.childAlign === "end") {
      if (horizontal) y += crossAvailable - item.height;
      else x += crossAvailable - item.width;
    }

    const rect: VisualRect = {
      x,
      y,
      width: item.width,
      height: item.height,
      dynamic: item.fallback || wrapUncertain || directionUnknown ||
        spacingUnknown || justifyUnknown || sizingUnknown
    };

    cursor +=
      (horizontal ? item.width : item.height) + effectiveGap;

    return { control: item.control, rect };
  });
}

export function layoutWrapEnabled(
  control: CanvasControl,
  context: LayoutContext
): boolean {
  const symbols = layoutSymbols(context);
  return staticBoolean(control.properties.LayoutWrap, symbols) ?? false;
}


export interface GalleryTemplateLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: "vertical" | "horizontal";
  variableHeight: boolean;
  padding: number;
  wrapCount: number;
  dynamic: boolean;
}

export function isGallery(control: CanvasControl | undefined): boolean {
  return control?.controlType.toLowerCase().includes("gallery") === true;
}

export function galleryTemplateLayout(
  control: CanvasControl,
  rect: VisualRect,
  context?: LayoutContext
): GalleryTemplateLayout | null {
  if (!isGallery(control)) return null;

  const variant = (control.variant ?? "").toLowerCase();
  const horizontal = variant.includes("horizontal");
  const symbols = layoutSymbols(context);
  const resolvedWrap = staticNumber(control.properties.WrapCount, symbols);
  // WrapCount counts whole gallery slots. Fractional, non-positive, or
  // renderer-limit-exceeding values cannot establish verified columns/rows.
  // Keep a bounded single-slot approximation and mark the guide unknown,
  // rather than silently flooring or clamping to a seemingly exact layout.
  // The 64-slot bound is a preview safety limit, not a Canvas product limit.
  const wrapVerified = resolvedWrap !== null &&
    Number.isSafeInteger(resolvedWrap) && resolvedWrap >= 1 && resolvedWrap <= 64;
  const wrapCount = wrapVerified ? resolvedWrap : 1;
  const variableHeight = variant.includes("variableheight");
  // A present TemplateSize takes precedence over the legacy TemplateHeight.
  // If its Power Fx expression is unresolved, do not silently substitute a
  // known TemplateHeight and claim exact geometry. Missing and unknown are
  // distinct states in source-only .pa.yaml previews.
  const templateSizeSource = control.properties.TemplateSize !== undefined
    ? control.properties.TemplateSize
    : control.properties.TemplateHeight;
  const templateSize = staticNumber(templateSizeSource, symbols);
  const resolvedPadding = staticNumber(control.properties.TemplatePadding, symbols);
  const invalidTemplateSize = templateSize !== null && templateSize < 1;
  const invalidPadding = resolvedPadding !== null && resolvedPadding < 0;
  // An unresolved Power Fx padding formula is an approximation, not verified
  // template geometry. Never infer its value from SQL or runtime state.
  const padding = Math.max(0, resolvedPadding ?? 0);

  const fallbackSize = horizontal
    ? Math.min(160, rect.width)
    : Math.min(72, rect.height);
  // Microsoft Gallery.TemplateSize has a minimum of 1, not 8.
  const size = Math.max(1, templateSize ?? fallbackSize);

  return {
    x: rect.x,
    y: rect.y,
    // TemplateSize is an item dimension, not a viewport-bound dimension.
    // The gallery viewport clips the template guide; shrinking the template
    // would misrepresent tall vertical / wide horizontal gallery items.
    // https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-gallery
    width: horizontal ? size : rect.width / wrapCount,
    height: horizontal ? rect.height / wrapCount : size,
    orientation: horizontal ? "horizontal" : "vertical",
    variableHeight,
    padding,
    wrapCount,
    dynamic: rect.dynamic || templateSize === null || invalidTemplateSize ||
      variableHeight ||
      (control.properties.WrapCount !== undefined && !wrapVerified) ||
      (control.properties.TemplatePadding !== undefined &&
        (resolvedPadding === null || invalidPadding))
  };
}


/**
 * Geometry for a source-only gallery template guide, never a runtime record.
 * WrapCount creates columns in a vertical gallery and rows in a horizontal
 * gallery. Keep the guides within their template cells; clipping to the
 * gallery viewport is handled by the SVG renderer.
 */
export function galleryTemplateGuideRect(
  template: GalleryTemplateLayout,
  slotIndex: number,
  originX: number,
  originY: number
): { x: number; y: number; width: number; height: number } {
  const slot = Math.max(0, Math.floor(Number.isFinite(slotIndex) ? slotIndex : 0));
  const padding = Math.max(0, template.padding);
  return {
    x: originX + (template.orientation === "vertical" ? slot * template.width : 0) + padding,
    y: originY + (template.orientation === "horizontal" ? slot * template.height : 0) + padding,
    width: Math.max(0, template.width - padding * 2),
    height: Math.max(0, template.height - padding * 2)
  };
}
