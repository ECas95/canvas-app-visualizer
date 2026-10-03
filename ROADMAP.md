# Roadmap

## v0.1 — source visualizer MVP

- [x] open active `.pa.yaml`;
- [x] open modern `.msapp` and extract `Src/*.pa.yaml`;
- [x] normalize App / Screens / Components / Controls;
- [x] control hierarchy;
- [x] approximate visual canvas;
- [x] serialized property inspector;
- [x] static diagnostics with confidence levels;
- [x] local-only browser processing;
- [x] synthetic demo;
- [x] parser/analyzer/layout tests.

## v0.2 — richer validation

- [x] official v3 schema validation;
- precise source locations for schema findings;
- Microsoft Power Fx Core/Interpreter browser WebAssembly integration;
- [x] lightweight lexical function-call indexing;
- authoritative formula call tree from Microsoft Power Fx;
- app-aware symbol/dependency extraction and type binding;
- cross-control dependency graph;
- duplicate formula analysis across screens.

## v0.3 — delegation intelligence

- selectable data-source profiles;
- Dataverse rules;
- SQL Server rules;
- SharePoint rules;
- per-function/operator/column-type evidence;
- documentation links per finding;
- distinguish confirmed vs potential delegation findings.

## v0.4 — renderer

- [x] initial AutoLayout + safe responsive formula resolution;
- full responsive containers and wrapping;
- richer AutoLayout alignment, wrapping, overflow, and nested sizing;
- galleries/templates;
- forms/cards;
- components;
- theme/default-property profiles;
- screen-size profiles;
- zoom/pan and rulers.

## v0.5 — compare mode

- open two app snapshots;
- source diff;
- control tree diff;
- formula diff;
- layout diff;
- diagnostics regression view.

## v1.0 — web + desktop

- stable web application;
- installable desktop shell;
- local workspace/project support;
- export HTML/JSON diagnostic report;
- extension API for analyzer rules;
- documented compatibility matrix.
