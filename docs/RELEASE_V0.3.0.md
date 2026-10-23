# Canvas App Visualizer v0.3.0

## Release focus

The browser visualizer now supports an **opt-in local interactive Canvas preview**. It remains a static/source-first inspector, not Microsoft Power Apps Studio or the Power Apps runtime.

## Improvements
- Simulate simple scalar `Set(variable, expression)` and `UpdateContext({name: expression})` behavior from clicked `OnSelect` controls and manually triggered `Screen.OnVisible`.
- Separate simulated global and screen context variables with **Inspect state**, a visible status message, and a **Reset** action.
- Changes recalculate `Visible`, `Text`, limited checkbox/toggle values, conditional `Fill`/`Color`, `DisplayMode`, and statically resolvable geometry.
- Supports literal Power Fx colors (`Color.Green`, `RGBA(...)`, `ColorValue("#...")`), local hex color variables and conditional color selection with known `If` predicates.
- Known disabled controls are visually subdued, honor supported `DisabledFill`/`DisabledColor`, and do not execute their `OnSelect` behavior in preview.
- The synthetic Inventory Demo includes a safe toggle, hint, and dependent editable/disabled button.
- Adds unit and end-to-end regression tests for simulated behavior, rejection, color conditions and display state.

## Security and runtime boundaries

Disabled by default. No execution of SQL, Dataverse, connectors, HTTP calls, `Patch`, `ClearCollect`, `Navigate`, flows, browser JavaScript, authentication or authorization. Unsupported behavior or a required unresolved runtime value rejects the entire simulated action; it cannot partially apply known changes.

Source-dependent galleries remain **template previews** when rows are not available. No six-record app catalog or permissions are synthesized from the user's scrMain example.

The official Microsoft Power Fx parser in PR #13 remains separate and is not part of this release.

## Verification
- TypeScript / `npm run lint`
- Vitest / `npm test`
- Production / `npm run build`
- GitHub Actions CI gate and subsequent GitHub Pages deployment.

See [local interaction details](LOCAL_PREVIEW_INTERACTIONS.md) and [Microsoft sources](MICROSOFT_SOURCE_OF_TRUTH.md).
