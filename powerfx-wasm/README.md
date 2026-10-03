# Power Fx WebAssembly semantic engine

This project is the local browser host for the official open-source Microsoft Power Fx engine.

It is intentionally separate from the TypeScript fast lexer.

## Responsibilities

The WebAssembly host is intended to become authoritative for:

- Power Fx syntax parsing;
- diagnostics and source spans;
- binding/type checking once Canvas symbols are supplied;
- pure/local evaluation in explicitly safe contexts.

The TypeScript layer remains useful for instant indexing while the heavier WebAssembly runtime loads.

## Packages

Pinned:

- `Microsoft.PowerFx.Core 1.8.1`
- `Microsoft.PowerFx.Interpreter 1.8.1`

The project uses Microsoft's published packages rather than reimplementing Power Fx semantics.

## Exported API

The first build exports:

- `Parse(formula, locale, allowsSideEffects)`
- `Check(formula, locale, allowsSideEffects)`

Results are JSON strings to keep the JavaScript interop boundary stable.

## Current limitation

`Check` currently has no Canvas symbol table. A formula can therefore parse successfully and still report unresolved Canvas symbols during binding.

The next stage will construct a symbol context from the normalized app model for:

- App / Parent / Self;
- controls and their typed properties;
- ThisItem / ThisRecord;
- variables and collections;
- components;
- named formulas/UDFs;
- known data-source schemas.

No connector is executed by this engine.

## Browser boundary

The final Vite integration should load this engine lazily in a Web Worker so large apps do not block the UI thread.
