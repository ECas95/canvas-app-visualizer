# Canvas App Visualizer

[![CI](https://github.com/ECas95/canvas-app-visualizer/actions/workflows/ci.yml/badge.svg)](https://github.com/ECas95/canvas-app-visualizer/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/ECas95/canvas-app-visualizer/actions/workflows/pages.yml/badge.svg)](https://github.com/ECas95/canvas-app-visualizer/actions/workflows/pages.yml)

**Live web app:** https://ecas95.github.io/canvas-app-visualizer/

Open-source, local-first visualizer and static analyzer for Microsoft Power Apps Canvas Apps.

Open a modern `.msapp` package or current `.pa.yaml` source and inspect screens, controls, serialized properties, Power Fx formulas, static diagnostics, delegation risks, and technical optimization opportunities without requiring an active Power Apps Studio session. Historical `.fx.yaml` packages are also supported in read-only compatibility mode.

> Canvas App Visualizer is an independent project and is not affiliated with or endorsed by Microsoft. It does not replace Power Apps Studio or the Power Apps runtime.

## v0.8.0 — Source-complete visibility and conditional control inspection

- **All elements**: a third preview mode that ghosts hidden, conditional, nested, off-viewport and Gallery template-definition controls without changing the safe default Visual mode.
- **Three-valued visibility**: independently report each control's own `Visible` condition and effective status inherited from its parent chain (**VISIBLE**, **HIDDEN**, **UNKNOWN**).
- **Coordinates and confidence**: inspect X/Y/Width/Height per element, with explicit **estimated** flags when runtime formulas or hidden AutoLayout make exact geometry unavailable; nearby outside-screen controls can also be displayed beyond the viewport.
- **Visibility inventory**: filter/search all source controls, inspect original formulas and select any source control directly from its row or ghost.
- **Synthetic conditional scenarios**: optionally upload local-only scalar variable JSON to exercise known branches, without querying the MSAPP's data sources or fabricating permissions.
- **Synthetic regression**: unit and Chromium tests ensure no hidden source controls or template definitions are lost in All elements and normal Visual mode still withholds unknown runtime data.

See [Complete visibility inspection](docs/COMPLETE_VISIBILITY_INSPECTION.md). This feature audits serialized source, **not** full Power Apps runtime execution or verified access to external records.

## v0.7.0 — Safe multi-screen behavior and deeper diagnostics

- **Navigate, Back and OnVisible**: opt-in, browser-only simulation of safe Power Fx navigation, per-screen contexts and local lifecycle events. Unsupported SQL/connector actions are visibly skipped; OnSelect remains transactional.
- **Form/DataCard examples**: opt-in source-derived field placeholders and one browser-local JSON record for `ThisItem` / `Parent.Default` rendering, without using records from imported MSAPP connections.
- **Version comparison**: import a previously downloaded visual-difference report to evaluate improved/regressed controls, with strict matching of screen, viewport and threshold.
- **Geometry review**: identify likely clipping, viewport overflow, unresolved positions and strong sibling overlaps, with clickable source controls.
- **Official Microsoft.PowerFx syntax**: independently loaded .NET WebAssembly parser diagnostics, with an explicit fallback when unavailable. It does not execute behavior formulas or grant access.

See [Interactive Preview v0.7 guide](docs/INTERACTIVE_PREVIEW_V0.7.md) for exact capabilities, synthetic fixtures, security and remaining gaps. This is **not** complete Power Apps runtime emulation.

## v0.6.0 — Fast visual diagnostics and reproducible reports

- **Performance:** visual difference metrics now use streaming scanline prefix sums. Instead of rescanning every overlapping control rectangle, the comparator runs in `O(pixels + rows × regions)` time with only `O(viewport width + regions)` temporary storage beyond the output heatmap.
- **Accuracy:** regional RMSE now uses the same per-channel squared RGB difference as screen-wide RMSE. This fixes an under-reporting bug for uneven RGB-channel mismatches.
- **Better priorities:** switch between **Largest total impact** (large areas first) and **Highest average error** (severe local mismatches) for the top control/gallery regions.
- **Adjustable sensitivity:** choose a threshold from 0 to 128/255 to distinguish subtle antialiasing changes from larger differences. Changing thresholds invalidates outdated measurements.
- **Export:** download a browser-generated JSON diagnostic report with source control names, rankings and metrics, but **no image contents, heatmap pixels or gallery records**. Export is opt-in only.

See [Visual diagnostics v0.6 guide](docs/FAST_VISUAL_DIAGNOSTICS.md) and the existing [screenshot comparison guide](docs/QUANTITATIVE_VISUAL_DIFF.md).

## v0.5.0 — Quantitative visual difference measurement

- **Measure difference:** compare a matching local screenshot against the current source-defined Canvas SVG. See mean RGB absolute error, RMSE, and the percentage of pixels above a fixed threshold (32/255).
- **Heatmap:** toggle an alpha-scaled red overlay. The reference and prior heatmap are excluded from the pixels being measured.
- **Source-region diagnosis:** rank overlapping control bounds and Gallery template sample cells by local error; click an item to inspect its source control.
- **Nested layout fidelity:** Gallery template geometry is scoped to the template's immediate descendants; nested containers use their own parent dimensions, avoiding invalid `Parent.TemplateWidth` leakage.
- **Privacy:** comparison is performed entirely in the browser. Local screenshots, local data fixtures and heatmaps are not uploaded or stored.

See [Quantitative visual difference guide](docs/QUANTITATIVE_VISUAL_DIFF.md). This debugging metric does not prove pixel-perfect equivalence with Power Apps.

## v0.4.0 — Reference screenshot comparison and Gallery text

- **Compare against Power Apps:** load a cropped **local PNG/JPEG/WebP** screenshot of the original Canvas at the same simulated viewport, toggle the overlay and adjust its opacity to inspect alignment of controls. Exact pixel dimensions are checked; mismatched screenshots are not stretched.
- **Safe local-only:** reference files are never uploaded or persisted. The renderer accepts bounded raster types only (up to 8 MB), and changing screens clears the reference.
- **Richer ThisItem formulas:** source labels can now use bounded scalar `Left`, `Right`, `Mid`, `Substitute` and `Concatenate` on known browser-local JSON records. SQL values and locale-sensitive data are not guessed.
- **Browser regression:** an eighth synthetic Chromium screenshot exercises the overlay and mismatched viewport protection.

See [Screenshot comparison instructions](docs/SCREENSHOT_COMPARISON.md). This is manual visual comparison, **not an automatic claim of pixel-perfect fidelity** with Power Apps Studio.

## Browser-local Gallery data fixtures (October 2026)

The Visual preview can now accept an **optional local JSON array** of 1–6 example rows for a selected Gallery. It binds scalar text, Boolean and numeric values to `ThisItem.*` formulas within the **actual YAML-defined Gallery card template**, so labels, conditional badges, colors and other resolvable properties can be inspected without SQL/Dataverse connections.

**No automatic data retrieval or authorization.** Local rows are UI fixtures, not verified runtime or permission records; all preview cards remain noninteractive. The source-only mode is unchanged by default. See [Gallery local JSON instructions](docs/GALLERY_LOCAL_JSON.md) for a sample file and limits.

## v0.3.0 — Opt-in local interactive preview

- **Simulate local state** is off by default. When enabled, safe scalar Power Fx `Set` and `UpdateContext` behavior can update local preview variables without executing SQL or connectors.
- **Preview interactions:** use a control's `OnSelect`, explicitly trigger `Screen.OnVisible`, inspect scoped state and reset it. Formulas with external or unsupported behavior are rejected transactionally.
- **Reactive visual properties:** statically resolvable `Visible`, `Text`, `Fill`, `Color`, `DisplayMode`, checkbox state, and dependent layout values respond to known local variables.
- **Safety:** no Power Apps runtime, user permissions, remote data, navigation, or external mutation. The built-in synthetic demo provides a safe toggle example.

See [Local Preview Interactions](docs/LOCAL_PREVIEW_INTERACTIONS.md) and [v0.3.0 release notes](docs/RELEASE_V0.3.0.md).

## v0.2.0 — Source-faithful workbench

- **Visual / Structure previews** with responsive viewport profiles, zoom, focused selection and source-based control styling.
- **Collapsible App explorer** with live search, explicit expand-all/collapse-all and automatic reveal of selected controls.
- **Diagnostic navigation:** search advisory findings by rule/control/property and inspect the original affected screen/control from a finding.
- **Gallery layout improvements:** `WrapCount`, `TemplateSize`, parent template dimensions and viewport-aware column layout; unknown runtime datasets remain illustrative, never fabricated.
- **More accurate layout formulas:** Canvas default `X/Y=0` when not serialized, sibling references, `Self.Y`-dependent dimensions and provable static boolean branches.
- **Local import protections:** bounded YAML file count/size and locally embedded raster-image handling.

**Runtime boundary:** the preview does not execute Power Fx behavior, permissions, database queries or connectors. Galeries whose `Items` rely on remote data display source templates as unknown, not real records. This is deliberate.

See [release notes](docs/RELEASE_V0.2.0.md) and [Microsoft source references](docs/MICROSOFT_SOURCE_OF_TRUTH.md).

## Current MVP

- open modern `.msapp` packages directly in the browser;
- prefer active `Src/*.pa.yaml` source and open historical `Src/*.fx.yaml` in read-only compatibility mode;
- validate current Canvas source against Microsoft's public v3 schema locally;
- normalize App, Screens, Components, DataSources, EditorState, Controls, Properties, and nested Children;
- preserve control version, variant, layout, component, and source-format metadata;
- display a searchable control hierarchy;
- render an approximate screen preview with safe evaluation of common `Parent`, `Self`, `App`, gallery-template, sibling-geometry, and AutoLayout formulas;
- inspect serialized formulas and properties;
- lex Power Fx with awareness of strings, quoted identifiers, comments, operators, records/tables, and qualified function calls;
- surface structural, performance, delegation, maintainability, startup, and accessibility review hints;
- classify analyzer findings by severity and confidence;
- process files locally with no application upload API;
- enforce package/source size safety limits;
- test current/legacy package import, schema validation, Power Fx lexical behavior, and layout logic with Vitest.

## Why approximate?

Power Apps formulas can calculate layout at runtime:

```powerfx
=Parent.Width - Self.Width - 24
```

A static viewer cannot resolve that expression correctly without recreating the Power Apps runtime, control defaults, parent state, themes, data, and other dependencies.

Canvas App Visualizer therefore resolves only formulas whose dependencies are known locally. It can already evaluate a safe subset of arithmetic, responsive `If` expressions, `Parent`/`Self`/`App` geometry, sibling dimensions, gallery template dimensions, and supported AutoLayout properties. Everything else remains explicitly unresolved and is rendered with fallback geometry.

It does **not** claim to be a pixel-perfect Power Apps emulator.

## Supported source

Microsoft's active Canvas source uses `.pa.yaml`. Modern `.msapp` packages contain those files under `Src/`, which this project extracts locally.

The project also opens the retired experimental `.fx.yaml` source found in many public historical Canvas samples, but only for read-only inspection and migration research.

Package JSON outside selected Canvas source is deliberately ignored as unstable source material.

See [Format Support](docs/FORMAT_SUPPORT.md) and the [Public .msapp Research Corpus](docs/MSAPP_RESEARCH_CORPUS.md).

## Architecture

```text
.msapp / .pa.yaml
        |
        v
Safe source importer
        |
        v
YAML parser
        |
        v
Normalized Canvas model
        |
        +----------------------+
        |                      |
        v                      v
Approximate renderer      Static analyzer
        |                      |
        +----------+-----------+
                   |
                   v
              Workbench UI
```

See [Architecture](docs/ARCHITECTURE.md).

## Analyzer

The MVP currently includes review rules for:

- malformed/unbalanced Power Fx delimiters;
- repeated `LookUp` calls;
- `ForAll` + `Patch`;
- `ClearCollect` and local materialization;
- connector-dependent delegation;
- write-error handling;
- large/repeated formulas;
- potentially heavy `App.OnStart`;
- navigation coupled to `App.OnStart`;
- serialized accessibility labels.

Delegation findings are deliberately conservative because actual delegation depends on the data source, connector, column types, and expression shape.

See [Analyzer Rules](docs/ANALYZER_RULES.md).

## Run locally

Requirements:

- Node.js 22+
- npm

```bash
git clone https://github.com/ECas95/canvas-app-visualizer.git
cd canvas-app-visualizer
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm test
npm run build
```

## Privacy

The MVP uses browser file APIs and performs parsing/analyzing locally. It contains no upload endpoint.

Do not assume an arbitrary third-party deployment is trustworthy merely because the upstream source is local-first. For sensitive apps, review and run the source yourself.

See [Security Policy](SECURITY.md).

## Project direction

The intended product is a web application with a desktop distribution using the same core parser/analyzer.

Planned work includes:

- Microsoft Power Fx Core/Interpreter integration through local browser WebAssembly;
- app-aware Power Fx binding and type checking;
- connector-aware delegation profiles;
- dependency/call graphs;
- richer responsive-container, gallery, form, and component rendering;
- before/after visual and formula diff;
- diagnostic report export;
- desktop shell.

See [Roadmap](ROADMAP.md).

## Source-format references

The project follows Microsoft's current Canvas source-code documentation and schema rather than the retired `.fx.yaml` format.

Relevant upstream references are documented in [docs/FORMAT_SUPPORT.md](docs/FORMAT_SUPPORT.md). The semantic Power Fx strategy is documented in [docs/POWER_FX_COMPATIBILITY.md](docs/POWER_FX_COMPATIBILITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
