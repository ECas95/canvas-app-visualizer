# Semantic Canvas Preview

The preview supports two complementary representations of the same normalized Canvas source:

- **Visual** (default) is a best-effort static portrayal of common Canvas control families. It maps safe literal colors, text, size, and checkbox/toggle state to simplified SVG affordances.
- **Structure** shows control geometry and names. Use it to inspect control bounds and dynamic layout fallbacks.

The workbench is an inspector, **not** a Power Apps emulator. No behavior properties or connectors are invoked. A formula can be syntactically valid while the viewer cannot determine its runtime value.

## Implemented in the first semantic pass

- Buttons, labels, text inputs, selects, checkboxes, toggles, icons, image placeholders, shapes, containers, forms and galleries.
- Literal-only property resolution and statically false visibility.
- Distinct visual/structural modes with simulated desktop/tablet/phone viewport profiles.
- Fit, 50%, 75%, 100%, and 125% zoom; isolate selected control and its containing hierarchy.
- Preserve child layout positioning from the existing safe geometry evaluator and constrain drawn children in layout hosts.
- Unknown control types remain visible as placeholders.
- The browser locally reads bounded PNG, JPEG, GIF and WebP resources stored in recognized `.msapp` resource folders, and displays only images linked by statically resolvable YAML names (`Media.Name`, `Name` or a literal filename). Other image formulas remain placeholders. External URLs are never loaded.

## Source-first rendering contract

Preview properties follow a deterministic precedence:

1. **Serialized YAML wins**: a statically resolvable value of `X`, `Y`, `Width`, `Height`, `Fill`, `Color`, `Text`, `Size`, `FontWeight`, `Align`, `VerticalAlign`, `Italic`, `Underline`, `Strikethrough`, `BorderColor`, `BorderThickness`, `RadiusTopLeft`, or `Visible` takes precedence over the appearance of the generic control.
2. **Known expression subset**: limited local arithmetic and control geometry expressions are used only when all dependencies are available.
3. **Visual fallback**: when a property is absent or cannot be evaluated, the relevant control type gets a neutral approximate default instead of a fabricated value. Dynamic text must not be replaced with a made-up application string.
4. **Inspection remains authoritative**: the Properties panel always shows the original serialized values, even when the preview cannot resolve them.

This is a *source-aware picture*, not an executable app. Unknown runtime visibility is not treated as false; known `Visible=false` excludes a control and its descendants from the preview. The preview does not execute behavior formulas or connector requests.

## Fidelity tiers

1. **Resolved:** property is statically known from source (e.g., constant dimensions and `ColorValue`).
2. **Approximate:** a known control type is drawn using simplified defaults, without claiming theme/runtime parity.
3. **Unknown:** layout or appearance depends on Power Fx symbols, data, component implementation, unsupported functions, or missing properties.

The v3 YAML schema deliberately serializes properties that differ from defaults, not a full snapshot of theme/control defaults. Matching Microsoft Studio pixel-for-pixel is therefore not possible from the YAML alone. Preview viewport profiles are simulations; they are not the app's actual settings.

## Next iterations

1. **Control registry:** version/variant-aware rendering and default-property profiles for classic vs modern controls; tabular test fixtures.
2. **Source package resources:** raster extraction and direct-name matching are implemented; future work includes complex package image manifests, media aliases, component media and embedded vector replacements without external network requests.
3. **Layout semantics:** container flex/wrap/alignment, containers versus editor groups, form cards, responsive flow, and simulated gallery rows from explicitly synthetic records.
4. **Power Fx integration:** use the official parser from PR #13 as authoritative for syntax; add app-symbol binding before relying on calculated runtime-like values.
5. **Scale and navigation:** on-demand tree expansion (#14), diagnostic-to-control selection, per-screen caching and Web Worker analysis.
6. **Fidelity regression corpus:** validate current/legacy MSAPP fixture sets; compare visual captures against the same public sample in Studio at identical viewport sizes. Record unsupported controls explicitly.

Never count a source finding as a confirmed runtime error without relevant host/connector evidence.
