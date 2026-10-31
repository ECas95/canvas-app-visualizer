import type { ReactNode } from "react";
import type { CanvasControl } from "../types/canvas";
import {
  autoLayoutChildren, buildSiblingGeometrySymbols, controlRect, isAutoLayout,
  isGallery, type GalleryTemplateLayout
} from "../core/layout/layout";
import { previewChildClipPath } from "../core/layout/previewCorners";
import { previewVisibility } from "../core/layout/previewAppearance";
import { galleryReferencedFields, gallerySampleCells, galleryTemplatePlaceholderText }
  from "../core/layout/gallerySchemaPreview";
import { CanvasVisualControl } from "./CanvasVisualControl";

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
}

function mockTextControl(control: CanvasControl, sampleIndex: number): CanvasControl {
  const props = control.properties;
  const names = ["Text", "Label", "Default", "Value", "Placeholder", "HintText"];
  let changed: Record<string, unknown> | null = null;
  for (const key of names) {
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
  clipPrefix, sampleCount
}: Props) {
  const fields = galleryReferencedFields(gallery);
  const cells = template ? gallerySampleCells(template, x, y, sampleCount) : [];
  const galleryClip = clipPrefix + "-gallery";
  let paintedControlBudget = 240;

  function paint(
    children: CanvasControl[], ox: number, oy: number,
    parentWidth: number, parentHeight: number, sampleIndex: number,
    parent?: CanvasControl, depth = 0, prefix = ""
  ): ReactNode {
    if (depth >= 12) return null;
    const symbols = buildSiblingGeometrySymbols(children, {
      parentWidth, parentHeight, appWidth, appHeight,
      templateWidth: template?.width, templateHeight: template?.height
    });
    const context = {
      parentWidth, parentHeight, appWidth, appHeight,
      templateWidth: template?.width, templateHeight: template?.height, symbols
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
        ...symbols, "App.Width": appWidth, "App.Height": appHeight,
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
      const painted = mockTextControl(control, sampleIndex);
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
    <g data-preview-gallery-samples="synthetic" pointerEvents="none">
      <defs>
        <clipPath id={galleryClip}><rect x={x} y={y} width={width} height={height}/></clipPath>
      </defs>
      <g clipPath={"url(#" + galleryClip + ")"}>
        <rect x={x} y={y} width={width} height={height}
          fill="#f8fafc" stroke="#b8c8d9" />
        {cells.map(cell => (
          <g key={cell.index} data-sample-card={cell.index + 1}>
            {paint(gallery.children, cell.x, cell.y, cell.width, cell.height, cell.index)}
            <rect x={cell.x + 8} y={cell.y + 8} width={108} height={17}
              rx={4} fill="#fff3d6" stroke="#d29b39" opacity={0.96}/>
            <text x={cell.x + 14} y={cell.y + 20}
              fontSize={10} fontWeight={600} fill="#754b00">SAMPLE #{cell.index + 1}</text>
          </g>
        ))}
        <rect x={x} y={y + Math.max(0, height - 28)} width={width} height={28}
          fill="#fff2cf" opacity={0.96}/>
        <text x={x + 10} y={y + Math.max(20, height - 10)}
          fontSize={12} fontWeight={700} fill="#795114">
          TEMPLATE PREVIEW — synthetic cards only · no database rows or access verified
        </text>
      </g>
      <title>{[
        "Sample template fields: " + (fields.join(", ") || "No ThisItem columns found"),
        "Cards are placeholders, not loaded Gallery.Items or authorized records."
      ].join(". ")}</title>
    </g>
  );
}
