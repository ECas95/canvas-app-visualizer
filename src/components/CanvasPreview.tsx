import type { CanvasControl, CanvasScreen } from "../types/canvas";
import { controlRect, literalText, rgba } from "../core/layout/layout";

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
  depth = 0
): DrawItem[] {
  const output: DrawItem[] = [];

  controls.forEach((control, index) => {
    const rect = controlRect(control, index);
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

    if (depth < 4 && control.children.length > 0) {
      output.push(...flatten(control.children, x, y, depth + 1));
    }
  });

  return output;
}

function colorFor(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes("button")) return "#6648d8";
  if (lower.includes("gallery")) return "#0e7490";
  if (lower.includes("input")) return "#8b5e00";
  if (lower.includes("image") || lower.includes("icon")) return "#9f3567";
  if (lower.includes("container")) return "#3f5d45";
  return "#3e4b66";
}

export function CanvasPreview({ screen, selectedId, onSelect }: Props) {
  if (!screen) {
    return <main className="preview empty">Select a screen.</main>;
  }

  const width = 1366;
  const height = 768;
  const items = flatten(screen.children);
  const fill = rgba(screen.properties.Fill) ?? "#f5f6fa";

  return (
    <main className="preview">
      <div className="preview-toolbar">
        <div>
          <strong>{screen.name}</strong>
          <span>Approximate preview</span>
        </div>
        <span>{items.length} visual nodes</span>
      </div>
      <div className="canvas-stage">
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
                  rx="6"
                  fill={colorFor(item.control.controlType)}
                  fillOpacity={selected ? 0.28 : 0.12}
                  stroke={selected ? "#7c5cff" : colorFor(item.control.controlType)}
                  strokeWidth={selected ? 4 : 2}
                  strokeDasharray={item.dynamic ? "9 6" : undefined}
                />
                <text
                  x={item.x + 8}
                  y={item.y + Math.min(24, item.height / 2 + 5)}
                  fontSize="14"
                  fill="#1f2633"
                >
                  {text.slice(0, 44)}
                </text>
                {item.dynamic && (
                  <text
                    x={item.x + 8}
                    y={item.y + item.height - 8}
                    fontSize="10"
                    fill="#6b7280"
                  >
                    dynamic layout
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="preview-note">
        Dashed controls use fallback geometry because one or more layout properties are
        formula-driven and cannot be resolved statically.
      </div>
    </main>
  );
}
