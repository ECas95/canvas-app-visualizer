# Static Analyzer Rules

Static analysis is advisory. It does not execute the Power Apps runtime.

| Rule | Category | Default severity | Confidence |
|---|---|---:|---|
| `powerfx.syntax.delimiters` | Syntax | Error | High |
| `powerfx.performance.repeated-lookup` | Performance | Warning | Medium |
| `powerfx.performance.forall-patch` | Performance | Warning | Medium |
| `powerfx.delegation.clearcollect` | Delegation | Warning | High |
| `powerfx.delegation.connector-dependent` | Delegation | Info | Medium |
| `powerfx.reliability.write-error-handling` | Maintainability | Info | Low |
| `powerfx.maintainability.long-formula` | Maintainability | Info | Medium |
| `powerfx.maintainability.duplicate-formula` | Maintainability | Info | Medium |
| `canvas.startup.navigate-onstart` | Performance | Warning | Medium |
| `canvas.startup.heavy-onstart` | Performance | Warning | Medium |
| `canvas.accessibility.label` | Accessibility | Info | Medium |

## Delegation

Delegation is connector-sensitive.

The MVP intentionally avoids claiming that an expression is definitely delegable or nondelegable when that requires knowledge of the connector, column type, or runtime configuration.

Future versions will add explicit connector profiles for Dataverse, SQL Server, SharePoint, and supported connectors.

## Syntax

The MVP's built-in syntax rule catches structural delimiter/string problems only. It is not a complete Power Fx parser.

A future analyzer package should integrate the open-source Microsoft Power Fx parser/binder for richer syntax and type diagnostics.
