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

Microsoft has also publicly described Copilot Studio running .NET and Power Fx validation/expression processing in WebAssembly inside the browser, with work moved to Web Workers so the main UI thread stays responsive.

That makes a local WebAssembly semantic engine the preferred direction for this project.

For the first official-engine implementation, the project should pin stable package versions rather than floating builds. The current stable NuGet line researched for this design is `Microsoft.PowerFx.Core 1.8.1` and `Microsoft.PowerFx.Interpreter 1.8.1`. The browser host should target .NET 10 and load lazily because the WebAssembly runtime is materially heavier than the TypeScript indexer.

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


## Locale and serialization context

Power Fx itself is locale-sensitive: the decimal separator, list separator, and behavior chaining separator can change with the authoring language.

Canvas source analysis must therefore keep two concepts separate:

- the formula text serialized in the inspected source;
- interactive formulas typed by a maker in a localized formula bar.

The lightweight TypeScript layer does not claim full localized parsing. The official Microsoft Power Fx host must receive explicit `ParserOptions` / culture context when locale-sensitive input is analyzed.

Until that semantic host is integrated, locale-dependent syntax outside the observed Canvas source form should be reported as requiring official-parser verification rather than normalized by guesswork.

## Interpolated strings

Power Fx interpolation uses `$"...{formula}..."`. Literal braces are escaped by doubling them, and interpolation can be nested.

The fast lexer treats literal interpolation text as opaque text while recursively tokenizing formula islands. This allows dependency/function indexing to see expressions such as:

```powerfx
=$"data:application/octet-stream;base64,{locAttachmentData}"
```

without incorrectly treating words in the surrounding text as function calls.

This remains a lexical/indexing feature. Authoritative parse, coercion, typing, and evaluation belong to Microsoft.PowerFx.Core / Interpreter.

## Current status

Implemented now:

- current/legacy source separation;
- official Canvas v3 structural schema validation;
- a comment/string-aware Power Fx lexer;
- interpolated-string islands, escaped braces, and nested interpolation in the fast lexer;
- function-call and structural facts used by static analyzer rules;
- a deliberately limited static evaluator for known pure values;
- safe layout evaluation for numeric/string/boolean expressions whose dependencies are known;
- iterative sibling geometry resolution for expressions such as `Parent.Height - Header.Height`;
- approximate AutoLayout flow for supported, statically resolvable properties.

Authoritative syntax layer:

- a pinned .NET 10 WebAssembly build of Microsoft.PowerFx.Core 1.8.1 is produced in CI;
- the deployed site lazy-loads that runtime locally and batch-parses Canvas formulas;
- official parser errors/warnings are mapped back to file, control/property, formula, and source span;
- the TypeScript lexer becomes fallback/indexing infrastructure when the WebAssembly engine is unavailable.

Not yet authoritative:

- app-aware binding/type checking;
- complete expression evaluation;
- Canvas control/runtime emulation;
- connector/delegation runtime equivalence.

These remaining layers require a Canvas-aware symbol/runtime model and must not be approximated by adding more TypeScript regex rules.

## Upstream references

- https://github.com/microsoft/Power-Fx
- https://github.com/microsoft/PowerApps-TestEngine/tree/main/src/blazor/powerfx
- https://devblogs.microsoft.com/dotnet/copilot-studio-dotnet-wasm/
- https://www.nuget.org/packages/Microsoft.PowerFx.Core/
- https://www.nuget.org/packages/Microsoft.PowerFx.Interpreter/
- https://learn.microsoft.com/power-platform/power-fx/overview
- https://learn.microsoft.com/power-platform/power-fx/expression-grammar
