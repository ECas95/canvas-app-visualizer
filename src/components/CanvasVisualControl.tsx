import type { CanvasControl, PreviewMediaAsset } from "../types/canvas";
import { previewChildClipPath, previewCornerRadii, previewCornerRadiusUnverified, previewRoundedRectPath } from "../core/layout/previewCorners";
import { previewSvgTextWindow } from "../core/layout/previewSvgTextWindow";
import { previewBoundedText } from "../core/layout/previewTextBounds";
import { staticBoolean, staticNumber } from "../core/powerfx/staticEval";
import type { PreviewVariables } from "../core/powerfx/previewBehavior";
import { previewImageFit, previewImageFlipTransform, previewImagePosition, previewImageRotationTransform, previewImageSourceState, previewRasterCssImage, resolvePreviewImage } from "../core/layout/previewMedia";
import { PREVIEW_ICON_PATHS, previewIconName, previewIconRotation } from "../core/layout/previewIcon";
import {
  previewBorderStyle, previewColorWithSymbols, previewDisplayMode, previewDropShadow, previewDropShadowFilter, previewIsOpaqueColor, previewFontFamily, previewFontSize, previewFontWeight, previewHorizontalAlign,
  previewCheckedState, previewFontFamilyIsKnown, previewFontSizeIsKnown, previewInputContent, previewSelectContent, previewItalic, previewKind, previewLabelWrap, previewText, previewTextDecoration, previewTextStyleSource,
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
  // Microsoft .pa.yaml uses ModernIcon@1.1.0 (not only Modern/Icon).
  // Modern Icon.Icon is a Fluent string and its color is IconColor.
  const isModernIcon = kind === "icon" && /^modern\/?icon(?:@|$)/i.test(control.controlType);
  const isModernText = kind === "label" && /^moderntext(?:@|$)/i.test(control.controlType);
  const media = kind === "image" ? resolvePreviewImage(props.Image, mediaAssets, simulationSymbols) : undefined;
  const imageSourceState = kind === "image"
    ? previewImageSourceState(props.Image, mediaAssets, simulationSymbols) : null;
  const imagePosition = kind === "image"
    ? (props.ImagePosition == null ? "fit" : previewImagePosition(props.ImagePosition, simulationSymbols))
    : null;
  // Native-size Center/Tile use a browser raster background. The importer
  // supplies only bounded local PNG/JPEG/GIF/WebP data URLs, never remote URLs.
  const imageFlip = kind === "image" ? previewImageFlipTransform(
    props.FlipHorizontal, props.FlipVertical, x, y, width, height, simulationSymbols
  ) : null;
  const imageRotation = kind === "image" && media ? previewImageRotationTransform(
    props.ImageRotation, x, y, width, height, simulationSymbols
  ) : null;
  const rasterCssImage = media && (imagePosition === "center" || imagePosition === "tile")
    ? previewRasterCssImage(media.dataUrl) : null;
  // A locally imported image is not proof of its final appearance: position,
  // flip and rotation may still depend on SQL or another runtime-only value.
  // Withhold the bitmap instead of silently presenting unknown transforms as
  // the default Fit / unrotated / unflipped state.
  const imageTransformUnknown = kind === "image" && !!media &&
    (imagePosition === null || imageFlip === null || imageRotation === null);
  const imageUnknown = imageSourceState === "runtime-unknown" || imageTransformUnknown;
  // Microsoft documents that ModernText keeps DisplayMode only for backward
  // compatibility: it has no visual or interaction effect on this display-only
  // control. Do not dim verified text, use DisabledFill/DisabledColor, or
  // imply a runtime permission check for an ignored legacy property.
  // https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/modern-controls/modern-control-text
  const displayMode = kind === "label" && /^moderntext(?:@|$)/i.test(control.controlType)
    ? "edit" : previewDisplayMode(props.DisplayMode, simulationSymbols);
  const disabled = displayMode === "disabled";
  const explicitFill = previewColorWithSymbols(
    disabled ? props.DisabledFill ?? props.Fill : props.Fill, simulationSymbols
  );
  // Canvas foreground Color is a Power Fx formula too. A fallback text/icon
  // color is only illustrative when its explicit source depends on runtime
  // state or uses an unsupported expression. ModernIcon prefers IconColor;
  // known Disabled mode prefers DisabledColor for classic controls.
  // https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-colors
  const foregroundSource = isModernIcon ? props.IconColor ?? props.Color :
    disabled ? props.DisabledColor ?? props.Color :
    isModernText ? props.Color ?? props.FontColor : props.Color;
  const resolvedForeground = previewColorWithSymbols(foregroundSource, simulationSymbols);
  const foreground = resolvedForeground ?? "#242424";
  const borderColor = previewColorWithSymbols(props.BorderColor, simulationSymbols);
  // BorderThickness is a Power Fx numeric formula, not necessarily a literal.
  // Resolve only known viewport/local values; never infer a SQL/runtime result.
  // Negative or unresolved widths cannot be rendered as verified borders.
  const resolvedThickness = staticNumber(props.BorderThickness, simulationSymbols);
  const thickness = resolvedThickness !== null && resolvedThickness >= 0
    ? resolvedThickness : null;
  const borderStyle = previewBorderStyle(props.BorderStyle, simulationSymbols);
  // Explicit runtime-dependent paint is not a verified Canvas default.
  // Preserve the visual fallback, but expose its uncertainty.
  const fillSource = disabled ? props.DisabledFill ?? props.Fill : props.Fill;
  const fillUnknown = fillSource != null && explicitFill === null;
  const borderUnknown =
    (props.BorderColor != null && borderColor === null) ||
    (props.BorderThickness != null && thickness === null) ||
    (props.BorderStyle != null && borderStyle === null);
  const rawText = kind === "select"
    ? props.Default ?? props.InputTextPlaceholder
    : props.Text ?? props.Label;
  // Empty Default is not an empty label: it selects HintText/Placeholder.
  // Keep the input's value/hint/unknown state separate from generic text.
  const inputContent = kind === "input" ? previewInputContent(control, simulationSymbols) : null;
  const selectContent = kind === "select" ? previewSelectContent(control, simulationSymbols) : null;
  const label = inputContent
    ? inputContent.text
    : selectContent
      ? selectContent.text
      : previewText(control, simulationSymbols);
  const fontSize = previewFontSize(control, simulationSymbols);
  const fontFamily = previewFontFamily(control, simulationSymbols);
  // Source-only preview cannot assert a fallback font or size is the runtime
  // appearance. Keep a usable approximation, but label it as unverified.
  const textBearing = kind === "label" || kind === "button" || kind === "input" ||
    kind === "select" || kind === "checkbox" || kind === "toggle";
  const foregroundUnknown = (textBearing || kind === "icon") &&
    foregroundSource != null && resolvedForeground === null;
  const fontUnknown = textBearing && !previewFontFamilyIsKnown(control, simulationSymbols);
  const fontSizeUnknown = textBearing && !previewFontSizeIsKnown(control, simulationSymbols);
  // Limit only painted text, not the verified source value. Keep a visible
  // truncation state so the preview never presents partial text as complete.
  // Count Unicode code points to avoid splitting an emoji/surrogate pair.
  const { text, truncated: textTruncated } = previewBoundedText(label);
  // A serialized Text formula can depend on SQL, user identity, or other
  // runtime state. An unresolved value is not a verified empty string.
  // Keep the uncertainty visible without evaluating external dependencies.
  const labelTextUnknown = kind === "label" && rawText !== undefined &&
    rawText !== null && label === null;
  // A Button.Text expression can depend on SQL, identity or runtime state.
  // Keep the ellipsis as an explicitly unverified placeholder, not a label.
  const buttonTextUnknown = kind === "button" && rawText !== undefined &&
    rawText !== null && label === null;
  const inset = Math.min(12, Math.max(3, width * 0.04));
  const corners = previewCornerRadii(props, width, height, simulationSymbols);
  const radiusUnverified = previewCornerRadiusUnverified(props, simulationSymbols);
  const outline = previewRoundedRectPath(x, y, width, height, corners);
  const checkedState = (kind === "checkbox" || kind === "toggle")
    ? previewCheckedState(control, simulationSymbols) : "unchecked";
  const selected = checkedState === "checked";
  const checkedUnknown = checkedState === "unknown";
  const horizontalAlign = previewHorizontalAlign(control, simulationSymbols);
  const verticalAlign = previewVerticalAlign(control, simulationSymbols);
  const fontWeight = previewFontWeight(control, simulationSymbols);
  const italic = previewItalic(control, simulationSymbols);
  const textDecoration = previewTextDecoration(control, simulationSymbols);
  const wraps = previewLabelWrap(control, simulationSymbols);
  // The legacy ModernText aliases and current style properties are source
  // formulas, not necessarily known values. Keep the existing safe fallback
  // while marking the exact styling dimensions that cannot be verified.
  // https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/properties-text
  const unknownTextStyleProperties = textBearing ? [
    ["FontWeight", previewTextStyleSource(control, "FontWeight") != null && fontWeight === undefined],
    ["Italic", previewTextStyleSource(control, "Italic") != null &&
      staticBoolean(previewTextStyleSource(control, "Italic"), simulationSymbols) === null],
    ["Underline", previewTextStyleSource(control, "Underline") != null &&
      staticBoolean(previewTextStyleSource(control, "Underline"), simulationSymbols) === null],
    ["Strikethrough", previewTextStyleSource(control, "Strikethrough") != null &&
      staticBoolean(previewTextStyleSource(control, "Strikethrough"), simulationSymbols) === null],
    ["Align", (props.Align ?? props.TextAlign) != null && horizontalAlign === null],
    ["VerticalAlign", (props.VerticalAlign ?? props.TextVerticalAlignment) != null &&
      verticalAlign === null]
  ].filter((entry): entry is [string, boolean] => typeof entry[0] === "string" && entry[1] === true)
    .map(([name]) => name) : [];
  // Classic Canvas labels expose LineHeight as a font-relative multiplier.
  // Evaluate only a source-verifiable number (including known App.Width).
  // An unsupported or runtime-dependent formula must remain explicitly unknown.
  // https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/properties-text
  const sourceLineHeight = kind === "label" && props.LineHeight != null
    ? staticNumber(props.LineHeight, simulationSymbols) : null;
  const lineHeightKnown = kind !== "label" || props.LineHeight == null ||
    (sourceLineHeight !== null && sourceLineHeight > 0 && sourceLineHeight <= 10);
  const lineHeightFactor = lineHeightKnown && sourceLineHeight !== null
    ? sourceLineHeight : 1.2;
  // An unresolved Wrap formula is not proof that the text is single-line.
  // Keep the existing conservative SVG fallback, but expose its uncertainty.
  const wrapUnknown = kind === "label" && props.Wrap != null &&
    staticBoolean(props.Wrap, simulationSymbols) === null;
  // Canvas text padding can be a responsive Power Fx expression. An explicit
  // runtime-only or invalid value is not proof of zero/default padding:
  // retain the current safe visual fallback, but identify the affected edges.
  // Omitted properties are version-specific defaults, not runtime unknowns.
  // https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/properties-size-location
  const unverifiedPaddingEdges = textBearing
    ? (["PaddingTop", "PaddingRight", "PaddingBottom", "PaddingLeft"] as const)
        .filter(edge => {
          const raw = props[edge];
          if (raw == null) return false;
          const resolved = staticNumber(raw, simulationSymbols);
          return resolved === null || !Number.isFinite(resolved) || resolved < 0;
        })
    : [];
  const padding = (raw: unknown) => Math.max(0, staticNumber(raw, simulationSymbols) ?? 0);

  // Power Apps aligns text inside the content box after source padding.
  // Preserve the old approximate inset only when no static padding is known.
  // Checkbox/toggle labels use their own icon offset, not the host's text inset.
  function alignedTextPoint(defaultX: number, defaultAnchor: "start" | "middle" | "end") {
    // SVG text cannot justify; retain a deterministic left-aligned fallback.
    // Wrapped labels use browser text layout below for real justification.
    const anchor = horizontalAlign === "justify" ? "start" : horizontalAlign ?? defaultAnchor;
    const sourceInset = (raw: unknown) => {
      const resolved = staticNumber(raw, simulationSymbols);
      return resolved !== null && Number.isFinite(resolved) ? Math.max(0, resolved) : inset;
    };
    const left = sourceInset(props.PaddingLeft);
    const right = sourceInset(props.PaddingRight);
    if (anchor === "middle") return { x: x + (width + left - right) / 2, anchor };
    if (anchor === "end") return { x: x + width - right, anchor };
    if (horizontalAlign || defaultX === x + inset) return { x: x + left, anchor };
    return { x: defaultX, anchor };
  }

  // Anchor the complete multiline block, not its center, to Top/Bottom.
  // The former center-first calculation shifted the first line above Top
  // padding and the last line below Bottom padding when text had newlines.
  function firstTextLineY(defaultY: number, lineCount: number, lineHeight: number): number {
    const topPadding = padding(props.PaddingTop);
    const bottomPadding = padding(props.PaddingBottom);
    if (verticalAlign === "top") return y + topPadding + fontSize / 2;
    if (verticalAlign === "bottom") {
      return y + height - bottomPadding - fontSize / 2 - (lineCount - 1) * lineHeight;
    }
    const centerY = verticalAlign === "middle"
      ? y + (height + topPadding - bottomPadding) / 2 : defaultY;
    return centerY - ((lineCount - 1) * lineHeight) / 2;
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

  // A known BorderStyle.None suppresses even an explicitly colored/thick border.
  // Unsupported or runtime-dependent styles retain the existing approximation.
  const borderWidth = borderStyle === "none" ? 0 :
    thickness ?? (stroke === "transparent" ? 0 : 1);
  const borderDasharray = borderStyle === "dashed"
    ? `${Math.max(2, borderWidth * 3)} ${Math.max(2, borderWidth * 2)}`
    : borderStyle === "dotted"
      ? `0 ${Math.max(2, borderWidth * 2)}` : undefined;

  // The source DropShadow enum applies to Canvas containers, not to text
  // or arbitrary controls. Apply the approximate SVG filter to the host
  // outline only (never its children), and only with a known opaque fill.
  // Runtime-dependent shadow formulas and transparent backgrounds stay unset.
  const isShadowHost = kind === "container" &&
    control.controlType.toLowerCase().includes("groupcontainer");
  const shadowLevel = isShadowHost && props.DropShadow != null
    ? previewDropShadow(props.DropShadow, simulationSymbols) : null;
  // An unresolved DropShadow formula is not proof of DropShadow.None.
  // Conversely, a known non-None enum may still be omitted by our
  // conservative SVG fallback when the source fill is not provably opaque.
  const shadowState = isShadowHost && props.DropShadow != null
    ? shadowLevel === null ? "unknown"
      : shadowLevel !== "none" && !previewIsOpaqueColor(explicitFill)
        ? "not-rendered" : undefined
    : undefined;
  const shadowFilter = isShadowHost && previewIsOpaqueColor(explicitFill)
    ? previewDropShadowFilter(props.DropShadow, simulationSymbols)
    : undefined;

  const basicRect = (
    <path d={outline}
      fill={fill} stroke={stroke}
      strokeWidth={borderWidth} strokeDasharray={borderDasharray}
      strokeLinecap={borderStyle === "dotted" ? "round" : undefined}
      style={shadowFilter ? { filter: shadowFilter } : undefined}
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
    const lineHeight = fontSize * lineHeightFactor;
    // Preserve the source lines around the clipped viewport. Truncating from
    // the beginning incorrectly shows the first lines for Bottom/Middle text.
    // Use the original block's baseline so overflow remains positioned as in
    // the full Canvas label; never synthesize lines or runtime values.
    const { lines, firstIndex, totalLines } = previewSvgTextWindow(
      value, height, lineHeight, verticalAlign
    );
    const firstY = firstTextLineY(atY, totalLines, lineHeight) + firstIndex * lineHeight;
    return (
      <text x={point.x} y={firstY} dominantBaseline="middle"
        // SVG defaults to collapsing repeated/edge spaces. Canvas Text source
        // literals retain whitespace; Wrap=false must not introduce wrapping.
        // CSS white-space is the SVG 2 replacement for deprecated xml:space.
        style={{ whiteSpace: "pre" }}
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
    <g opacity={disabled ? 0.66 : displayMode === "view" ? 0.86 : 1}
      data-preview-display-mode-state={displayMode === "unresolved" ? "unknown" : undefined}
      data-preview-wrap-state={wrapUnknown ? "unknown" : undefined}
      data-preview-font-state={fontUnknown ? "unknown" : undefined}
      data-preview-font-size-state={fontSizeUnknown ? "unknown" : undefined}
      data-preview-text-style-state={unknownTextStyleProperties.length ? "unknown" : undefined}
      data-preview-text-style-properties={unknownTextStyleProperties.length ? unknownTextStyleProperties.join(",") : undefined}
      data-preview-line-height-state={!lineHeightKnown ? "unknown" : undefined}
      data-preview-padding-state={unverifiedPaddingEdges.length ? "unknown" : undefined}
      data-preview-padding-edges={unverifiedPaddingEdges.length ? unverifiedPaddingEdges.join(",") : undefined}
      data-preview-text-state={labelTextUnknown || buttonTextUnknown ? "unknown" : textTruncated ? "truncated" : undefined}
      data-preview-color-state={foregroundUnknown ? "unknown" : undefined}
      data-preview-fill-state={fillUnknown ? "unknown" : undefined}
      data-preview-border-state={borderUnknown ? "unknown" : undefined}
      data-preview-radius-state={radiusUnverified ? "unknown" : undefined}
      data-preview-shadow-state={shadowState}>
      {foregroundUnknown && <title>Foreground Color cannot be verified from source; the displayed text or icon color is a preview fallback</title>}
      {fillUnknown && <title>Fill cannot be verified from source; the displayed background is a preview fallback</title>}
      {borderUnknown && <title>Border appearance cannot be verified from source; the displayed border is a preview fallback</title>}
      {radiusUnverified && <title>Corner radius requires runtime state or is invalid; the outline is approximate and clipping uses only known corners</title>}
      {shadowState === "unknown" && <title>DropShadow requires runtime state or is unsupported; the absence of a shadow is not verified</title>}
      {shadowState === "not-rendered" && <title>DropShadow is known but cannot be faithfully rendered with an unverified or non-opaque Fill; shadow is omitted in this preview</title>}
      {displayMode === "unresolved" && (
        <title>DisplayMode requires runtime state; appearance and interaction permissions are not verified</title>
      )}
      {wrapUnknown && <title>Wrap requires runtime state; single-line text is only a preview fallback</title>}
      {fontUnknown && <title>Font requires runtime state or is unsupported; displayed family is a preview fallback</title>}
      {fontSizeUnknown && <title>Font size requires runtime state or exceeds preview limits; displayed size is approximate</title>}
      {unknownTextStyleProperties.length > 0 && (
        <title>{`Text styling cannot be verified for ${unknownTextStyleProperties.join(", ")}; displayed alignment, weight or decoration is a preview fallback`}</title>
      )}
      {!lineHeightKnown && <title>LineHeight requires runtime state or is outside supported preview bounds; displayed spacing is approximate</title>}
      {unverifiedPaddingEdges.length > 0 && (
        <title>{`Text padding cannot be verified for ${unverifiedPaddingEdges.join(", ")}; displayed spacing is a preview fallback`}</title>
      )}
      {buttonTextUnknown && <title>Button Text requires runtime data or state; the ellipsis is a preview placeholder, not verified content</title>}
      {textTruncated && <title>Text preview truncated after 4096 Unicode characters; the complete source text is not displayed</title>}
      <defs>
        <clipPath id={clipId}>
          {/* Unknown runtime corner formulas must not clip verified text or
              images using the outline's illustrative 4px fallback. */}
          <path d={previewChildClipPath(
            props, x + 1, y + 1, Math.max(0, width - 2), Math.max(0, height - 2),
            simulationSymbols
          )}/>
        </clipPath>
      </defs>
      {kind === "shape" && control.controlType.toLowerCase().includes("circle")
        ? <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2}
            fill={fill} stroke={stroke} strokeWidth={borderStyle === "none" ? 0 : thickness ?? 0}
            strokeDasharray={borderDasharray}
            strokeLinecap={borderStyle === "dotted" ? "round" : undefined} />
        : kind === "label" || kind === "icon" ? (
          explicitFill ? basicRect : null
        ) : basicRect}

      <g clipPath={`url(#${clipId})`}>
        {kind === "button" && svgText(text ?? (rawText != null ? "…" : "Button"), x + width / 2, "middle",
          previewColorWithSymbols(
            disabled ? props.DisabledColor ?? props.Color : props.Color, simulationSymbols
          ) ?? (disabled ? "#555555" : "#ffffff"))}
        {labelTextUnknown && (
          <g data-preview-text-state="unknown" pointerEvents="none">
            <text x={x + Math.min(8, width / 8)}
              y={y + Math.min(16, height / 2 + 4)}
              fontSize={Math.min(11, Math.max(7, height / 3))}
              fill="#6b7280">Text unknown</text>
            <title>Text requires runtime data or state; empty content is not verified</title>
          </g>
        )}
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
                display: "block", width: "100%", minWidth: 0, maxWidth: "100%",
                whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "normal",
                // Match the existing SVG multiline preview spacing. Browser
                // font-specific `normal` line-height otherwise shifts wrapped labels.
                lineHeight: lineHeightFactor,
                textAlign: horizontalAlign === "justify" ? "justify" :
                  horizontalAlign === "middle" ? "center" :
                  horizontalAlign === "end" ? "right" : "left"
              }}>{text}</span>
            </div>
          </foreignObject>
        ) : svgText(text))}
        {kind === "input" && (
          <g data-preview-input-state={inputContent?.state}>
            {svgText(text ?? (inputContent?.state === "unknown" ? "…" : ""),
              x + inset, "start",
              inputContent?.state === "hint" || inputContent?.state === "unknown"
                ? "#7f8792"
                : previewColorWithSymbols(props.Color, simulationSymbols) ?? "#242424")}
          </g>
        )}
        {kind === "select" && (
          <g data-preview-select-state={selectContent?.state}>
            {svgText(selectContent?.state === "unknown" ? "?" : text ?? "",
              x + inset, "start",
              selectContent?.state === "unknown" || selectContent?.state === "hint"
                ? "#7f8792" : foreground)}
            {selectContent?.state === "unknown" && (
              <title>Selection requires runtime data or state; no option inferred</title>
            )}
            <path d={`M ${x + width - 20} ${y + height / 2 - 3} l 5 6 l 5 -6`}
              fill="none" stroke="#5b6470" strokeWidth="1.6" />
          </g>
        )}
        {kind === "checkbox" && (
          <g data-preview-checked={checkedState}>
            <rect x={x + 5} y={y + (height - 18) / 2} width={18} height={18}
              rx={3} fill={selected ? "#0f6cbd" : checkedUnknown ? "#eaf0f5" : "#ffffff"}
              stroke={selected ? "#0f6cbd" : "#737b86"}/>
            {selected && <path d={`M ${x + 9} ${y + height / 2} l 4 4 l 7 -9`}
              stroke="white" strokeWidth={2} fill="none"/>}
            {checkedUnknown && <>
              <text x={x + 14} y={y + height / 2 + 4} textAnchor="middle"
                fontSize={12} fill="#596b7f" pointerEvents="none">?</text>
              <title>Checked state unknown — runtime formula unavailable</title>
            </>}
            {text && svgText(text, x + 29)}
          </g>
        )}
        {kind === "toggle" && (
          <g data-preview-checked={checkedState}>
            <rect x={x + 4} y={y + (height - 20) / 2} width={38} height={20} rx={10}
              fill={selected ? "#0f6cbd" : checkedUnknown ? "#cbd5e1" : "#999fa8"}/>
            <circle cx={x + (checkedUnknown ? 23 : selected ? 30 : 15)}
              cy={y + height / 2} r={7} fill="#ffffff"/>
            {checkedUnknown && <>
              <text x={x + 23} y={y + height / 2 + 4} textAnchor="middle"
                fontSize={11} fill="#596b7f" pointerEvents="none">?</text>
              <title>Checked state unknown — runtime formula unavailable</title>
            </>}
            {text && svgText(text, x + 50)}
          </g>
        )}
        {kind === "icon" && (() => {
          const icon = previewIconName(
            props.Icon, isModernIcon, simulationSymbols
          );
          if (icon === "none") return null;
          // Unsupported/runtime-dependent icons are explicitly unknown, not
          // silently represented as a different Power Apps icon.
          if (icon === null) return (
            <g data-preview-icon-state="unknown" pointerEvents="none">
              {svgText("?", x + width / 2, "middle", "#7c8794")}
              <title>Icon source is missing, unsupported, or requires runtime state; no glyph is verified</title>
            </g>
          );
          // A missing Rotation uses the Canvas default (0 degrees), but an
          // explicit runtime-dependent Rotation cannot be shown as unrotated.
          // Withhold the glyph until its orientation is verifiable.
          const rotation = props.Rotation == null
            ? 0 : previewIconRotation(props.Rotation, simulationSymbols);
          if (rotation === null) return (
            <g data-preview-icon-state="unknown" pointerEvents="none">
              {svgText("?", x + width / 2, "middle", "#7c8794")}
              <title>Icon rotation requires runtime state; orientation is not verified</title>
            </g>
          );
          const size = Math.max(0, Math.min(width, height) - 8);
          return (
            <svg x={x + (width - size) / 2} y={y + (height - size) / 2}
              width={size} height={size} viewBox="0 0 24 24"
              fill="none" stroke={foreground} strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round"
              aria-label={icon}>
              <path d={PREVIEW_ICON_PATHS[icon]}
                transform={rotation !== null && rotation !== 0
                  ? `rotate(${rotation} 12 12)` : undefined} />
            </svg>
          );
        })()}
        {kind === "image" && (
          <g data-preview-image-state={imageUnknown ? "unknown" : imageSourceState ?? "source-unavailable"}
            data-preview-image-source-state={imageSourceState ?? undefined}>
          <g transform={imageRotation || undefined}>
          <g transform={imageFlip || undefined}>
          {media && !imageTransformUnknown ? (
            imagePosition === "center" || imagePosition === "tile" ? (
              rasterCssImage ? (
                <foreignObject x={x} y={y} width={width} height={height}
                  pointerEvents="none">
                  <div style={{
                    width: "100%", height: "100%",
                    backgroundImage: rasterCssImage,
                    backgroundSize: "auto",
                    backgroundRepeat: imagePosition === "tile" ? "repeat" : "no-repeat",
                    backgroundPosition: imagePosition === "center" ? "center" : "left top"
                  }} />
                </foreignObject>
              ) : null
            ) : (
              <image x={x} y={y} width={width} height={height}
                href={media.dataUrl}
                preserveAspectRatio={previewImageFit(props.ImagePosition, simulationSymbols)} />
            )
          ) : imageSourceState === "source-blank" ? null : (
            <>
            <rect x={x + 6} y={y + 6} width={Math.max(4, width - 12)}
              height={Math.max(4, height - 12)} rx={3} fill="#eaf0f5" stroke="#abb7c4"/>
            <path d={`M ${x + 12} ${y + height - 16} l ${Math.max(5, width * .28)} -${Math.max(5, height * .36)} l ${Math.max(5, width * .18)} ${Math.max(5, height * .2)} l ${Math.max(5, width * .16)} -${Math.max(5, height * .2)}`}
              fill="none" stroke="#7d90a4" strokeWidth={2}/>
            <circle cx={x + Math.min(width - 12, 24)} cy={y + 22} r={4} fill="#9ab0c5"/>
            {imageUnknown && (
              <g data-preview-image-uncertainty="true" pointerEvents="none">
                <text x={x + width / 2} y={y + height / 2}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={Math.min(11, Math.max(7, height / 5))}
                  fill="#526579">Image state unknown</text>
                <title>{imageSourceState === "runtime-unknown"
                  ? "Image source requires runtime data or state; no image or access is inferred"
                  : "Image position, flip or rotation requires runtime state; appearance is not verified"}</title>
              </g>
            )}
            </>
          )}
          </g>
          </g>
          </g>
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
