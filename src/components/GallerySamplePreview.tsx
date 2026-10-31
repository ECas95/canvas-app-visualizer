import type { ReactNode } from "react";
import { staticString } from "../core/powerfx/staticEval";
import type { CanvasControl, PreviewMediaAsset } from "../types/canvas";
import {
  autoLayoutChildren, buildSiblingGeometrySymbols, controlRect, isAutoLayout,
  isGallery, type GalleryTemplateLayout
} from "../core/layout/layout";
import { previewChildClipPath } from "../core/layout/previewCorners";
import { previewColorWithSymbols, previewVisibility } from "../core/layout/previewAppearance";
import { galleryReferencedFields, gallerySampleCells, galleryTemplatePlaceholderText }
  from "../core/layout/gallerySchemaPreview";
import { CanvasVisualControl } from "./CanvasVisualControl";
import { localGalleryRowSymbols, type GalleryLocalRow } from "../core/layout/galleryLocalSnapshot";

interface Props {
  gallery: CanvasControl;
  template: GalleryTemplateLayout | null;
  x: number;
  y: number;
  width: number;
  height: number;
  appWidth: number;
  appHeight: number;
  clipPrefix: string;
  sampleCount: number;
  localRows?: GalleryLocalRow[];
  mediaAssets?: PreviewMediaAsset[];
}

function mockTextControl(control: CanvasControl, sampleIndex: number,
  rowSymbols: Record<string, string | number | boolean>): CanvasControl {
  const props = control.properties;
  const names = ["Text", "Label", "Default", "Value", "Placeholder", "HintText"];
  let changed: Record<string, unknown> | null = null;
  for (const key of names) {
    // Keep the actual Power Fx formula when a user-provided scalar row can
    // resolve it. Otherwise use a clearly labelled field-name placeholder.
    if (staticString(props[key], rowSymbols) !== null) continue;
    const text = galleryTemplatePlaceholderText(props[key], sampleIndex);
    if (text) {
      changed ??= { ...props };
      changed[key] = '="' + text.replaceAll('"', '""') + '"';
    }
  }
  return changed ? { ...control, properties: changed } : control;
}

/** Paint source-defined template controls in simulated cells, not SQL rows. */
export function GallerySamplePreview({
  gallery, template, x, y, width, height, appWidth, appHeight,
  clipPrefix, sampleCount, localRows, mediaAssets = []
}: Props) {
  const fields = galleryReferencedFields(gallery);
  const cells = template ? gallerySampleCells(template, x, y,
    localRows ? localRows.length : sampleCount) : [];
  const galleryClip = clipPrefix + "-gallery";
  let paintedControlBudget = 240;

  function paint(
    children: CanvasControl[], ox: number, oy: number,
    parentWidth: number, parentHeight: number, sampleIndex: number,
    parent?: CanvasControl, depth = 0, prefix = ""
  ): ReactNode {
    if (depth >= 12) return null;
    const rowSymbols = localRows?.[sampleIndex]
      ? localGalleryRowSymbols(localRows[sampleIndex]) : {};
    const symbols = buildSiblingGeometrySymbols(children, {
      parentWidth, parentHeight, appWidth, appHeight,
      templateWidth: template?.width, templateHeight: template?.height,
      symbols: rowSymbols
    });
    const context = {
      parentWidth, parentHeight, appWidth, appHeight,
      templateWidth: template?.width, templateHeight: template?.height,
      symbols: { ...symbols, ...rowSymbols }
    };
    const positioned = parent && isAutoLayout(parent)
      ? autoLayoutChildren(parent, context)
      : children.map((control, index) => ({ control, rect: controlRect(control, index, context) }));

    return positioned.slice(0, 120).map(({ control, rect }, index) => {
      if (paintedControlBudget-- <= 0) return null;
      const cx = ox + rect.x, cy = oy + rect.y;
      const key = prefix + "-" + sampleIndex + "-" + index;
      const clipId = clipPrefix + "-node-" + key.replace(/[^a-zA-Z0-9_-]/g, "");
      const renderSymbols = {
        ...symbols, ...rowSymbols, "App.Width": appWidth, "App.Height": appHeight,
        "Parent.Width": parentWidth, "Parent.Height": parentHeight,
        "Parent.TemplateWidth": template?.width ?? parentWidth,
        "Parent.TemplateHeight": template?.height ?? parentHeight,
        "Self.Width": rect.width, "Self.Height": rect.height,
        "Self.X": rect.x, "Self.Y": rect.y
      };
      const visibility = previewVisibility(control, renderSymbols);
      if (visibility === "hidden") return null;
      // No ThisItem values are invented: only the field name is inserted in
      // visibly bracketed sample text. Actual formula and control remain intact.
      const painted = mockTextControl(control, sampleIndex, rowSymbols);
      const descendants = control.children.length > 0 && !isGallery(control)
        ? paint(control.children,
            control.controlType.toLowerCase() === "group" ? ox : cx,
            control.controlType.toLowerCase() === "group" ? oy : cy,
            control.controlType.toLowerCase() === "group" ? parentWidth : rect.width,
            control.controlType.toLowerCase() === "group" ? parentHeight : rect.height,
            sampleIndex, control, depth + 1, key)
        : null;
      const clipChildren = /(?:container|form|datacard)/i.test(control.controlType);
      return (
        <g key={key} data-sample-template-control={control.name}
          data-sample-visibility={visibility} pointerEvents="none">
          <CanvasVisualControl control={painted} simulationSymbols={renderSymbols}
            mediaAssets={mediaAssets}
            x={cx} y={cy} width={rect.width} height={rect.height}
            clipId={clipId + "-text"} />
          {descendants && clipChildren ? (
            <g>
              <defs>
                <clipPath id={clipId + "-children"}>
                  <path d={previewChildClipPath(control.properties,
                    cx, cy, rect.width, rect.height, renderSymbols)} />
                </clipPath>
              </defs>
              <g clipPath={"url(#" + clipId + "-children)"}>{descendants}</g>
            </g>
          ) : descendants}
        </g>
      );
    });
  }

  if (!template || cells.length === 0) {
    return (
      <g data-preview-gallery-samples="unresolved" pointerEvents="none">
        <rect x={x} y={y} width={width} height={height}
          fill="#f5f8fc" stroke="#8194ac" strokeDasharray="6 4"/>
        <text x={x + 12} y={y + 26} fontSize={13} fill="#475569">
          Gallery template geometry unresolved — sample cards withheld
        </text>
      </g>
    );
  }
  return (
    <g data-preview-gallery-samples={localRows ? "local-snapshot" : "synthetic"} pointerEvents="none">
      <defs>
        <clipPath id={galleryClip}><rect x={x} y={y} width={width} height={height}/></clipPath>
      </defs>
      <g clipPath={"url(#" + galleryClip + ")"}>
        <rect x={x} y={y} width={width} height={height}
          fill="#f8fafc" stroke="#b8c8d9" />
        {cells.map(cell => {
          const rowSymbols = localRows?.[cell.index]
            ? localGalleryRowSymbols(localRows[cell.index]) : {};
          const sourceFill = gallery.properties.TemplateFill;
          const templateFill = sourceFill === undefined ? null
            : previewColorWithSymbols(sourceFill, {
              ...rowSymbols, "App.Width": appWidth, "App.Height": appHeight,
              "Parent.TemplateWidth": cell.width,
              "Parent.TemplateHeight": cell.height
            });
          return (
          <g key={cell.index} data-sample-card={cell.index + 1}
            data-template-fill-state={sourceFill === undefined ? "omitted"
              : templateFill === null ? "unknown" : "verified"}>
            {templateFill !== null && <rect x={cell.x} y={cell.y}
              width={cell.width} height={cell.height}
              fill={templateFill} data-preview-gallery-template-fill="verified" />}
            {paint(gallery.children, cell.x, cell.y, cell.width, cell.height, cell.index)}
            <rect x={cell.x + 8} y={cell.y + 8} width={108} height={17}
              rx={4} fill="#fff3d6" stroke="#d29b39" opacity={0.96}/>
            <text x={cell.x + 14} y={cell.y + 20}
              fontSize={10} fontWeight={600} fill="#754b00">
              {localRows ? "LOCAL #" : "SAMPLE #"}{cell.index + 1}</text>
          </g>
          );
        })}
        <rect x={x} y={y + Math.max(0, height - 28)} width={width} height={28}
          fill="#fff2cf" opacity={0.96}/>
        <text x={x + 10} y={y + Math.max(20, height - 10)}
          fontSize={12} fontWeight={700} fill="#795114">
          {localRows
            ? "LOCAL JSON PREVIEW — unverified data and permissions · no connector executed"
            : "TEMPLATE PREVIEW — synthetic cards only · no database rows or access verified"}
        </text>
      </g>
      <title>{[
        "Sample template fields: " + (fields.join(", ") || "No ThisItem columns found"),
        localRows
          ? "Rows come from a local file; they are not confirmed Gallery.Items or authorized records."
          : "Cards are placeholders, not loaded Gallery.Items or authorized records."
      ].join(". ")}</title>
    </g>
  );
}
