import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import type { CanvasControl, CanvasScreen, PreviewMediaAsset } from "../types/canvas";
import {
  autoLayoutChildren,
  buildSiblingGeometrySymbols,
  controlRect,
  galleryTemplateLayout,
  galleryTemplateGuideRect,
  isAutoLayout,
  isGallery,
  rgba
} from "../core/layout/layout";
import { previewVisibility, previewSelectionBehaviorGate, previewColorWithSymbols } from "../core/layout/previewAppearance";
import { dependsOnRuntimeGalleryItems, galleryRecordsUnknown } from "../core/layout/previewDataState";
import { previewScopedSymbols, simulateScopedPreviewBehavior, type PreviewScopedState, type PreviewVariables } from "../core/powerfx/previewBehavior";
import { CanvasVisualControl } from "./CanvasVisualControl";
import { previewChildClipPath } from "../core/layout/previewCorners";
import { previewClampScroll, previewOverflowMode, previewScrollRanges, previewScrollOverlayAnchors, previewScrolledPosition, previewWheelScroll,
  type PreviewScrollOffset, type PreviewScrollRange } from "../core/layout/previewOverflow";
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
  renderSymbols: PreviewVariables;
  visibilityUnknown: boolean;
  runtimeGalleryStateUnknown: boolean;
  galleryTemplate: ReturnType<typeof galleryTemplateLayout>;
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
  parentControl?: CanvasControl,
  simulationSymbols: PreviewVariables = {},
  ancestorVisibilityUnknown = false
): DrawItem[] {
  const output: DrawItem[] = [];
  const baseContext = {
    parentWidth, parentHeight, appWidth, appHeight, templateWidth, templateHeight,
    symbols: simulationSymbols
  };
  const siblingSymbols = buildSiblingGeometrySymbols(controls, baseContext);
  const context = { ...baseContext, symbols: { ...siblingSymbols, ...simulationSymbols } };
  const positioned =
    parentControl && isAutoLayout(parentControl)
      ? autoLayoutChildren(parentControl, context)
      : controls.map((control, index) => ({
          control, rect: controlRect(control, index, context)
        }));

  for (const { control, rect } of positioned) {
    // A proven-false parent hides its complete subtree; unresolved visibility
    // stays visible instead of guessing runtime state.
    const visibilitySymbols = {
      ...siblingSymbols,
      "App.Width": appWidth, "App.Height": appHeight,
      "Parent.Width": parentWidth, "Parent.Height": parentHeight,
      ...simulationSymbols
    };
    const visibility = previewVisibility(control, visibilitySymbols);
    if (visibility === "hidden") continue;
    // AllItems is loaded only at runtime. Preserve the control's geometry as
    // an explicitly unknown placeholder, never as a verified empty/visible UI.
    const runtimeGalleryStateUnknown = dependsOnRuntimeGalleryItems(control);
    const visibilityUnknown = ancestorVisibilityUnknown || visibility === "unknown" || runtimeGalleryStateUnknown;
    const x = offsetX + rect.x;
    const y = offsetY + rect.y;
    const renderSymbols: PreviewVariables = {
      ...visibilitySymbols,
      ...(templateWidth !== undefined ? { "Parent.TemplateWidth": templateWidth } : {}),
      ...(templateHeight !== undefined ? { "Parent.TemplateHeight": templateHeight } : {}),
      ...(!rect.dynamic ? {
        "Self.Width": rect.width, "Self.Height": rect.height,
        "Self.X": rect.x, "Self.Y": rect.y
      } : {})
    };
    // Compute template geometry in the gallery's own formula scope. Parent
    // refers to its actual parent container/screen, not the gallery viewport.
    // Reuse this geometry for both layout and source-only guides.
    const galleryTemplate = isGallery(control)
      ? galleryTemplateLayout(control, {
          x: 0, y: 0, width: rect.width, height: rect.height, dynamic: rect.dynamic
        }, context)
      : null;
    output.push({
      control, x, y, width: rect.width, height: rect.height,
      dynamic: rect.dynamic, renderSymbols, visibilityUnknown,
      runtimeGalleryStateUnknown, galleryTemplate, ancestors
    });
    // Conditional descendants must not leak source-only content or imply that
    // an unavailable gallery is empty. The parent remains inspectable.
    // Gallery children are template definitions, not confirmed rendered rows.
    // Without a verified local Items snapshot, drawing even static child labels
    // would imply that at least one runtime record exists. Keep the gallery
    // bounds and template guide inspectable instead.
    // A source-only preview cannot prove an unresolved Visible formula true.
    // Do not draw descendant text or actions from a potentially hidden subtree.
    // Its geometry remains inspectable through the parent placeholder and tree.
    if (visibilityUnknown || runtimeGalleryStateUnknown || galleryRecordsUnknown(control) ||
        depth >= 24 || control.children.length === 0) continue;
    const editorGroup = control.controlType.toLowerCase() === "group";
    const template = galleryTemplate;
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
      editorGroup ? parentControl : control,
      simulationSymbols,
      visibilityUnknown
    ));
  }
  return output;
}

function PreviewScrollIndicators({ x, y, width, height, range, offset }: {
  x: number; y: number; width: number; height: number;
  range: PreviewScrollRange; offset: PreviewScrollOffset;
}) {
  const verticalTrack = Math.max(0, height - 8);
  const horizontalTrack = Math.max(0, width - 8);
  const verticalThumb = Math.min(verticalTrack,
    Math.max(14, verticalTrack * height / (height + range.y)));
  const horizontalThumb = Math.min(horizontalTrack,
    Math.max(14, horizontalTrack * width / (width + range.x)));
  return (
    <g pointerEvents="none" aria-hidden="true">
      {range.y > 0 && width >= 16 && height >= 20 && (
        <g data-preview-scrollbar="vertical">
          <rect x={x + width - 7} y={y + 4} width={4} height={verticalTrack}
            rx={2} fill="#d4dce6" opacity={0.8} />
          <rect x={x + width - 7}
            y={y + 4 + (verticalTrack - verticalThumb) * offset.y / range.y}
            width={4} height={verticalThumb} rx={2} fill="#627d9c" />
        </g>
      )}
      {range.x > 0 && height >= 16 && width >= 20 && (
        <g data-preview-scrollbar="horizontal">
          <rect x={x + 4} y={y + height - 7} width={horizontalTrack} height={4}
            rx={2} fill="#d4dce6" opacity={0.8} />
          <rect x={x + 4 + (horizontalTrack - horizontalThumb) * offset.x / range.x}
            y={y + height - 7} width={horizontalThumb} height={4}
            rx={2} fill="#627d9c" />
        </g>
      )}
    </g>
  );
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
  const [interactive, setInteractive] = useState(false);
  const [scopedState, setScopedState] = useState<PreviewScopedState>({ globals: {}, context: {} });
  const [scrollOffsets, setScrollOffsets] = useState<Record<string, PreviewScrollOffset>>({});
  const variables = useMemo(() => previewScopedSymbols(scopedState), [scopedState]);
  const [simulationMessage, setSimulationMessage] = useState("Simulation off. No behavior formulas are executed.");
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  useEffect(() => {
    setInteractive(false);
    setScopedState({ globals: {}, context: {} });
    setScrollOffsets({});
    setSimulationMessage("Simulation off. No behavior formulas are executed.");
  }, [screen]);

  function simulate(formula: unknown) {
    const result = simulateScopedPreviewBehavior(formula, scopedState);
    if (result.ok) setScopedState(result.state);
    setSimulationMessage(result.message);
  }

  function scrollItem(item: DrawItem, deltaX: number, deltaY: number): boolean {
    // Prefer the innermost host; at its boundary, allow an outer scroll host.
    for (const id of [item.control.id, ...[...item.ancestors].reverse()]) {
      const range = scrollRanges[id];
      if (!range) continue;
      const current = effectiveOffsets[id] ?? { x: 0, y: 0 };
      const next = previewWheelScroll(current, range, deltaX, deltaY);
      if (next.x === current.x && next.y === current.y) continue;
      setScrollOffsets(previous => ({
        ...previous,
        [id]: previewWheelScroll(previous[id], range, deltaX, deltaY)
      }));
      return true;
    }
    return false;
  }

  function selectControl(item: DrawItem) {
    const control = item.control;
    onSelect(control);
    if (interactive && mode === "visual" && control.properties.OnSelect) {
      const gate = previewSelectionBehaviorGate(control, item.renderSymbols, {
        ancestorVisibilityUnknown: item.visibilityUnknown,
        runtimeGalleryStateUnknown: item.runtimeGalleryStateUnknown,
        galleryRecordsUnknown: galleryRecordsUnknown(control)
      });
      if (gate === "allowed") {
        simulate(control.properties.OnSelect);
      } else if (gate === "visibility-unverified") {
        setSimulationMessage("OnSelect skipped: Visible is not confirmed for this control or an ancestor.");
      } else if (gate === "gallery-unverified") {
        setSimulationMessage("OnSelect skipped: gallery runtime records are unavailable.");
      } else {
        setSimulationMessage("OnSelect skipped: DisplayMode is not confirmed Edit.");
      }
    }
  }
  const { width, height } = PROFILES[profile];

  const rawItems = useMemo(
    () => screen ? flatten(screen.children, 0, 0, width, height, width, height,
      0, [], undefined, undefined, undefined, variables) : [],
    [screen, width, height, variables]
  );
  const scrollRanges = useMemo(() => previewScrollRanges(rawItems.map(item => ({
    id: item.control.id, ancestors: item.ancestors, x: item.x, y: item.y,
    width: item.width, height: item.height, dynamic: item.dynamic,
    visibilityUnknown: item.visibilityUnknown,
    editorGroup: item.control.controlType.toLowerCase() === "group",
    overflowX: item.control.properties.LayoutOverflowX,
    overflowY: item.control.properties.LayoutOverflowY,
    paddingRight: item.control.properties.PaddingRight,
    paddingBottom: item.control.properties.PaddingBottom,
    symbols: item.renderSymbols
  }))), [rawItems]);
  // Clamp previous offsets when the viewport changes; unknown geometry
  // cannot establish a scrollable content extent.
  const effectiveOffsets = useMemo(() => Object.fromEntries(
    Object.entries(scrollRanges).map(([id, range]) =>
      [id, previewClampScroll(scrollOffsets[id], range)])
  ) as Record<string, PreviewScrollOffset>, [scrollRanges, scrollOffsets]);
  const items = useMemo(() => rawItems.map(item => ({
    ...item, ...previewScrolledPosition(item, effectiveOffsets)
  })), [rawItems, effectiveOffsets]);
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
  // An unresolved Overflow formula is not evidence of Hide or Scroll. The
  // preview conservatively withholds scroll interaction, but must disclose
  // that the absence of a scrollbar is not verified Canvas behavior.
  const unknownOverflowHosts = visibleItems.filter(item =>
    isAutoLayout(item.control) && !item.visibilityUnknown && (
      previewOverflowMode(item.control.properties.LayoutOverflowX, item.renderSymbols) === "unknown" ||
      previewOverflowMode(item.control.properties.LayoutOverflowY, item.renderSymbols) === "unknown"
    )
  ).length;
  // An overlay belongs to its source control's stacking context, not to a
  // global SVG layer. Scrollbars must follow the host's last descendant so
  // they remain above its content but below later sibling controls.
  const scrollOverlayAnchorIds = previewScrollOverlayAnchors(
    visibleItems.map(item => ({ id: item.control.id, ancestors: item.ancestors })),
    new Set(Object.keys(scrollRanges))
  );
  const scrollOverlaysAt = new Map<string, DrawItem[]>();
  for (const [anchorId, hostIds] of scrollOverlayAnchorIds) {
    scrollOverlaysAt.set(anchorId, hostIds.flatMap(id => {
      const host = itemById.get(id);
      return host ? [host] : [];
    }));
  }

  function clipToAncestors(child: ReactNode, ancestors: readonly string[]): ReactNode {
    return ancestors.reduceRight<ReactNode>((node, ancestor) => {
      const parent = itemById.get(ancestor);
      // A Power Apps Group is an editor grouping, not a clipping container.
      if (!parent || !/(gallery|container|form|datacard)/i.test(parent.control.controlType))
        return node;
      const parentIndex = indexById.get(parent.control.id) ?? 0;
      return <g clipPath={`url(#${instanceId}-bounds-${parentIndex})`}>{node}</g>;
    }, child);
  }

  const unresolved = items.filter(item => item.dynamic).length;
  const runtimeVisibilityUnknown = items.filter(item => item.visibilityUnknown).length;

  if (!screen) {
    return (
      <main className="preview empty">
        <Icon name="screen" size={28} />
        <strong>No screen selected</strong>
        <span>Choose a screen from App explorer.</span>
      </main>
    );
  }

  // A screen's Fill is a Power Fx formula just like a control's Fill.
  // A white source-only fallback must not masquerade as the runtime color
  // when the formula depends on identity, SQL or other unavailable state.
  // https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-screen
  const resolvedScreenFill = previewColorWithSymbols(screen.properties.Fill, {
    "App.Width": width, "App.Height": height, ...variables
  }) ?? rgba(screen.properties.Fill);
  const screenFillUnknown = screen.properties.Fill != null && resolvedScreenFill === null;
  const fill = resolvedScreenFill ?? "#ffffff";
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
          <label className="preview-focus" title="Enable local-only, reversible behavior simulation">
            <input type="checkbox" checked={interactive} onChange={event => {
              setInteractive(event.target.checked);
              setScopedState({ globals: {}, context: {} });
              setSimulationMessage(event.target.checked ? "Local simulator ready. Click a control or run OnVisible." : "Simulation off. No behavior formulas are executed.");
            }} />
            Simulate local state
          </label>
          {interactive && <button type="button" className="simulation-action"
            onClick={() => simulate(screen.properties.OnVisible)}
            disabled={!screen.properties.OnVisible}>Run OnVisible</button>}
          {interactive && <button type="button" className="simulation-action"
            onClick={() => { setScopedState({ globals: {}, context: {} }); setSimulationMessage("Local state reset."); }}>Reset</button>}
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
            data-preview-screen-fill-state={screenFillUnknown ? "unknown" : undefined}
            role="img" aria-label={`${screen.name} canvas preview`}>
            <defs>
              {items.map((item, index) => (
                <clipPath key={item.control.id} id={`${instanceId}-bounds-${index}`}>
                  <path d={previewChildClipPath(item.control.properties,
                    item.x, item.y, item.width, item.height, item.renderSymbols)} />
                </clipPath>
              ))}
            </defs>
            <rect width={width} height={height} fill={fill} />
            {screenFillUnknown && <title>Screen Fill requires runtime state or is unsupported; white is a preview fallback, not a verified background</title>}
            {visibleItems.map(item => {
              const index = indexById.get(item.control.id) ?? 0;
              const selected = selectedId === item.control.id;
              const overflowXUnknown = isAutoLayout(item.control) && !item.visibilityUnknown &&
                previewOverflowMode(item.control.properties.LayoutOverflowX, item.renderSymbols) === "unknown";
              const overflowYUnknown = isAutoLayout(item.control) && !item.visibilityUnknown &&
                previewOverflowMode(item.control.properties.LayoutOverflowY, item.renderSymbols) === "unknown";
              const draw = (
                <g className="visual-control" key={item.control.id}
                  data-preview-overflow-x-state={overflowXUnknown ? "unknown" : undefined}
                  data-preview-overflow-y-state={overflowYUnknown ? "unknown" : undefined}
                  role="button" tabIndex={0}
                  aria-label={`Inspect ${item.control.name} (${item.control.controlType})`}
                  onClick={event => { event.stopPropagation(); selectControl(item); }}
                  onWheel={event => {
                    if (scrollItem(item, event.deltaX, event.deltaY)) event.stopPropagation();
                  }}
                  onKeyDown={event => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectControl(item);
                    }
                  }}>
                  {mode === "visual" && item.runtimeGalleryStateUnknown ? (
                    <>
                      <rect x={item.x} y={item.y} width={item.width} height={item.height}
                        fill="#f3f6fa" fillOpacity={0.8} stroke="#8194ac"
                        strokeDasharray="5 4" />
                      <text clipPath={`url(#${instanceId}-bounds-${index})`} x={item.x + 8} y={item.y + Math.min(20, item.height / 2 + 4)}
                        fontSize={12} fill="#42536b" pointerEvents="none">
                        Gallery state unknown — not an empty result
                      </text>
                    </>
                  ) : mode === "visual" && item.visibilityUnknown ? (
                    <>
                      <rect x={item.x} y={item.y} width={item.width} height={item.height}
                        fill="#fff9ed" fillOpacity={0.92} stroke="#b68c47"
                        strokeDasharray="5 4" />
                      <text clipPath={`url(#${instanceId}-bounds-${index})`} x={item.x + 8} y={item.y + Math.min(20, item.height / 2 + 4)}
                        fontSize={12} fill="#77531b" pointerEvents="none">
                        Visible unknown — runtime condition unavailable
                      </text>
                    </>
                  ) : mode === "visual" && galleryRecordsUnknown(item.control) ? (
                    <g data-preview-gallery-records="unknown">
                      {/* An Items formula is not proof that any runtime row was loaded.
                          Do not paint repeated empty cards as if they were records. */}
                      <CanvasVisualControl control={item.control} mediaAssets={mediaAssets}
                        simulationSymbols={item.renderSymbols}
                        x={item.x} y={item.y} width={item.width} height={item.height}
                        clipId={`${instanceId}-text-${index}`} />
                      <rect x={item.x} y={item.y} width={item.width} height={item.height}
                        fill="#f6f9fd" fillOpacity={0.96} stroke="#8194ac"
                        strokeDasharray="5 4" />
                      <text clipPath={`url(#${instanceId}-bounds-${index})`}
                        x={item.x + 12} y={item.y + Math.min(30, item.height / 2 + 5)}
                        fontSize={16} fontWeight={600} fill="#42536b" pointerEvents="none">
                        Runtime gallery records unavailable
                      </text>
                      <text clipPath={`url(#${instanceId}-bounds-${index})`}
                        x={item.x + 12} y={item.y + Math.min(52, item.height / 2 + 18)}
                        fontSize={12} fill="#52647c" pointerEvents="none">
                        Loading, emptiness and permissions are not verified
                      </text>
                    </g>
                  ) : mode === "visual" ? (
                    <CanvasVisualControl control={item.control} mediaAssets={mediaAssets}
                      simulationSymbols={item.renderSymbols}
                      x={item.x} y={item.y} width={item.width} height={item.height}
                      clipId={`${instanceId}-text-${index}`} />
                  ) : (
                    <>
                      <rect x={item.x} y={item.y} width={item.width} height={item.height}
                        rx={3} fill={wireframeColor(item.control.controlType)}
                        fillOpacity={0.07} stroke={wireframeColor(item.control.controlType)}
                        strokeWidth={1.5} strokeDasharray={item.dynamic ? "8 5" : undefined} />
                      <text clipPath={`url(#${instanceId}-bounds-${index})`} x={item.x + 5} y={item.y + Math.min(18, item.height / 2 + 3)}
                        fontSize={12} fill="#303846" pointerEvents="none">
                        {item.control.name.slice(0, 36)}
                      </text>
                    </>
                  )}
                  {selected && (
                    <rect x={item.x} y={item.y} width={item.width} height={item.height}
                      fill="none" stroke="#0067c0" strokeWidth={3} pointerEvents="none" />
                  )}
                  {/* React requires one text child for SVG title. Keep the
                      source name/type and uncertainty qualifiers intact. */}
                  <title>{[
                    item.control.name,
                    item.control.controlType,
                    item.dynamic ? "unresolved layout" : null,
                    item.visibilityUnknown ? "runtime visibility not verified" : null,
                    item.runtimeGalleryStateUnknown ? "AllItems unavailable; content intentionally withheld" : null,
                    overflowXUnknown ? "horizontal overflow unknown; scrolling not verified" : null,
                    overflowYUnknown ? "vertical overflow unknown; scrolling not verified" : null
                  ].filter(Boolean).join(" · ")}</title>
                </g>
              );
              const clipped = clipToAncestors(draw, item.ancestors);
              const template = mode === "structure" &&
                galleryRecordsUnknown(item.control) && !item.visibilityUnknown
                ? item.galleryTemplate
                : null;
              // A fallback for unresolved WrapCount/TemplateSize is not verified geometry.
              // Do not draw additional template slots when their positions are unknown.
              const slots = template && !template.dynamic ? Math.min(6, template.wrapCount) : 0;
              const guide = template && (
                <g pointerEvents="none"
                  clipPath={`url(#${instanceId}-bounds-${index})`}>
                  {Array.from({ length: Math.max(0, slots - 1) }, (_, slotIndex) => {
                    const rect = galleryTemplateGuideRect(template, slotIndex + 1, item.x, item.y);
                    return <rect key={slotIndex} x={rect.x} y={rect.y}
                      width={rect.width} height={rect.height}
                      rx={8} fill="none" stroke="#8194ac" strokeDasharray="6 5"
                      strokeWidth={1} opacity={0.55} />;
                  })}
                  <rect x={item.x + 7} y={item.y + (template.dynamic ? 7 : Math.max(0, Math.min(item.height - 25, template.height - 25)))}
                    width={Math.min(276, Math.max(0, item.width - 14))} height={22}
                    rx={4} fill="#edf3fa" stroke="#ccd7e4" />
                  <text x={item.x + 13}
                    y={item.y + (template.dynamic ? 7 : Math.max(0, Math.min(item.height - 25, template.height - 25))) + 15}
                    fontSize={11} fill="#42536b">
                    {template.dynamic
                      ? "Template geometry unknown — runtime formula or missing defaults"
                      : "Template only — runtime records unavailable"}
                  </text>
                  <title>Cannot determine loading, emptiness or access from source</title>
                </g>
              );
              return (
                <g key={item.control.id}>
                  {clipped}
                  {guide && clipToAncestors(guide, item.ancestors)}
                  {scrollOverlaysAt.get(item.control.id)?.map(host => {
                    const range = scrollRanges[host.control.id];
                    const offset = effectiveOffsets[host.control.id] ?? { x: 0, y: 0 };
                    const bar = <PreviewScrollIndicators x={host.x} y={host.y}
                      width={host.width} height={host.height}
                      range={range} offset={offset} />;
                    return <g key={host.control.id + "-scrollbar"}>
                      {clipToAncestors(bar, host.ancestors)}
                    </g>;
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <div className="preview-note">
        <span>{mode === "visual" ? "Static visual approximation" : "Control structure"}</span>
        <span>{visibleItems.length} drawn nodes · {unresolved} unresolved layouts</span>
        {mode === "visual" && visibleItems.some(item => galleryRecordsUnknown(item.control) && !item.visibilityUnknown) && (
          <span className="preview-unknown-state" role="status">
            Gallery rows unavailable — use Structure for template geometry
          </span>
        )}
        {mode === "visual" && screenFillUnknown && (
          <span className="preview-unknown-state" role="status">
            Screen Fill unknown — background color is a preview fallback
          </span>
        )}
        {runtimeVisibilityUnknown > 0 && (
          <span className="preview-unknown-state" role="status"
            title="Visible depends on runtime values unavailable from the Canvas source. These nodes are illustrative and may be hidden in the actual app.">
            {runtimeVisibilityUnknown} nodes with unknown runtime visibility — NOT verified as visible
          </span>
        )}
        {unknownOverflowHosts > 0 && (
          <span className="preview-unknown-state" role="status"
            title="A Canvas auto-layout overflow formula depends on unavailable runtime state. No scrollbar is simulated for that unresolved axis.">
            {unknownOverflowHosts} containers with unknown overflow — scrolling NOT verified
          </span>
        )}
        {interactive && <span className="simulation-status" aria-live="polite">
          {simulationMessage} · {Object.keys(variables).length} local variable(s)
        </span>}
        {interactive && (
          <details className="simulation-vars">
            <summary>Inspect state ({Object.keys(variables).length})</summary>
            <div className="simulation-vars-panel">
              <strong>Preview state · browser only</strong>
              {(["globals", "context"] as const).map(scope => (
                <div key={scope}>
                  <span className="simulation-vars-scope">{scope === "globals" ? "Global · Set" : "Screen · UpdateContext"}</span>
                  {Object.entries(scopedState[scope]).length === 0 ? (
                    <p>None</p>
                  ) : (
                    <dl>
                      {Object.entries(scopedState[scope]).map(([name, value]) => (
                        <div key={name}>
                          <dt>{name}</dt>
                          <dd>{JSON.stringify(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              ))}
              <small>Context variables take precedence when names overlap. No data source is queried.</small>
            </div>
          </details>
        )}
        {Object.keys(scrollRanges).length > 0 && (
          <span>Wheel scrolling is local to this preview; no runtime data is loaded.</span>
        )}
        <span>Gallery templates are illustrative; runtime records are not evaluated.</span>
        <span>Viewport profiles simulate dimensions; no formulas or connectors are executed.</span>
      </div>
    </main>
  );
}
