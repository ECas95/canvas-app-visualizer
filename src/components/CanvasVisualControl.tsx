import type { CanvasControl, PreviewMediaAsset } from "../types/canvas";
import { literalNumber } from "../core/layout/layout";
import { previewCornerRadii, previewRoundedRectPath } from "../core/layout/previewCorners";
import { staticBoolean, staticNumber, staticString } from "../core/powerfx/staticEval";
import type { PreviewVariables } from "../core/powerfx/previewBehavior";
import { previewImageFit, resolvePreviewImage } from "../core/layout/previewMedia";
import {
  previewColorWithSymbols, previewDisplayMode, previewFontFamily, previewFontSize, previewFontWeight, previewHorizontalAlign,
  previewIsChecked, previewItalic, previewKind, previewLabelWrap, previewText, previewTextDecoration,
  previewVerticalAlign
} from "../core/layout/previewAppearance";

interface Props {
  control: CanvasControl;
  mediaAssets?: PreviewMediaAsset[];
  simulationSymbols?: PreviewVariables;
  x: number;
  y: number;
  width: number;
  height: number;
  clipId: string;
}

export function CanvasVisualControl({
  control, x, y, width, height, clipId, mediaAssets = [], simulationSymbols
}: Props) {
  // Editor groups are organizational, not rendered Canvas controls.
  if (control.controlType.toLowerCase() === "group") return null;
  const props = control.properties;
  const kind = previewKind(control.controlType);
  const media = kind === "image" ? resolvePreviewImage(props.Image, mediaAssets) : undefined;
  const displayMode = previewDisplayMode(props.DisplayMode, simulationSymbols);
  const disabled = displayMode === "disabled";
  const explicitFill = previewColorWithSymbols(
    disabled ? props.DisabledFill ?? props.Fill : props.Fill, simulationSymbols
  );
  const foreground = previewColorWithSymbols(
    disabled ? props.DisabledColor ?? props.Color : props.Color, simulationSymbols
  ) ?? "#242424";
  const borderColor = previewColorWithSymbols(props.BorderColor, simulationSymbols);
  const thickness = literalNumber(props.BorderThickness);
  const rawText = kind === "input"
    ? props.Default ?? props.Value ?? props.HintText
    : kind === "select"
      ? props.Default ?? props.InputTextPlaceholder
      : props.Text ?? props.Label;
  const label = (simulationSymbols && staticString(rawText, simulationSymbols)) ?? previewText(control);
  const fontSize = previewFontSize(control, simulationSymbols);
  const fontFamily = previewFontFamily(control);
  // Bound pathological imported strings while retaining normal multiline labels.
  const text = label?.slice(0, 4096);
  const inset = Math.min(12, Math.max(3, width * 0.04));
  const corners = previewCornerRadii(props, width, height);
  const outline = previewRoundedRectPath(x, y, width, height, corners);
  const selected = simulationSymbols
    ? [props.Default, props.Checked, props.Value].some(value => staticBoolean(value, simulationSymbols) === true)
    : previewIsChecked(control);
  const horizontalAlign = previewHorizontalAlign(control);
  const verticalAlign = previewVerticalAlign(control);
  const fontWeight = previewFontWeight(control);
  const italic = previewItalic(control);
  const textDecoration = previewTextDecoration(control);
  const wraps = previewLabelWrap(control, simulationSymbols);
  const padding = (raw: unknown) => Math.max(0, staticNumber(raw, simulationSymbols) ?? 0);

  function alignedTextPoint(defaultX: number, defaultAnchor: "start" | "middle" | "end") {
    const anchor = horizontalAlign ?? defaultAnchor;
    if (!horizontalAlign) return { x: defaultX, anchor };
    if (anchor === "middle") return { x: x + width / 2, anchor };
    if (anchor === "end") return { x: x + width - inset, anchor };
    return { x: x + inset, anchor };
  }

  function alignedY(defaultY: number): number {
    const topPadding = Math.max(0, literalNumber(props.PaddingTop) ?? 0);
    const bottomPadding = Math.max(0, literalNumber(props.PaddingBottom) ?? 0);
    if (verticalAlign === "top") return y + topPadding + fontSize / 2;
    if (verticalAlign === "bottom") return y + height - bottomPadding - fontSize / 2;
    if (verticalAlign === "middle") return y + height / 2;
    return defaultY;
  }

  const isContainer = kind === "container" || kind === "gallery" || kind === "form";
  const defaultFill =
    kind === "button" ? "#0f6cbd" :
    kind === "input" || kind === "select" || kind === "form" || kind === "gallery" ? "#ffffff" :
    kind === "container" || kind === "label" || kind === "icon" ? "transparent" :
    kind === "shape" ? "#e5e7eb" : "#f5f6f8";
  const fill = explicitFill ?? defaultFill;
  const stroke = borderColor ?? (
    kind === "input" || kind === "select" ? "#9299a3" :
    kind === "form" || kind === "gallery" ? "#d8dce2" :
    kind === "unknown" ? "#9ca3af" : "transparent"
  );

  const basicRect = (
    <path d={outline}
      fill={fill} stroke={stroke}
      strokeWidth={thickness ?? (stroke === "transparent" ? 0 : 1)}
    />
  );

  const svgText = (
    value: string,
    atX = x + inset,
    anchor: "start" | "middle" | "end" = "start",
    color = foreground,
    atY = y + height / 2
  ) => {
    const point = alignedTextPoint(atX, anchor);
    const lines = value.split(/\r?\n/).slice(0, 5);
    const lineHeight = fontSize * 1.2;
    const centralY = alignedY(atY);
    const firstY = centralY - ((lines.length - 1) * lineHeight) / 2;
    return (
      <text x={point.x} y={firstY} dominantBaseline="middle"
        textAnchor={point.anchor} fill={color} fontFamily={fontFamily}
        fontSize={fontSize} fontWeight={fontWeight}
        fontStyle={italic ? "italic" : undefined}
        textDecoration={textDecoration}>
        {lines.map((line, index) => (
          <tspan key={index} x={point.x} dy={index === 0 ? 0 : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    );
  };

  return (
    <g opacity={disabled ? 0.66 : displayMode === "view" ? 0.86 : 1}>
      <defs>
        <clipPath id={clipId}>
          <path d={previewRoundedRectPath(
            x + 1, y + 1, Math.max(0, width - 2), Math.max(0, height - 2), corners
          )}/>
        </clipPath>
      </defs>
      {kind === "shape" && control.controlType.toLowerCase().includes("circle")
        ? <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2}
            fill={fill} stroke={stroke} strokeWidth={thickness ?? 0} />
        : kind === "label" || kind === "icon" ? (
          explicitFill ? basicRect : null
        ) : basicRect}

      <g clipPath={`url(#${clipId})`}>
        {kind === "button" && svgText(text ?? (props.Text ? "…" : "Button"), x + width / 2, "middle",
          previewColorWithSymbols(
            disabled ? props.DisabledColor ?? props.Color : props.Color, simulationSymbols
          ) ?? (disabled ? "#555555" : "#ffffff"))}
        {kind === "label" && text && (wraps ? (
          // HTML layout measures glyphs in the browser: SVG <text> does not wrap.
          // Only serialized Wrap=true (or a provably true local expression) opts in.
          <foreignObject x={x} y={y} width={width} height={height} pointerEvents="none">
            <div style={{
              boxSizing: "border-box", display: "flex", width: "100%", height: "100%",
              overflow: "hidden",
              alignItems: verticalAlign === "top" ? "flex-start" :
                verticalAlign === "bottom" ? "flex-end" : "center",
              paddingTop: padding(props.PaddingTop),
              paddingRight: padding(props.PaddingRight),
              paddingBottom: padding(props.PaddingBottom),
              paddingLeft: padding(props.PaddingLeft),
              color: foreground, fontFamily, fontSize,
              fontWeight, fontStyle: italic ? "italic" : undefined,
              textDecoration
            }}>
              <span style={{
                display: "block", width: "100%", whiteSpace: "pre-wrap",
                overflowWrap: "break-word", wordBreak: "normal",
                textAlign: horizontalAlign === "middle" ? "center" :
                  horizontalAlign === "end" ? "right" : "left"
              }}>{text}</span>
            </div>
          </foreignObject>
        ) : svgText(text))}
        {kind === "input" && svgText(text ?? (props.Default || props.Value ? "…" : ""),
          x + inset, "start", previewColorWithSymbols(props.Color, simulationSymbols) ??
          (label ? "#242424" : "#7f8792"))}
        {kind === "select" && (
          <>
            {svgText(text ?? "", x + inset)}
            <path d={`M ${x + width - 20} ${y + height / 2 - 3} l 5 6 l 5 -6`}
              fill="none" stroke="#5b6470" strokeWidth="1.6" />
          </>
        )}
        {kind === "checkbox" && (
          <>
            <rect x={x + 5} y={y + (height - 18) / 2} width={18} height={18}
              rx={3} fill={selected ? "#0f6cbd" : "#ffffff"}
              stroke={selected ? "#0f6cbd" : "#737b86"}/>
            {selected && <path d={`M ${x + 9} ${y + height / 2} l 4 4 l 7 -9`}
              stroke="white" strokeWidth={2} fill="none"/>}
            {text && svgText(text, x + 29)}
          </>
        )}
        {kind === "toggle" && (
          <>
            <rect x={x + 4} y={y + (height - 20) / 2} width={38} height={20} rx={10}
              fill={selected ? "#0f6cbd" : "#999fa8"}/>
            <circle cx={x + (selected ? 30 : 15)} cy={y + height / 2} r={7}
              fill="#ffffff"/>
            {text && svgText(text, x + 50)}
          </>
        )}
        {kind === "icon" && svgText(
          String(props.Icon ?? "").toLowerCase().includes("add") ? "+" :
          String(props.Icon ?? "").toLowerCase().includes("search") ? "⌕" : "◇",
          x + width / 2, "middle", foreground, y + height / 2
        )}
        {kind === "image" && (
          media ? (
            <image x={x} y={y} width={width} height={height}
              href={media.dataUrl}
              preserveAspectRatio={previewImageFit(props.ImagePosition)} />
          ) : (
            <>
            <rect x={x + 6} y={y + 6} width={Math.max(4, width - 12)}
              height={Math.max(4, height - 12)} rx={3} fill="#eaf0f5" stroke="#abb7c4"/>
            <path d={`M ${x + 12} ${y + height - 16} l ${Math.max(5, width * .28)} -${Math.max(5, height * .36)} l ${Math.max(5, width * .18)} ${Math.max(5, height * .2)} l ${Math.max(5, width * .16)} -${Math.max(5, height * .2)}`}
              fill="none" stroke="#7d90a4" strokeWidth={2}/>
            <circle cx={x + Math.min(width - 12, 24)} cy={y + 22} r={4} fill="#9ab0c5"/>
            </>
          )
        )}
        {kind === "unknown" && (
          <>{svgText(control.name, x + 8, "start", "#606977")}</>
        )}
      </g>
      {isContainer && explicitFill === null && (
        <path d={outline}
          fill="none" stroke="#a8b0bd" strokeWidth="0.6" strokeDasharray="3 5"
          opacity={kind === "container" ? .3 : .6} />
      )}
    </g>
  );
}
