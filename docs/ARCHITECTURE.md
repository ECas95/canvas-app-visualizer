# Architecture

## Goals

Canvas App Visualizer is built around an environment-independent core.

```text
.msapp / .pa.yaml
        |
        v
Source importer
        |
        v
YAML parser
        |
        v
Normalized Canvas model
        |
        +-------------------+
        |                   |
        v                   v
Approximate renderer   Static analyzer
        |                   |
        v                   v
Screen preview         Diagnostics
        \                   /
         \                 /
          v               v
             Workbench UI
```

## Layers

### Source importer

Accepts:

- one `.msapp` package;
- one or more `.pa.yaml` / YAML files.

For `.msapp`, only active Canvas source under `Src/` is inspected. Other package JSON is ignored.

### Normalized model

The UI does not work directly against arbitrary YAML objects.

The normalizer creates stable concepts:

- App
- Screen
- Component
- Control
- Properties
- Children
- Data source names
- Source paths

This isolates the UI and analyzer from source-format details.

### Visual renderer

The renderer is deliberately approximate.

Literal values such as:

- `X: =40`
- `Y: =80`
- `Width: =300`
- `Fill: =RGBA(...)`
- `Text: ="Hello"`

can be represented directly.

Formula-driven geometry such as `=Parent.Width - 40` is not executed. The renderer uses fallback geometry and marks the control as dynamic.

### Static analyzer

The analyzer consumes the normalized model and formula references.

Current rule families:

- basic formula delimiter/string validation;
- repeated `LookUp`;
- `ForAll` + `Patch` review;
- `ClearCollect` local-materialization/delegation risk;
- connector-dependent delegation review;
- write-operation error-handling review;
- long/repeated formula maintainability;
- startup navigation/data-work hints;
- serialized accessibility-label review.

Every rule carries a confidence level.

## Future isolation

The analyzer should become a reusable package so a future Power Fx tester/validator can share diagnostics without coupling to the Canvas UI.
