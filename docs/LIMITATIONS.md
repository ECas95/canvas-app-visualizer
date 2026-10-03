# Limitations

## Not Power Apps Studio

Canvas App Visualizer is an independent inspection tool. It does not host the Power Apps runtime.

It cannot guarantee:

- pixel-perfect rendering;
- default property reconstruction;
- theme/runtime behavior;
- connector results;
- control lifecycle behavior;
- formula side effects;
- responsive formulas that depend on `Parent`, `Self`, `App`, or runtime state.

## Approximate preview

Only statically resolvable literal geometry is positioned exactly.

Dynamic geometry is represented with fallback coordinates and dashed outlines.

Galleries, forms, components, and responsive containers can have runtime behaviors that an approximate static preview cannot reproduce.

## Static analysis

Analyzer findings are hints with explicit confidence.

A connector-dependent delegation warning is not equivalent to a Studio delegation warning.

## YAML schema

Microsoft describes the active Canvas source schema as under active development. New controls/properties may appear before this project supports them explicitly.

## Package handling

The importer reads active `.pa.yaml` source from modern `.msapp` packages. Older packages with no active `Src/` source need conversion/resave through current Power Apps tooling.
