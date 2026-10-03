# Contributing

Canvas App Visualizer is a public, local-first project.

## Ground rules

- Use only synthetic, public, or otherwise publishable Canvas source.
- Do not commit tenant IDs, environment URLs, user identities, customer data, connection details, secrets, or proprietary app source.
- Keep diagnostics evidence-based. A static rule must not be presented as a guaranteed runtime defect when the result depends on connector/runtime context.
- Add tests for parser, normalizer, layout, or analyzer changes.
- Prefer small rules with explicit confidence and limitations.

## Development

Requirements:

- Node.js 22 or newer
- npm

Run:

```bash
npm install
npm run dev
npm test
npm run build
```

## Adding an analyzer rule

A finding must include:

- stable `ruleId`;
- severity;
- category;
- title and explanation;
- confidence level;
- actionable suggestion where appropriate.

Rules that depend on the connector should say so.

## Source-format changes

Microsoft's Canvas source schema is actively developed. When adapting to a schema change:

1. link the upstream schema or documentation in the pull request;
2. add a synthetic fixture;
3. update parser/normalizer tests;
4. document compatibility in `docs/FORMAT_SUPPORT.md`.

## Pull requests

Keep changes focused and explain:

- what changed;
- which source formats/controls are affected;
- how the change was tested;
- known limitations.
