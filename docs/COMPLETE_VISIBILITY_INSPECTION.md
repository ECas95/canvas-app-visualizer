# Canvas App Visualizer v0.8 — inspect every authored control

The new **All elements** mode is designed for auditing the **complete visual source hierarchy** of an imported `.msapp` or `.pa.yaml`, rather than pretending that source-only YAML reproduces authenticated runtime state.

## Three complementary preview modes

- **Visual** (default): conservative preview of the controls whose visibility and display content can be established. Controls with `Visible=false` are not rendered. If a parent's visibility or a Gallery's records depend on runtime state, descendants stay withheld and the parent is explicitly marked unknown. This is the correct mode for comparing screenshots.
- **Structure**: source geometry and gallery template guides without inventing rows.
- **All elements**: ghosts *every spatially placeable source control*, including `Visible=false`, controls behind hidden parents, unknown conditions, nested DataCards, GroupContainers and Gallery template definitions. Source geometry is used when verifiable; unresolved dimensions and nonparticipating hidden AutoLayout elements are clearly marked **estimated**.

In All elements, you see a blue outline for source-resolved visible nodes, red for effectively hidden nodes and amber for conditional nodes whose runtime visibility cannot be established. A control's direct `Visible` condition is assessed independently from its inherited effective visibility. A child with `Visible=true` inside `Visible=false` is **effectively hidden**, never treated as visible. A child of an unresolved parent is **effectively unknown** unless the child itself is provably false.

Gallery children are **template definitions**, not proof of one or more live database records; the editor displays each definition once in its local template coordinates and marks it `TEMPLATE`. No SQL rows or user permissions are assumed.

## Auditing every condition and geometric property

Expand **Visibility inventory** in the preview footer. It shows:
- The number of controls included compared with the declared source hierarchy.
- Counts of hidden nodes, unresolved conditions and template definitions.
- Search by name, control type or `Visible` expression.
- Filters for **All controls**, **Hidden (effective)**, **Condition unresolved** and **Gallery templates**.
- Original source `Visible` formulas and numerical X/Y/Width/Height, with **source-resolved** or **estimated** confidence.

Click any row or ghosted shape to open its original YAML properties in the inspector. Results are paginated to avoid overwhelming the browser. If a pathological source exceeds the renderer's depth/budget, the inventory says **Incomplete coverage** rather than claiming all controls were rendered.

In All elements, the SVG viewBox extends within a bounded area beyond the configured Canvas viewport to reveal controls just outside the screen, while the original viewport remains outlined separately. Very distant coordinates are reported by the inventory but may not be visible within the bounded SVG area.

## Conditional visibility without real app data

Upload **Scenario variables JSON** in All elements to supply a **synthetic, local-only scalar scenario**. Example:

```json
{
  "varAuthorized": true,
  "varActiveSection": "Operations",
  "varItemCount": 3
}
```

A source formula `Visible = varAuthorized` will change from **UNKNOWN** to **VISIBLE** in that synthetic scenario, or **HIDDEN** if the example value is false. `Visible = App.Width > 720` can already be evaluated from the selected viewport.

These are illustrative **test inputs**, not values read from the MSAPP, SQL or identity providers. Uploads are limited to an 8 KB JSON object with up to 48 safe scalar keys. Arrays, objects, reserved identifiers, connector calls, JS evaluation and credentials are not accepted. Clear the scenario to return to source-only unknown state.

## AutoLayout, galleries and nested elements

Hidden AutoLayout controls are excluded from live flow, but included in All elements as **approximate source positions** when the real post-layout slot cannot be determined. This does not alter sibling coordinates or fabricate a reserved empty space at runtime. Nested controls inherit their immediate parent geometry and visibility; Gallery descendants are shown relative to one template-definition origin, never as database rows.

## Validation and limitations

Generic synthetic regression source: `tests/fixtures/SyntheticVisibility.pa.yaml`; synthetic scenario `tests/fixtures/SyntheticVisibilityScenario.json`. Unit and Chromium tests validate hidden descendants, inherited conditions, known/unknown scenarios, template controls, off-viewport geometry and safe default Visual mode. These fixtures contain no actual client source or personal data.

A Power Apps source file does not contain the authenticated runtime state needed to conclusively decide every `Visible` formula or reproduce every control type's exact appearance. A `Visible` expression depending on SQL, flows, `User()`, permissions, `ThisItem`, collections or unsupported functions remains **UNKNOWN** unless known local scalars can resolve it. Even when a formula is source-resolved, the visual approximation is not certified as pixel-identical to Power Apps Studio. This mode is intentionally for **design and logic inspection**, not genuine control execution.
