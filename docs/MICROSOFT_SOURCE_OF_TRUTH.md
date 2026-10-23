# Microsoft source-of-truth policy

This project is a **read-only source analyzer and approximate canvas preview**, not an emulator of Power Apps Studio or the runtime.

## Priority order

| Concern | Authoritative source | What we implement |
| --- | --- | --- |
| Current Canvas serialization | [Microsoft Learn: Canvas `.pa.yaml`](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/power-apps-yaml) | Interpret the active `Src/*.pa.yaml` format; version metadata, Control/Variant/Children and omitted defaults |
| Structural validation | [Microsoft PowerApps-Tooling: versioned v3 schema](https://github.com/microsoft/PowerApps-Tooling/blob/master/schemas/pa-yaml/v3.0/pa.schema.yaml) | Vendored unchanged at `src/schema/pa.schema.yaml` and validated locally; version/pin and diff upstream explicitly |
| Power Fx grammar and syntax | [Microsoft Power-Fx](https://github.com/microsoft/Power-Fx) and its [expression grammar](https://github.com/microsoft/Power-Fx/blob/main/docs/expression-grammar.md) | Official parser integration is tracked in [PR #13](https://github.com/ECas95/canvas-app-visualizer/pull/13); custom TypeScript lexical and static evaluation must not overrule the official syntax verdict |
| Behavior formulas and state | [Microsoft Power Fx imperative logic](https://github.com/microsoft/Power-Fx/blob/main/docs/imperative.md) and [variables](https://github.com/microsoft/Power-Fx/blob/main/docs/variables.md) | Distinguish declarative property formulas from sequential OnSelect/OnVisible actions. A future local-only, opt-in state model must whitelist supported operations rather than executing arbitrary actions |
| Source package internals | [Microsoft PowerApps-Tooling persistence project](https://github.com/microsoft/PowerApps-Tooling/tree/master/src/Persistence) | Study current resource shapes and versions but retain a browser-only read-only import model |

## Important compatibility boundaries

- Microsoft's current Canvas source format is **`.pa.yaml`**; `.fx.yaml` and earlier experimental formats are retired. Keep historical parsing as explicit compatibility mode, never as the active source contract.
- Microsoft's [PowerApps-Tooling README](https://github.com/microsoft/PowerApps-Tooling/blob/master/README.md) warns that **PASopa is legacy and unsupported**, and the corresponding `pac solution --processCanvasApps` workflow will be deprecated. Do not build a new production architecture around PASopa.
- Microsoft's current format uses the order of controls in the `Children` array for ascending `ZIndex`, and allows explicit version suffixes such as `Control@1.5.0` plus `Variant`. Interpret these as **metadata**; they are not Power Fx expressions.
- The YAML **serializes only non-default property values**. Therefore absence of `X`, `Y`, `Width`, text properties, styles or control behavior must be handled through version-aware defaults; do not turn omissions into arbitrary visual placement. See [Microsoft Learn](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/power-apps-yaml).
- Only `Src/*.pa.yaml` is stable **source code** inside a current `.msapp`. Auxiliary media may be used as local, read-only presentation resources after validation, but package JSON must **not** become a second authoritative source of application logic.
- A formula containing `ThisItem`, `Gallery.Items`, `User()`, SQL/Dataverse/SharePoint sources, authorization or other runtime-dependent values cannot automatically be evaluated from source alone. `Gallery.AllItems` unknown does **not** mean empty. Show a template, unknown state and/or explicitly labeled synthetic test data; never grant permissions or fabricate records.
- Loading the Power Fx parser for syntax does **not** grant access to Power Apps host symbols, data-source schemas or runtime execution. The parser's authority is syntax; binding/type-checking and evaluation require deliberate host-model work.

## Engineering checklist for future PRs

1. Pin the relevant Microsoft source, date/ref and the exact semantic feature under test in the PR description.
2. Add a `.pa.yaml`-based synthetic regression fixture exercising the feature, including version/variant when meaningful.
3. Separate **known literal / statically provable / unknown runtime** outcomes in visualization and diagnostics.
4. Run TypeScript checks, unit tests and build, then review against current Power Apps Studio where test samples permit.
5. Never send MSAPP/YAML contents, connected data, credentials or imported resources to network services by default.
6. Do not merge a syntax parser, static expression resolver and optional behavior simulator into a single unsafe execution pathway.

## Source reference URLs

- https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/power-apps-yaml
- https://github.com/microsoft/Power-Fx
- https://github.com/microsoft/Power-Fx/blob/main/docs/imperative.md
- https://github.com/microsoft/Power-Fx/blob/main/docs/variables.md
- https://github.com/microsoft/PowerApps-Tooling
- https://github.com/microsoft/PowerApps-Tooling/blob/master/schemas/pa-yaml/v3.0/pa.schema.yaml
