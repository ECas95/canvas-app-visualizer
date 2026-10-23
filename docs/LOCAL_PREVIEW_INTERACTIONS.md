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

## Explicitly blocked and out of scope

`Patch`, `SubmitForm`, `ClearCollect`, `Collect`, `Remove`, `Refresh`, `Navigate`, flow invocation, `User()`, SQL, Dataverse, external connector calls, custom functions, arbitrary browser/JS code and all other non-allowlisted functions are **never executed**. Missing runtime values are not invented.

The scope of the preview variables is the current screen/session; this does **not** assert parity with Power Apps global and screen context scopes. The browser does not persist them. An `OnVisible` containing even one unsupported call is rejected wholesale; the simulator cannot partially replay real initialization. No security/permission decisions should be inferred from these simulated values.

As a result, the six SQL-backed records in scrMain remain unavailable unless verified source data is separately supplied. This mode is for UI behavior investigation, not functional UAT.

## Microsoft upstream references

- Power Fx behavior formulas and sequencing: https://github.com/microsoft/Power-Fx/blob/main/docs/imperative.md
- Variables and recomputation: https://github.com/microsoft/Power-Fx/blob/main/docs/variables.md

This limited local action validator is **not** a replacement for the official Microsoft parser in PR #13. Later development should use official Power Fx AST/binding before expanding allowable semantics.

- Microsoft UpdateContext record semantics: https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-updatecontext
