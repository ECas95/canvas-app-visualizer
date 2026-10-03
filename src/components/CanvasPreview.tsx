import type { CanvasControl, CanvasScreen } from "../types/canvas";
import {
  autoLayoutChildren,
  buildSiblingGeometrySymbols,
  controlRect,
  isAutoLayout,
  literalText,
  rgba
} from "../core/layout/layout";
import { staticNumber } from "../core/powerfx/staticEval";
import { Icon } from "./Icon";

interface Props {
  screen?: CanvasScreen;
  selectedId?: string;
  onSelect: (control: CanvasControl) => void;
}

interface DrawItem {
  control: CanvasControl;
  x: number;
  y: number;
  width: number;
  height: number;
  dynamic: boolean;
}

function flatten(
  controls: CanvasControl[],
  offsetX = 0,
  offsetY = 0,
  parentWidth = 1366,
  parentHeight = 768,
  appWidth = 1366,
  appHeight = 768,
  depth = 0,
  templateWidth?: number,
  templateHeight?: number,
  parentControl?: CanvasControl
): DrawItem[] {
  const output: DrawItem[] = [];
  const baseContext = {
    parentWidth,
    parentHeight,
    appWidth,
    appHeight,
    templateWidth,
    templateHeight
  };
  const siblingSymbols = buildSiblingGeometrySymbols(
    controls,
    baseContext
  );
  const context = {
    ...baseContext,
    symbols: siblingSymbols
  };

  const positioned =
    parentControl && isAutoLayout(parentControl)
      ? autoLayoutChildren(parentControl, context)
      : controls.map((control, index) => ({
          control,
          rect: controlRect(control, index, context)
        }));

  positioned.forEach(({ control, rect }) => {
    const x = offsetX + rect.x;
    const y = offsetY + rect.y;

    output.push({
      control,
      x,
      y,
      width: rect.width,
      height: rect.height,
      dynamic: rect.dynamic
    });

    if (depth < 5 && control.children.length > 0) {
      const isGallery = control.controlType.toLowerCase().includes("gallery");
      const childTemplateHeight = isGallery
        ? staticNumber(control.properties.TemplateSize) ??
          staticNumber(control.properties.TemplateHeight) ??
          64
        : undefined;

      output.push(
        ...flatten(
          control.children,
          x,
          y,
          rect.width,
          rect.height,
          appWidth,
          appHeight,
          depth + 1,
          isGallery ? rect.width : undefined,
          childTemplateHeight,
          control
        )
      );
    }
  });

  return output;
}

function colorFor(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes("button")) return "#0f6cbd";
  if (lower.includes("gallery")) return "#107c6c";
  if (lower.includes("input")) return "#8a5d00";
  if (lower.includes("image") || lower.includes("icon")) return "#8b4a85";
  if (lower.includes("container")) return "#4f6b57";
  return "#5c667a";
}

export function CanvasPreview({ screen, selectedId, onSelect }: Props) {
  if (!screen) {
    return (
      <main className="preview empty">
        <Icon name="screen" size={28} />
        <strong>No screen selected</strong>
        <span>Choose a screen from App explorer.</span>
      </main>
    );
  }

  const width = 1366;
  const height = 768;
  const items = flatten(screen.children);
  const fill = rgba(screen.properties.Fill) ?? "#f7f7f7";

  return (
    <main className="preview">
      <div className="preview-toolbar">
        <div className="preview-breadcrumb">
          <span>Screens</span>
          <Icon name="chevron" size={12} />
          <strong>{screen.name}</strong>
        </div>
        <div className="preview-toolbar-meta">
          <span className="subtle-badge">Approximate preview</span>
          <span>{items.length} nodes</span>
          <span>1366 × 768</span>
        </div>
      </div>

      <div className="canvas-stage">
        <div className="canvas-frame">
          <div className="canvas-frame-bar">
            <span>{screen.name}</span>
            <span>Canvas source preview</span>
          </div>
          <svg viewBox={"0 0 " + width + " " + height} role="img" aria-label={screen.name}>
            <rect x="0" y="0" width={width} height={height} fill={fill} />
            {items.map(item => {
              const selected = selectedId === item.control.id;
              const text =
                literalText(item.control.properties.Text) ??
                item.control.name;
              return (
                <g
                  key={item.control.id}
                  onClick={event => {
                    event.stopPropagation();
                    onSelect(item.control);
                  }}
                  className="visual-control"
                >
                  <rect
                    x={item.x}
                    y={item.y}
                    width={item.width}
                    height={item.height}
                    rx="4"
                    fill={colorFor(item.control.controlType)}
                    fillOpacity={selected ? 0.2 : 0.08}
                    stroke={selected ? "#0f6cbd" : colorFor(item.control.controlType)}
                    strokeWidth={selected ? 3 : 1.5}
                    strokeDasharray={item.dynamic ? "8 5" : undefined}
                  />
                  <text
                    x={item.x + 8}
                    y={item.y + Math.min(24, item.height / 2 + 5)}
                    fontSize="14"
                    fontFamily='"Segoe UI", system-ui, sans-serif'
                    fill="#242424"
                  >
                    {text.slice(0, 44)}
                  </text>
                  {item.dynamic && (
                    <text
                      x={item.x + 8}
                      y={item.y + item.height - 8}
                      fontSize="10"
                      fontFamily='"Segoe UI", system-ui, sans-serif'
                      fill="#616161"
                    >
                      dynamic layout
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="preview-note">
        <span className="dynamic-swatch" />
        Dashed outlines indicate formula-driven geometry that cannot be resolved statically.
      </div>
    </main>
  );
}
