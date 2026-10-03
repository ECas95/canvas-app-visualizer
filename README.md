# Canvas App Visualizer

[![CI](https://github.com/ECas95/canvas-app-visualizer/actions/workflows/ci.yml/badge.svg)](https://github.com/ECas95/canvas-app-visualizer/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/ECas95/canvas-app-visualizer/actions/workflows/pages.yml/badge.svg)](https://github.com/ECas95/canvas-app-visualizer/actions/workflows/pages.yml)

**Live web app:** https://ecas95.github.io/canvas-app-visualizer/

Open-source, local-first visualizer and static analyzer for Microsoft Power Apps Canvas Apps.

Open a modern `.msapp` package or current `.pa.yaml` source and inspect screens, controls, serialized properties, Power Fx formulas, static diagnostics, delegation risks, and technical optimization opportunities without requiring an active Power Apps Studio session. Historical `.fx.yaml` packages are also supported in read-only compatibility mode.

> Canvas App Visualizer is an independent project and is not affiliated with or endorsed by Microsoft. It does not replace Power Apps Studio or the Power Apps runtime.

## Current MVP

- open modern `.msapp` packages directly in the browser;
- prefer active `Src/*.pa.yaml` source and open historical `Src/*.fx.yaml` in read-only compatibility mode;
- validate current Canvas source against Microsoft's public v3 schema locally;
- normalize App, Screens, Components, DataSources, EditorState, Controls, Properties, and nested Children;
- preserve control version, variant, layout, component, and source-format metadata;
- display a searchable control hierarchy;
- render an approximate screen preview with safe evaluation of common `Parent`, `Self`, `App`, gallery-template, sibling-geometry, and AutoLayout formulas;
- inspect serialized formulas and properties;
- lex Power Fx with awareness of strings, interpolation islands, quoted identifiers, comments, operators, records/tables, and qualified function calls;
- load Microsoft's official Power Fx parser locally through browser WebAssembly for authoritative syntax diagnostics when available;
- surface structural, performance, delegation, maintainability, startup, and accessibility review hints;
- classify analyzer findings by severity and confidence;
- process files locally with no application upload API;
- enforce package/source size safety limits;
- test current/legacy package import, schema validation, Power Fx lexical behavior, and layout logic with Vitest.

## Why approximate?

Power Apps formulas can calculate layout at runtime:

```powerfx
=Parent.Width - Self.Width - 24
```

A static viewer cannot resolve that expression correctly without recreating the Power Apps runtime, control defaults, parent state, themes, data, and other dependencies.

Canvas App Visualizer therefore resolves only formulas whose dependencies are known locally. It can already evaluate a safe subset of arithmetic, responsive `If` expressions, `Parent`/`Self`/`App` geometry, sibling dimensions, gallery template dimensions, and supported AutoLayout properties. Everything else remains explicitly unresolved and is rendered with fallback geometry.

It does **not** claim to be a pixel-perfect Power Apps emulator.

## Supported source

Microsoft's active Canvas source uses `.pa.yaml`. Modern `.msapp` packages contain those files under `Src/`, which this project extracts locally.

The project also opens the retired experimental `.fx.yaml` source found in many public historical Canvas samples, but only for read-only inspection and migration research.

Package JSON outside selected Canvas source is deliberately ignored as unstable source material.

See [Format Support](docs/FORMAT_SUPPORT.md) and the [Public .msapp Research Corpus](docs/MSAPP_RESEARCH_CORPUS.md).

## Architecture

```text
.msapp / .pa.yaml
        |
        v
Safe source importer
        |
        v
YAML parser
        |
        v
Normalized Canvas model
        |
        +----------------------+
        |                      |
        v                      v
Approximate renderer      Static analyzer
        |                      |
        +----------+-----------+
                   |
                   v
              Workbench UI
```

See [Architecture](docs/ARCHITECTURE.md).

## Analyzer

The MVP currently includes review rules for:

- malformed/unbalanced Power Fx delimiters;
- repeated `LookUp` calls;
- `ForAll` + `Patch`;
- `ClearCollect` and local materialization;
- connector-dependent delegation;
- write-error handling;
- large/repeated formulas;
- potentially heavy `App.OnStart`;
- navigation coupled to `App.OnStart`;
- serialized accessibility labels.

Delegation findings are deliberately conservative because actual delegation depends on the data source, connector, column types, and expression shape.

See [Analyzer Rules](docs/ANALYZER_RULES.md).

## Run locally

Requirements:

- Node.js 22+
- npm

```bash
git clone https://github.com/ECas95/canvas-app-visualizer.git
cd canvas-app-visualizer
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm test
npm run build
```

## Privacy

The MVP uses browser file APIs and performs parsing/analyzing locally. It contains no upload endpoint.

Do not assume an arbitrary third-party deployment is trustworthy merely because the upstream source is local-first. For sensitive apps, review and run the source yourself.

See [Security Policy](SECURITY.md).

## Project direction

The intended product is a web application with a desktop distribution using the same core parser/analyzer.

The deployed web application now bundles a local WebAssembly build of Microsoft's open-source Power Fx engine. Official parsing is used for syntax diagnostics; the TypeScript lexer remains a fast indexer/fallback.

Planned work includes:

- app-aware Power Fx binding and type checking;
- connector-aware delegation profiles;
- dependency/call graphs;
- richer responsive-container, gallery, form, and component rendering;
- before/after visual and formula diff;
- diagnostic report export;
- desktop shell.

See [Roadmap](ROADMAP.md).

## Source-format references

The project follows Microsoft's current Canvas source-code documentation and schema rather than the retired `.fx.yaml` format.

Relevant upstream references are documented in [docs/FORMAT_SUPPORT.md](docs/FORMAT_SUPPORT.md). The semantic Power Fx strategy is documented in [docs/POWER_FX_COMPATIBILITY.md](docs/POWER_FX_COMPATIBILITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
