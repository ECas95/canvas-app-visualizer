import { useId, useMemo, useState, type ReactNode } from "react";
import type { CanvasControl, CanvasScreen, PreviewMediaAsset } from "../types/canvas";
import {
  autoLayoutChildren,
  buildSiblingGeometrySymbols,
  controlRect,
  galleryTemplateLayout,
  isAutoLayout,
  isGallery,
  rgba
} from "../core/layout/layout";
import { isDefinitelyHidden, previewColor } from "../core/layout/previewAppearance";
import { CanvasVisualControl } from "./CanvasVisualControl";
import { Icon } from "./Icon";

interface Props {
  screen?: CanvasScreen;
  mediaAssets?: PreviewMediaAsset[];
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
  ancestors: string[];
}

const PROFILES = {
  desktop: { width: 1366, height: 768, label: "Desktop" },
  tablet: { width: 768, height: 1024, label: "Tablet" },
  phone: { width: 390, height: 844, label: "Phone" }
} as const;

type Profile = keyof typeof PROFILES;
type PreviewMode = "visual" | "structure";
type Zoom = "fit" | "50" | "75" | "100" | "125";

function flatten(
  controls: CanvasControl[],
  offsetX: number,
  offsetY: number,
  parentWidth: number,
  parentHeight: number,
  appWidth: number,
  appHeight: number,
  depth = 0,
  ancestors: string[] = [],
  templateWidth?: number,
  templateHeight?: number,
  parentControl?: CanvasControl
): DrawItem[] {
  const output: DrawItem[] = [];
  const baseContext = {
    parentWidth, parentHeight, appWidth, appHeight, templateWidth, templateHeight
  };
  const siblingSymbols = buildSiblingGeometrySymbols(controls, baseContext);
  const context = { ...baseContext, symbols: siblingSymbols };
  const positioned =
    parentControl && isAutoLayout(parentControl)
      ? autoLayoutChildren(parentControl, context)
      : controls.map((control, index) => ({
          control, rect: controlRect(control, index, context)
        }));

  for (const { control, rect } of positioned) {
    // A proven-false parent hides its complete subtree; unresolved visibility
    // stays visible instead of guessing runtime state.
    if (isDefinitelyHidden(control)) continue;
    const x = offsetX + rect.x;
    const y = offsetY + rect.y;
    output.push({
      control, x, y, width: rect.width, height: rect.height,
      dynamic: rect.dynamic, ancestors
    });
    if (depth >= 24 || control.children.length === 0) continue;
    const editorGroup = control.controlType.toLowerCase() === "group";
    const template = isGallery(control)
      ? galleryTemplateLayout(control, {
          x: 0, y: 0, width: rect.width, height: rect.height, dynamic: rect.dynamic
        })
      : null;
    output.push(...flatten(
      control.children,
      editorGroup ? offsetX : x + (template?.x ?? 0),
      editorGroup ? offsetY : y + (template?.y ?? 0),
      editorGroup ? parentWidth : template?.width ?? rect.width,
      editorGroup ? parentHeight : template?.height ?? rect.height,
      appWidth, appHeight, depth + 1,
      [...ancestors, control.id],
      editorGroup ? templateWidth : template?.width,
      editorGroup ? templateHeight : template?.height,
      editorGroup ? parentControl : control
    ));
  }
  return output;
}

function wireframeColor(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes("button")) return "#0f6cbd";
  if (lower.includes("gallery")) return "#107c6c";
  if (lower.includes("input")) return "#8a5d00";
  if (lower.includes("container")) return "#4f6b57";
  return "#657285";
}

export function CanvasPreview({ screen, selectedId, onSelect, mediaAssets = [] }: Props) {
  const [profile, setProfile] = useState<Profile>("desktop");
  const [mode, setMode] = useState<PreviewMode>("visual");
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [focusSelection, setFocusSelection] = useState(false);
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { width, height } = PROFILES[profile];

  const items = useMemo(
    () => screen ? flatten(screen.children, 0, 0, width, height, width, height) : [],
    [screen, width, height]
  );
  const itemById = useMemo(
    () => new Map(items.map(item => [item.control.id, item])),
    [items]
  );
  const indexById = useMemo(() => new Map(items.map((item, index) => [item.control.id, index])), [items]);
  const target = selectedId ? itemById.get(selectedId) : undefined;
  const visibleItems = useMemo(
    () => focusSelection && target
      ? items.filter(item =>
          item.control.id === target.control.id ||
          item.ancestors.includes(target.control.id) ||
          target.ancestors.includes(item.control.id)
        )
      : items,
    [items, focusSelection, target]
  );
  const unresolved = items.filter(item => item.dynamic).length;

  if (!screen) {
    return (
      <main className="preview empty">
        <Icon name="screen" size={28} />
        <strong>No screen selected</strong>
        <span>Choose a screen from App explorer.</span>
      </main>
    );
  }

  const fill = previewColor(screen.properties.Fill) ?? rgba(screen.properties.Fill) ?? "#ffffff";
  const zoomWidth = zoom === "fit" ? "min(100%,1120px)"
    : `${Math.round(width * Number(zoom) / 100)}px`;

  return (
    <main className="preview">
      <div className="preview-toolbar">
        <div className="preview-breadcrumb">
          <span>Screens</span>
          <Icon name="chevron" size={12} />
          <strong>{screen.name}</strong>
        </div>
        <div className="preview-toolbar-meta preview-actions">
          <div className="preview-segment" role="group" aria-label="Preview mode">
            <button type="button" className={mode === "visual" ? "active" : ""}
              aria-pressed={mode === "visual"} onClick={() => setMode("visual")}>Visual</button>
            <button type="button" className={mode === "structure" ? "active" : ""}
              aria-pressed={mode === "structure"} onClick={() => setMode("structure")}>Structure</button>
          </div>
          <label className="preview-choice">
            <span>Viewport</span>
            <select aria-label="Simulated viewport" value={profile}
              onChange={event => setProfile(event.target.value as Profile)}>
              {Object.entries(PROFILES).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </select>
          </label>
          <label className="preview-choice">
            <span>Zoom</span>
            <select aria-label="Preview zoom" value={zoom}
              onChange={event => setZoom(event.target.value as Zoom)}>
              <option value="fit">Fit</option>
              <option value="50">50%</option>
              <option value="75">75%</option>
              <option value="100">100%</option>
              <option value="125">125%</option>
            </select>
          </label>
          <label className="preview-focus">
            <input type="checkbox" checked={focusSelection} disabled={!target}
              onChange={event => setFocusSelection(event.target.checked)} />
            Isolate selection
          </label>
          <span className="preview-dimensions">{width} × {height}</span>
        </div>
      </div>
      <div className="canvas-stage">
        <div className="canvas-frame" style={{ width: zoomWidth }}>
          <div className="canvas-frame-bar">
            <span>{screen.name}</span>
            <span>{mode === "visual" ? "Visual approximation" : "Structure inspection"}</span>
          </div>
          <svg viewBox={`0 0 ${width} ${height}`}
            style={{ aspectRatio: `${width} / ${height}` }}
            role="img" aria-label={`${screen.name} canvas preview`}>
            <defs>
              {items.map((item, index) => (
                <clipPath key={item.control.id} id={`${instanceId}-bounds-${index}`}>
                  <rect x={item.x} y={item.y} width={item.width} height={item.height} />
                </clipPath>
              ))}
            </defs>
            <rect width={width} height={height} fill={fill} />
            {visibleItems.map(item => {
              const index = indexById.get(item.control.id) ?? 0;
              const selected = selectedId === item.control.id;
              const draw = (
                <g className="visual-control" key={item.control.id}
                  role="button" tabIndex={0}
                  aria-label={`Inspect ${item.control.name} (${item.control.controlType})`}
                  onClick={event => { event.stopPropagation(); onSelect(item.control); }}
                  onKeyDown={event => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(item.control);
                    }
                  }}>
                  {mode === "visual" ? (
                    <CanvasVisualControl control={item.control} mediaAssets={mediaAssets}
                      x={item.x} y={item.y} width={item.width} height={item.height}
                      clipId={`${instanceId}-text-${index}`} />
                  ) : (
                    <>
                      <rect x={item.x} y={item.y} width={item.width} height={item.height}
                        rx={3} fill={wireframeColor(item.control.controlType)}
                        fillOpacity={0.07} stroke={wireframeColor(item.control.controlType)}
                        strokeWidth={1.5} strokeDasharray={item.dynamic ? "8 5" : undefined} />
                      <text x={item.x + 5} y={item.y + Math.min(18, item.height / 2 + 3)}
                        fontSize={12} fill="#303846" pointerEvents="none">
                        {item.control.name.slice(0, 36)}
                      </text>
                    </>
                  )}
                  {selected && (
                    <rect x={item.x} y={item.y} width={item.width} height={item.height}
                      fill="none" stroke="#0067c0" strokeWidth={3} pointerEvents="none" />
                  )}
                  <title>{item.control.name} · {item.control.controlType}
                    {item.dynamic ? " · unresolved layout" : ""}</title>
                </g>
              );
              // Clip children in layout hosts only; plain editor Groups do not clip.
              const clipped = item.ancestors.reduceRight<ReactNode>((child, ancestor) => {
                const parent = itemById.get(ancestor);
                if (!parent) return child;
                // A Power Apps Group is an editor grouping, not a clipping container.
                if (!/(gallery|container|form|datacard)/i.test(parent.control.controlType)) return child;
                const parentIndex = indexById.get(parent.control.id) ?? 0;
                return (
                  <g clipPath={`url(#${instanceId}-bounds-${parentIndex})`}>
                    {child}
                  </g>
                );
              }, draw);
              return <g key={item.control.id}>{clipped}</g>;
            })}
          </svg>
        </div>
      </div>
      <div className="preview-note">
        <span>{mode === "visual" ? "Static visual approximation" : "Control structure"}</span>
        <span>{visibleItems.length} visible nodes · {unresolved} unresolved layouts</span>
        <span>Viewport profiles simulate dimensions; no formulas or connectors are executed.</span>
      </div>
    </main>
  );
}
