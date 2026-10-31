# Synthetic Gallery template previews

A Canvas `.msapp` can contain formulas for galleries whose `Items` are supplied at runtime by SQL, Dataverse, Power Fx collections, filters or connectors. A source-only viewer **cannot** infer loaded records, access grants, data source results or whether a gallery is empty.

## Two clearly different modes

- **Normal preview (default):** preserve the existing unknown Gallery.Items and Visible states; no synthetic rows are rendered. The tree, YAML and source-only structure are inspectable.
- **Gallery samples (synthetic, opt-in):** repeat the actual YAML Gallery template controls 1, 3 or 6 times using safe, explicitly fictional slot positions. Each sample has a prominent SAMPLE number, and all missing record-backed text appears in bracketed source-column form such as `[Name #1]` or `[IsEnabled #3]`. A persistent warning says no database rows or permissions have been verified.

Samples use Gallery.WrapCount, TemplateSize, TemplatePadding, the actual parent template dimensions, child hierarchy, container geometry, and statically resolvable properties. Children are not interactive. Nothing invokes Power Fx behavior formulas or data connectors.

The workbench also lists source template field references inferred from `ThisItem.Field` and `ThisRecord.Field`. This is a **usage hint**, not a verified SQL/Dataverse schema. A Gallery.Items expression with `Filter`, `SortByColumns`, `With`, etc., does not grant knowledge about the actual records.

## Generic case study (private source is not committed)

A source Gallery with three responsive columns and a 292-pixel template can be visualized as six clearly synthetic cards in two template rows. Field references are inferred from nested labels and buttons; no rows, status values, accent colors or permission outcomes are manufactured.

## Deliberate limits

- Unknown Gallery dimensions or template formulas remain labelled unresolved.
- Simulated cards are limited to six, with a bounded depth and child count to preserve browser performance.
- Icon choices, colors, permissions, actions and texts driven by `ThisItem` remain unknown or neutral previews rather than guessed real values.
- Samples can extend beyond the Gallery viewport and are clipped like the source template, but do not represent real scroll position, loaded rows or end-of-list state.
- For actual preview of data-driven content, a future opt-in feature should accept a user-supplied, local-only record snapshot and explicit mapping, with verified provenance and access warnings. Never connect to SQL automatically.

Microsoft source: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-gallery

Official YAML schema: https://github.com/microsoft/PowerApps-Tooling/tree/master/schemas/pa-yaml/v3.0
