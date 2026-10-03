# Power Fx Compatibility Architecture

Canvas App Visualizer should not implement a second, incompatible version of Power Fx.

Power Fx has several layers that must be kept separate when reporting what the visualizer knows.

## 1. Lexical layer

Examples:

- identifiers and quoted identifiers;
- strings with doubled quote escaping;
- numbers;
- comments;
- operators and separators;
- parentheses, records, and tables.

The TypeScript core now has a local lexer for fast structural analysis. Its purpose is to avoid regex false positives and support lightweight indexing.

It is **not** the final authority for Power Fx validity.

## 2. Parser layer

The official Microsoft Power Fx implementation exposes parsing through `Microsoft.PowerFx.Core`.

The project should use that parser for authoritative syntax diagnostics rather than indefinitely expanding a home-grown parser.

## 3. Binding and type layer

A syntactically valid formula is not necessarily valid in a Canvas app.

Binding depends on symbols and types such as:

- App;
- Parent;
- Self;
- ThisItem / ThisRecord;
- sibling and cross-screen controls;
- variables created by `Set` and `UpdateContext`;
- collections;
- named formulas;
- user-defined functions;
- component inputs/outputs/actions/events;
- data sources and their schemas;
- enum values.

The visualizer therefore needs an app symbol model, not just a formula parser.

## 4. Evaluation layer

The open-source `Microsoft.PowerFx.Interpreter` package provides `RecalcEngine` and evaluation APIs for supported Power Fx expressions.

Evaluation is useful for values whose dependencies are known locally, such as some pure layout calculations.

It must not be used to invent values for unknown controls, connectors, or data.

## 5. Canvas host semantics

Canvas Apps add host concepts around Power Fx:

- control properties and defaults;
- declarative property recalculation;
- behavior properties such as `OnSelect`;
- screen navigation and lifecycle;
- galleries/forms/components;
- responsive container layout;
- app settings and runtime state.

A generic Power Fx engine alone cannot reproduce Power Apps Studio.

## 6. Connector and delegation semantics

Delegation is not a grammar feature.

It depends on:

- connector;
- operation;
- column type;
- expression shape;
- server capabilities;
- current platform behavior.

Delegation analysis must therefore stay connector-aware and evidence-based.

## Browser execution strategy

Microsoft has already demonstrated the relevant architecture in public code.

`microsoft/PowerApps-TestEngine` contains a Blazor WebAssembly Power Fx project using:

- `Microsoft.PowerFx.Core`;
- `Microsoft.PowerFx.Interpreter`;
- `RecalcEngine`;
- `ParserOptions`;
- `[JSExport]` for JavaScript interop.

Microsoft has also publicly described Copilot Studio running .NET/Power Fx validation and expression processing in WebAssembly inside the browser.

That makes a local WebAssembly semantic engine the preferred direction for this project.

## Proposed semantic engine

```text
React / TypeScript UI
        |
        +---- fast TS lexer/indexer
        |
        v
Web Worker
        |
        v
.NET WebAssembly
        |
        +---- Microsoft.PowerFx.Core
        |       parser
        |       binder
        |       types
        |       dependency analysis
        |
        +---- Microsoft.PowerFx.Interpreter
                partial/local evaluation
```

The Web Worker boundary is important because parsing/binding a large app should not block the visualizer UI.

## Analysis modes

### Syntax mode

Requires no app symbol model.

Produces:

- official parse errors;
- source spans;
- tokens/structure where exposed.

### Contextual binding mode

Builds a synthetic symbol table from the normalized Canvas app.

Produces:

- unresolved names;
- type mismatches;
- dependencies;
- return types;
- function binding.

Unknown external symbols must be reported as unresolved/unknown rather than guessed.

### Static evaluation mode

Allowed only when all required dependencies are known and the expression is safe/pure for local evaluation.

Examples that may become evaluable:

- numeric constants;
- RGBA values;
- arithmetic based on known Parent/App dimensions;
- some `If` expressions using known viewport values.

Examples that remain runtime-dependent:

- connector queries;
- user input;
- `Patch`, `Collect`, navigation and other side effects;
- volatile/time/location functions;
- gallery item state;
- external component behavior.

## Canvas numeric semantics

For Canvas-style formula analysis, the official host examples use parser options including side-effect support where appropriate and floating-point numeric behavior for Canvas scenarios.

The project must test its host options against real Canvas formulas before claiming equivalence.

## Current status

Implemented now:

- current/legacy source separation;
- official Canvas v3 structural schema validation;
- a comment/string-aware Power Fx lexer;
- function-call and structural facts used by static analyzer rules.

Not yet authoritative:

- full Power Fx parsing;
- binding/type checking;
- formula evaluation;
- Canvas runtime emulation.

These belong to the official-engine WebAssembly phase, not to additional TypeScript regex rules.

## Upstream references

- https://github.com/microsoft/Power-Fx
- https://github.com/microsoft/PowerApps-TestEngine/tree/main/src/blazor/powerfx
- https://www.nuget.org/packages/Microsoft.PowerFx.Core/
- https://www.nuget.org/packages/Microsoft.PowerFx.Interpreter/
- https://learn.microsoft.com/power-platform/power-fx/overview
- https://learn.microsoft.com/power-platform/power-fx/expression-grammar
