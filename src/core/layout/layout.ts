import type { CanvasControl } from "../../types/canvas";
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

export function rgba(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const match = value
    .trim()
    .match(
      /^=\s*RGBA\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)\s*$/i
    );

  if (!match) return null;

  return (
    "rgba(" +
    match[1] +
    "," +
    match[2] +
    "," +
    match[3] +
    "," +
    match[4] +
    ")"
  );
}

export function defaultControlSize(
  type: string
): { width: number; height: number } {
  const lower = type.toLowerCase();
  const key = Object.keys(DEFAULTS).find(candidate =>
    lower.includes(candidate)
  );
  return key ? DEFAULTS[key] : { width: 180, height: 56 };
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

      const setNumber = (key: string, value: number | null): void => {
        if (value === null || resolved[key] === value) return;
        resolved[key] = value;
        changed = true;
      };

      setNumber(control.name + ".Width", width);
      setNumber(control.name + ".Height", height);

      const selfSymbols: Record<string, StaticPowerFxValue> = {
        ...baseSymbols,
        ...(width !== null ? { "Self.Width": width } : {}),
        ...(height !== null ? { "Self.Height": height } : {})
      };

      setNumber(
        control.name + ".X",
        staticNumber(control.properties.X, selfSymbols)
      );
      setNumber(
        control.name + ".Y",
        staticNumber(control.properties.Y, selfSymbols)
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

  const finalWidth = Math.max(8, width ?? defaults.width);
  const finalHeight = Math.max(8, height ?? defaults.height);

  const selfSymbols = layoutSymbols(
    context,
    finalWidth,
    finalHeight
  );

  const x = resolvedNumber(control.properties.X, selfSymbols);
  const y = resolvedNumber(control.properties.Y, selfSymbols);

  return {
    x: x ?? 24 + (index % 4) * 190,
    y: y ?? 24 + Math.floor(index / 4) * 72,
    width: finalWidth,
    height: finalHeight,
    dynamic:
      x === null ||
      y === null ||
      width === null ||
      height === null
  };
}

export function isAutoLayout(control: CanvasControl | undefined): boolean {
  return (
    control?.controlType.toLowerCase().includes("groupcontainer") === true &&
    control.variant?.toLowerCase() === "autolayout"
  );
}

function enumTail(value: string | null): string | null {
  if (!value) return null;
  return value.split(".").at(-1)?.toLowerCase() ?? null;
}

export function autoLayoutChildren(
  parent: CanvasControl,
  context: LayoutContext
): PositionedControl[] {
  const children = parent.children;
  if (children.length === 0) return [];

  const symbols = layoutSymbols(context) ?? {};
  const direction =
    enumTail(staticString(parent.properties.LayoutDirection, symbols)) ??
    parent.layout?.toLowerCase() ??
    "vertical";
  const horizontal = direction.includes("horizontal");

  const gap = staticNumber(parent.properties.LayoutGap, symbols) ?? 0;
  const paddingLeft = staticNumber(parent.properties.PaddingLeft, symbols) ?? 0;
  const paddingRight = staticNumber(parent.properties.PaddingRight, symbols) ?? 0;
  const paddingTop = staticNumber(parent.properties.PaddingTop, symbols) ?? 0;
  const paddingBottom = staticNumber(parent.properties.PaddingBottom, symbols) ?? 0;

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

    const parentAlign =
      enumTail(staticString(parent.properties.LayoutAlignItems, symbols)) ??
      "start";
    const childAlign =
      enumTail(staticString(item.control.properties.AlignInContainer, symbols)) ??
      parentAlign;

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
      width: Math.max(8, width),
      height: Math.max(8, height),
      fallback,
      childAlign
    };
  });

  const usedMain = provisional.reduce(
    (sum, item) => sum + (horizontal ? item.width : item.height),
    0
  );
  const extra = Math.max(0, mainAvailable - usedMain);
  const justify =
    enumTail(staticString(parent.properties.LayoutJustifyContent, symbols)) ??
    "start";

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
      dynamic: item.fallback
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
  dynamic: boolean;
}

export function isGallery(control: CanvasControl | undefined): boolean {
  return control?.controlType.toLowerCase().includes("gallery") === true;
}

export function galleryTemplateLayout(
  control: CanvasControl,
  rect: VisualRect
): GalleryTemplateLayout | null {
  if (!isGallery(control)) return null;

  const variant = (control.variant ?? "").toLowerCase();
  const horizontal = variant.includes("horizontal");
  const variableHeight = variant.includes("variableheight");
  const templateSize =
    staticNumber(control.properties.TemplateSize) ??
    staticNumber(control.properties.TemplateHeight) ??
    null;
  const padding = Math.max(
    0,
    staticNumber(control.properties.TemplatePadding) ?? 0
  );

  const fallbackSize = horizontal
    ? Math.min(160, rect.width)
    : Math.min(72, rect.height);
  const size = Math.max(8, templateSize ?? fallbackSize);

  return {
    x: rect.x,
    y: rect.y,
    width: horizontal ? Math.min(rect.width, size) : rect.width,
    height: horizontal ? rect.height : Math.min(rect.height, size),
    orientation: horizontal ? "horizontal" : "vertical",
    variableHeight,
    padding,
    dynamic: templateSize === null || variableHeight
  };
}
