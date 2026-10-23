# Local preview interactions (experimental)

The **Simulate local state** switch is off by default. When enabled, clicking a control with an `OnSelect` formula tries to apply a narrow subset of Microsoft Power Fx *locally in memory*. Use **Run OnVisible** to explicitly test a screen event; it never fires automatically. Use **Reset** or switch modes/screens to discard the state.

## Supported in this first increment

- Literal/scalar values (boolean, number, text), existing simulated variables, pure arithmetic/comparisons/If expressions from the existing static preview evaluator.
- `Set(variable, expression)` and `UpdateContext({ name: expression, ... })` when their targets and all values can be resolved entirely locally.
- Sequential `; ` statements, within fixed step, input-length and variable-count limits.
- Each `UpdateContext` literal record is evaluated from one pre-call variable snapshot; duplicate field names (ignoring case) and dependencies on fields created in the same record are rejected. Separate `;` actions still see earlier completed actions.

- Reactive preview visibility via `Visible` and static simulated variable state; text and checkbox/toggle state where resolvable.
- All actions are transactional: if any call or value is unsupported, **nothing** is committed.
- The preview validates **every nested call**, including calls inside unselected `If` branches, against a small pure-function allowlist (`If`, `Min`, `Max`, `Abs`, `Round`, `RoundUp`, `RoundDown`, `Coalesce`). Qualified calls such as `Connector.Max` and all other functions are rejected before any state update; this is a conservative preview safety rule, not a claim that Power Fx evaluates unselected branches.


## Static numeric rounding fidelity

The local static preview now follows the documented Power Fx direction for
`Round` (half ties away from zero), `RoundUp` (away from zero) and
`RoundDown` (toward zero), including negative values and negative decimal
places. Decimal exponent shifting avoids common JavaScript binary scaling
artifacts such as `Round(1.005, 2)`. Unsupported precision, nonintegral
decimal places, missing/extra arguments, and unsafe numeric ranges remain
**unresolved** rather than guessing a result. This affects both static
geometry and opt-in local behavior expressions; it does not execute external
effects.

Microsoft reference: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-round

## DisplayMode interaction guard

A simulated `OnSelect` is allowed only when the control's `DisplayMode` is absent (the preview's editable default) or resolves to `DisplayMode.Edit`. Explicit `DisplayMode.Disabled`, `DisplayMode.View`, and unresolved/dynamic values do not run behavior formulas; the control can still be selected for **inspection**. `If` formulas depending on known local preview variables are rechecked on each click. This conservative guard does not claim to reproduce all inherited Form/DataCard display modes or actual runtime permissions.

Microsoft documents that a disabled button does not trigger `OnSelect`: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/modern-controls/modern-control-button

## Host-object name safety

The preview conservatively rejects variable names that collide with JavaScript
object-prototype members (for example, `__proto__`, `constructor`,
`toString`) rather than reporting a successful assignment that the
in-memory JavaScript record cannot safely represent. This is a simulator
implementation guard, **not** a restriction asserted by Microsoft Power Fx.
The entire action batch rolls back when such a target is encountered.

## Conservative global/context collision guard

Microsoft Power Fx treats `Set` variables as app-global and `UpdateContext`
variables as screen-local. Both can legally share a name, with the context
variable taking precedence in unqualified formulas. This preview currently
stores scalar state in a **single flat record**, so a batch that assigns the
same case-insensitive name through both functions is **rejected transactionally**
rather than showing a false value. Repeated writes using the same function
kind and distinct global/context names still work.

This is deliberately **not** full scope parity: collisions across separate
`OnVisible`/`OnSelect` invocations cannot yet be reliably detected because
variable provenance is not persisted. Future work should maintain separate
global and per-screen contexts and use official Power Fx binding/AST (PR #13).
No SQL data, permissions, or connector state is inferred.

Official semantics:
- https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-set
- https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-updatecontext
- https://learn.microsoft.com/en-us/power-platform/power-fx/variables

## Explicitly blocked and out of scope

`Patch`, `SubmitForm`, `ClearCollect`, `Collect`, `Remove`, `Refresh`, `Navigate`, flow invocation, `User()`, SQL, Dataverse, external connector calls, custom functions, arbitrary browser/JS code and all other non-allowlisted functions are **never executed**. Missing runtime values are not invented.

The scope of the preview variables is the current screen/session; this does **not** assert parity with Power Apps global and screen context scopes. The browser does not persist them. An `OnVisible` containing even one unsupported call is rejected wholesale; the simulator cannot partially replay real initialization. No security/permission decisions should be inferred from these simulated values.

As a result, the six SQL-backed records in scrMain remain unavailable unless verified source data is separately supplied. This mode is for UI behavior investigation, not functional UAT.

## Microsoft upstream references

- Power Fx behavior formulas and sequencing: https://github.com/microsoft/Power-Fx/blob/main/docs/imperative.md
- Variables and recomputation: https://github.com/microsoft/Power-Fx/blob/main/docs/variables.md

This limited local action validator is **not** a replacement for the official Microsoft parser in PR #13. Later development should use official Power Fx AST/binding before expanding allowable semantics.

- Microsoft UpdateContext record semantics: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-updatecontext
