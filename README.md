# Canvas App Visualizer

[![CI](https://github.com/ECas95/canvas-app-visualizer/actions/workflows/ci.yml/badge.svg)](https://github.com/ECas95/canvas-app-visualizer/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/ECas95/canvas-app-visualizer/actions/workflows/pages.yml/badge.svg)](https://github.com/ECas95/canvas-app-visualizer/actions/workflows/pages.yml)

**Live web app:** https://ecas95.github.io/canvas-app-visualizer/

Open-source, local-first visualizer and static analyzer for Microsoft Power Apps Canvas Apps.

Open a modern `.msapp` package or active `.pa.yaml` source and inspect screens, controls, serialized properties, Power Fx formulas, static diagnostics, delegation risks, and technical optimization opportunities without requiring an active Power Apps Studio session.

> Canvas App Visualizer is an independent project and is not affiliated with or endorsed by Microsoft. It does not replace Power Apps Studio or the Power Apps runtime.

## Current MVP

- open one modern `.msapp` directly in the browser;
- extract only active `Src/*.pa.yaml` source;
- open one or more `.pa.yaml` files directly;
- parse App, Screens, Components, DataSources, Controls, Properties, and nested Children;
- display a searchable-style control hierarchy;
- render an approximate screen preview;
- inspect serialized formulas and properties;
- identify YAML parser problems;
- detect basic Power Fx delimiter/string errors;
- surface static performance, delegation, maintainability, startup, and accessibility review hints;
- classify analyzer findings by severity and confidence;
- process files locally with no application upload API;
- enforce package/source size safety limits;
- load a synthetic demo immediately;
- test parser, analyzer, and layout helpers with Vitest.

## Why approximate?

Power Apps formulas can calculate layout at runtime:

```powerfx
=Parent.Width - Self.Width - 24
```

A static viewer cannot resolve that expression correctly without recreating the Power Apps runtime, control defaults, parent state, themes, data, and other dependencies.

Canvas App Visualizer therefore renders literal geometry exactly when possible and marks unresolved geometry with dashed controls and fallback positions.

It does **not** claim to be a pixel-perfect Power Apps emulator.

## Supported source

Microsoft's active Canvas source uses `.pa.yaml`. Modern `.msapp` packages contain those files under `Src/`, which this project extracts locally.

Package JSON outside `Src/` is deliberately ignored as source material.

See [Format Support](docs/FORMAT_SUPPORT.md).

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

Planned work includes:

- official Canvas v3 schema validation;
- Microsoft Power Fx parser/binder integration;
- connector-aware delegation profiles;
- dependency/call graphs;
- richer responsive-container, gallery, form, and component rendering;
- before/after visual and formula diff;
- diagnostic report export;
- desktop shell.

See [Roadmap](ROADMAP.md).

## Source-format references

The project follows Microsoft's current Canvas source-code documentation and schema rather than the retired `.fx.yaml` format.

Relevant upstream references are documented in [docs/FORMAT_SUPPORT.md](docs/FORMAT_SUPPORT.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
