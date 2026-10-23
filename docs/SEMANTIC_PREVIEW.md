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
- Unknown control types remain visible as placeholders. Package images intentionally do not load in this phase.

## Fidelity tiers

1. **Resolved:** property is statically known from source (e.g., constant dimensions and `ColorValue`).
2. **Approximate:** a known control type is drawn using simplified defaults, without claiming theme/runtime parity.
3. **Unknown:** layout or appearance depends on Power Fx symbols, data, component implementation, unsupported functions, or missing properties.

The v3 YAML schema deliberately serializes properties that differ from defaults, not a full snapshot of theme/control defaults. Matching Microsoft Studio pixel-for-pixel is therefore not possible from the YAML alone. Preview viewport profiles are simulations; they are not the app's actual settings.

## Next iterations

1. **Control registry:** version/variant-aware rendering and default-property profiles for classic vs modern controls; tabular test fixtures.
2. **Source package resources:** safe local extraction and rendering of supported embedded image assets, with cleanup and size limits; no untrusted network requests.
3. **Layout semantics:** container flex/wrap/alignment, containers versus editor groups, form cards, responsive flow, and simulated gallery rows from explicitly synthetic records.
4. **Power Fx integration:** use the official parser from PR #13 as authoritative for syntax; add app-symbol binding before relying on calculated runtime-like values.
5. **Scale and navigation:** on-demand tree expansion (#14), diagnostic-to-control selection, per-screen caching and Web Worker analysis.
6. **Fidelity regression corpus:** validate current/legacy MSAPP fixture sets; compare visual captures against the same public sample in Studio at identical viewport sizes. Record unsupported controls explicitly.

Never count a source finding as a confirmed runtime error without relevant host/connector evidence.
