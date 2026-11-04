# Canvas App Visualizer v0.7.0 — source-only interactive previews

## Scope

This version advances local exploration of an arbitrary Canvas `.msapp` or `.pa.yaml`, but **does not execute arbitrary Power Fx, connectors, SQL or the actual Microsoft Power Apps runtime**. The source remains local in the browser. All examples, fixtures and screenshots committed to the repository are generic and synthetic.

## Opt-in navigation and lifecycle

After loading a multi-screen app, select **Simulate local state** to start the allowlisted local session. The app may have `App.OnStart`; it runs **only when this option is explicitly enabled**. The initial screen `OnVisible` is then inspected and local actions are simulated.

Supported preview behavior:
- `Set`, `UpdateContext` with known scalar values (global and per-screen context respectively).
- `Navigate(TargetScreen)` and `Navigate(TargetScreen, ScreenTransition.Fade, { foo: 1 })`, if the target is an actual imported screen. The visual preview selects the destination screen, while no actual Power Apps transition is invoked.
- `Back()` with a local navigation history.
- Deterministically evaluable `If` branches wrapping the supported actions.
- `Screen.OnHidden` and `Screen.OnVisible` when changing screens. `OnVisible` runs again on each return; source `App.OnStart` does not rerun on ordinary navigation.
- Explorer navigation between screens, with local lifecycle handling and no real app execution.

**Mixed OnVisible formulas:** unsupported steps (for example `ClearCollect` from Dataverse/SQL) are skipped and recorded prominently. Other provably local scalar steps may be simulated, but the result is marked **PARTIAL**; never treat it as a faithful real runtime initialization. `OnSelect` keeps transactional rejection: an unsupported action prevents that entire click formula from changing local state.

**Not supported:** `Patch`, `SubmitForm`, connectors, `ClearCollect`, `Collect`, `Remove`, live SQL/Dataverse, `User()`, flow calls, `Launch`, timers and complex component behavior. No permission grants or records are inferred from source. Undefined symbols are not automatically replaced with zero or blank. Navigation loops, nested actions and variable counts are bounded.

Generic regression fixture: `tests/fixtures/SyntheticNavigation.pa.yaml`. It shows multiple screen events, literal navigation context, a Back action and an unsupported collection call deliberately blocked for safety. It includes no real application data.

## Gallery and Form/DataCard examples

Gallery samples are still opt-in, using source control templates, inferred `ThisItem` fields and optional user-supplied local JSON rows. Form examples add opt-in placeholders based on `ThisItem.*` and `DataField`, and a single local JSON record can populate `ThisItem` and resolved `Parent.Default` for direct DataCard children. Neither mode queries source connections nor asserts permissions. Sample form controls are inspection-only, not a writable form runtime. Modern control appearance and components remain approximations when properties require unavailable runtime hosts.

## Advanced geometric diagnostics

**Geometry review** identifies source-only hints for controls cropped by an immediate container, controls outside the selected viewport, large same-level overlaps (which may be intentional) and unresolved dimensions/visibility. Clicking an issue selects the source control. It is a bounded heuristic, not a claim of proven design defects or an inference about scroll state.

## Version comparison

Use **Export JSON report** after measuring a local screenshot. Download the report and keep it as a baseline; no screenshot or pixel array is exported. After a source change, reimport the same screen and matching viewport, load the corresponding reference, measure again and import the earlier JSON with **Compare previous report**. You will see changes in mean RGB error, RMSE, changed pixels and per-control improvements/regressions. Incompatible screen names, viewports or thresholds are explicitly rejected. Control names may be sensitive, so review downloaded reports before sharing.

## Microsoft Power Fx parser

The pre-existing, independently maintained Microsoft PowerFx .NET WebAssembly host is packaged in the static web deployment. Its syntax results are displayed in the Diagnostics panel after it loads. If WASM is unavailable, the existing TypeScript lexical analyzer remains active and the UI says the official parser is unavailable.

**Parsing is not runtime evaluation.** Syntax validity from Microsoft.PowerFx does not grant permissions to execute a Canvas behavior or validate a formula against unavailable SQL schema, control symbols or Power Apps services. The local navigation sandbox remains allowlist-based.

Microsoft references:
- https://github.com/microsoft/Power-Fx
- https://github.com/microsoft/PowerApps-Tooling/tree/master/schemas/pa-yaml/v3.0
- https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/power-apps-yaml
- https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-navigate
- https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-set
- https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-updatecontext

## Remaining fidelity limitations

Canvas runtime rows, authenticated source permissions, native control theme metrics, deep component-library bindings, action functions outside the local allowlist and app-specific Power Fx functions cannot be reproduced from YAML alone. The correct benchmark is a screenshot and equivalent sanitized runtime state, not a claim that every YAML property is fully executable.
