# Interface Design Direction

Canvas App Visualizer uses an original productivity-tool interface influenced by general Fluent-style principles such as clear hierarchy, neutral surfaces, compact command areas, Segoe UI-compatible typography, accessible focus states, and restrained motion.

It does **not** reproduce Microsoft product branding, logos, icons, proprietary illustrations, or Power Apps Studio UI pixel-for-pixel.

## Principles

- Prioritize information density without looking like a generic dashboard.
- Keep the canvas workspace visually dominant.
- Use light neutral surfaces and thin separators instead of oversized cards.
- Use one restrained blue accent for selection and actions.
- Prefer compact command bars, panels, tabs, inspectors, and status areas.
- Use original geometric product marks and original SVG icons.
- Clearly distinguish source facts, static analysis, and approximate rendering.
- Preserve keyboard focus visibility and readable contrast.
- Avoid decorative gradients inside the engineering workbench.

## Landing page

The landing experience should feel like a developer/productivity tool rather than a marketing template.

Primary actions:

1. Open Canvas source.
2. Drag and drop source.
3. Load a synthetic demo.

Privacy information is visible next to the file action because source files may contain sensitive application logic.

## Workbench

The workbench follows a three-column desktop-tool pattern:

- left: App explorer;
- center: Canvas preview;
- right: Properties / Diagnostics.

A compact top command area shows the current app, local-processing state, and file action. A context bar exposes source type and analysis counts.

## Brand boundary

The project name may describe Microsoft Power Apps Canvas Apps, but the product identity remains independent.

Do not add:

- Microsoft logo;
- Power Apps logo;
- Fluent product icons copied from Microsoft assets without an appropriate license;
- product screenshots used as the application's own chrome;
- language suggesting Microsoft endorsement.

The custom blue geometric mark in the project is original to Canvas App Visualizer.
