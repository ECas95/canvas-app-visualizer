# Public .msapp Research Corpus

This document records public Canvas App packages and source trees used to understand real serialization patterns.

The repository does not copy third-party application packages into its own test fixtures. Tests use small synthetic fixtures that reproduce structural patterns.

## Current Microsoft source format

Microsoft documents `.pa.yaml` as the active Canvas source format.

A current `.msapp` is a ZIP-compatible package whose active source is under `Src/`. The stable source surface includes:

- `App.pa.yaml`
- one `[screen].pa.yaml` per screen
- component source files under the component source folder

Package JSON is deliberately not treated as stable source by Canvas App Visualizer.

Upstream references:

- https://learn.microsoft.com/power-apps/maker/canvas-apps/power-apps-yaml
- https://github.com/microsoft/PowerApps-Tooling/tree/master/schemas/pa-yaml/v3.0
- https://github.com/microsoft/power-platform-skills/tree/main/plugins/canvas-apps


## Official current-source corpus

Microsoft publishes a substantial current Canvas source tree in:

https://github.com/microsoft/scmsamples-EnterpriseAssetManagement/tree/main/CanvasAppSource/Src

This corpus contains a large `App.pa.yaml`, many real screen files, reusable components, and `_EditorState.pa.yaml`. It is useful because it exercises current serialization at a scale far beyond minimal documentation snippets.

Patterns observed during this research pass include:

- versioned controls such as `GroupContainer@1.3.0`, `Label@2.5.1`, and `Classic/Button@2.2.0`;
- `CanvasComponent` instances with `ComponentName`;
- AutoLayout containers using `LayoutDirection`, `LayoutGap`, padding, alignment, and justification;
- formulas that depend on sibling control geometry, for example a body height derived from a header's `.Height`;
- formulas that depend on `Parent`, `Self`, and `App` geometry;
- multiline formulas containing comments;
- behavior chains separated with semicolons;
- quoted enum/font identifiers such as `Font.'Open Sans'`;
- percent literals such as `-15%`;
- large app-level record constants and style/configuration structures created in `App.OnStart`;
- `EditorState.ScreensOrder` and `ComponentDefinitionsOrder`.

These patterns directly drive regression tests and renderer work. In particular, the preview now resolves a safe subset of `Parent`/`Self`/`App` arithmetic and iteratively resolves statically known sibling geometry before falling back to dashed dynamic controls.

## Public PnP Power Fx sample packages

The public `pnp/powerfx-samples` repository contains downloadable historical `.msapp` packages together with unpacked source trees. Examples found during the research pass include:

| Sample | Public package/source |
|---|---|
| Color functions | `samples/color-functions/solution/color-functions.msapp` |
| Table functions | `samples/table-functions/solution/table-functions.msapp` |
| Regex functions | `samples/regex-functions/solution/RegexFunctions.msapp` |
| Geolocation utilities | `samples/geolocation-utils/solution/GeoLocation-Utils.msapp` |
| Financial functions | `samples/financial-functions/solution/powerfx-financial-functions.msapp` |
| Base conversion | `samples/convertbasenumber-functions/solution/convertbasenumber-functions.msapp` |
| Date functions | `samples/date-functions/solution/powerfx-date-functions.msapp` |

Repository:

https://github.com/pnp/powerfx-samples

These packages are useful compatibility evidence, but their source trees primarily use the retired experimental `.fx.yaml` format rather than current `.pa.yaml`.

## Legacy patterns observed

The public sample source exposed several patterns the original MVP did not understand.

### Screen declaration

```yaml
Screen1 As screen:
    Fill: =RGBA(250, 250, 250, 1)
```

### Nested control declaration

```yaml
Screen1 As screen:
    Icon1 As icon.ArrowUp:
        X: =40
        Y: =40
        ZIndex: =1
```

Legacy controls store their properties directly under the control rather than under a modern `Properties:` node.

### Groups as nested controls

```yaml
Screen1 As screen:
    HeaderGroup As group:
        Title As label:
            Text: ="Title"
            ZIndex: =1
```

### Canvas component definitions and functions

Public component source uses declarations such as:

```text
TableUtils As CanvasComponent
JsonDiffToTable(JsonBefore As String, JsonAfter As String)
ThisProperty.Default
```

The parser must therefore distinguish the top-level declaration token ` As ` from ` As ` appearing inside a function parameter list.

### Component instances

Legacy component instances can serialize as a control whose type is the component name rather than a modern `Control: CanvasComponent` plus `ComponentName`.

### Power Fx surface

The public corpus contains formulas using, among other constructs:

- `With`
- `ForAll`
- `Filter`
- `LookUp`
- `Match` / `MatchAll`
- `Ungroup`
- `Switch`
- records and tables
- component-qualified function calls
- regular-expression string literals
- string concatenation
- nested function scopes

This is why regex matching alone is not a sufficient Power Fx analyzer.

## Compatibility policy

Canvas App Visualizer uses three source labels:

- `pa-yaml-v3` — current source format;
- `fx-yaml-legacy` — retired experimental format, supported read-only;
- `unknown-yaml` — generic YAML that requires structural inference.

When a `.msapp` contains both current and retired source, current `.pa.yaml` wins.

Legacy support exists to open historical public/community apps and aid migration analysis. It must not be presented as an active authoring format.

## Test strategy

The automated suite does not embed entire public sample apps.

Instead it creates synthetic source/packages covering the observed grammar:

- current `Src/*.pa.yaml` package;
- current + legacy package, verifying current precedence;
- legacy `Src/*.fx.yaml` package;
- nested legacy groups;
- quoted legacy control names;
- component UDF signatures containing `As`;
- complex Power Fx with strings/comments/records/qualified calls.

This keeps tests small, deterministic, and independent from third-party sample licensing changes.
