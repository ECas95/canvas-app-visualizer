# Canvas App Visualizer v0.2.0

Release focus: a more reliable, source-first Canvas inspection portal, designed for large Power Apps .msapp packages.

## Included
- Collapsible and searchable control tree with expand/collapse actions and keyboard-accessible disclosures.
- Direct navigation from diagnostics to nested controls using exact serialized source paths and files; handles identically named controls across screens.
- Search findings by message, rule, category, control path, property or source file.
- More accurate coordinates: absent X/Y uses Canvas zero defaults instead of artificial offsets, including sibling formulas.
- Self.Y-dependent dimensions re-evaluated after known positions.
- Partial Power Fx static evaluation resolves provable false AND unknown, true OR unknown, and known If branches without guessing runtime state.
- Responsive Gallery.WrapCount, template cell geometry and runtime-unknown gallery state indicators.
- Source input-count and pre-read size limits, preserving local safe raster media extraction.
- Existing visual/structure previews, zoom, viewport simulation and selection focus preserved.

## Acceptance checks
- npm run lint — TypeScript typecheck
- npm test — Vitest source, layout, import, Power Fx, navigation regression tests
- npm run build — production bundle
- GitHub Pages automatically builds and deploys when the PR is merged into main.

## Explicit limitations
- No SQL, Power Automate, identity, connector or database execution; no invented grants or catalogue rows.
- Galleries bound to runtime collections show a source template, not the actual dataset.
- OnSelect and OnVisible behaviors are not yet simulated.
- Modern control defaults and user-defined components remain approximate.
- The official Microsoft Power Fx WebAssembly parser is in PR #13, pending conflict resolution and compatibility review.

## Official Microsoft sources
- https://github.com/microsoft/PowerApps-Tooling/blob/master/schemas/pa-yaml/v3.0/pa.schema.yaml
- https://github.com/microsoft/Power-Fx
- https://learn.microsoft.com/power-apps/maker/canvas-apps/power-apps-yaml

## Planned v0.3.0
Integrate official Power Fx syntax diagnostics with app-symbol binding when reliable. Implement explicitly opt-in, local-only simulation of allowlisted state changes. Reject all connector calls, security queries, SQL mutations and unknown behaviors. Distinguish inferred visual state from actual runtime data.
