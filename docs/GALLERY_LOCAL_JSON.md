# Local JSON Gallery previews

Canvas Gallery.Items may refer to SQL, Dataverse, collections or filtered sources. The YAML describes a repeating template, not the rows loaded at runtime. This optional mode uses explicit **browser-local** scalar fixtures, without querying connectors.

## How to try

1. Import your .msapp or .pa.yaml and choose a screen.
2. Turn on **Gallery samples (synthetic)** in Visual.
3. If more than one gallery appears, choose a target in **Gallery**.
4. Save a JSON array (1–6 objects) with field names found in the template's ThisItem/ThisRecord references.
5. Load the file with **Local JSON**; the browser binds its scalar fields into the YAML-defined controls.
6. Use **Clear local rows** or switch screens to discard the data.

## Example (purely fabricated, not exported from a user's application)

```json
[
  {
    "Name": "Example module A",
    "Category": "Operations",
    "Details": "A local preview record",
    "IsEnabled": true,
    "HasAccess": false,
    "AccentColor": "#006064",
    "AccentFill": "#DDF7F4",
    "ActionText": "Open"
  },
  {
    "Name": "Example module B",
    "Category": "Reporting",
    "Details": "A second local preview record",
    "IsEnabled": false,
    "HasAccess": false,
    "AccentColor": "#64748B",
    "AccentFill": "#E2E8F0",
    "ActionText": "Unavailable"
  }
]
```

## Safety and limitations

- File contents remain in browser component memory. No upload, analytics, SQL, Dataverse, API or flow call occurs.
- Local HasAccess and IsEnabled are **illustrative values**, not evidence of actual roles or permission grants.
- The Gallery template remains noninteractive. Behavior formulas are never executed as part of sample rendering.
- At most 64 KB, 1–6 records, 48 fields per record, 512 characters per string, only text/finite numbers/Booleans; no nested objects, arrays or nulls.
- Missing fields or unsupported expressions remain unresolved or display bracketed placeholders.
- Use hexadecimal color strings such as #006064 for AccentColor; actual Power Fx typed Color records are beyond this scalar preview.
- The source-only no-rows mode remains the default. A local JSON file is never a validated SQL/Dataverse data snapshot.

## Microsoft reference

https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-gallery
https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-lower-upper-proper
https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/power-apps-yaml

## Per-record card appearance

When the imported YAML already declares the following properties, the portal can
resolve them for each **explicitly supplied** local JSON record:

- A Gallery template background, for example `TemplateFill = If(ThisItem.IsEnabled, Color.Green, Color.Red)`.
- A Classic Icon chosen from a locally bound text category, for example
  `Icon = Switch(ThisItem.Category, "Operations", Icon.Settings, "Reporting", Icon.Document, Icon.Information)`.
- Local media embedded in the original MSAPP package, referenced statically in
  the card template as `Media.CompanyLogo`. Only vetted local raster assets
  are used; remote image requests remain blocked.

Text `Switch` icon selection requires a locally supplied `ThisItem` or
`ThisRecord` text field and literal string case values. The source-only mode
must not infer the result from SQL or a runtime collection. Unsupported icon
enums remain explicitly unknown; the additional glyphs are local SVG
approximations rather than a binary copy of Microsoft Power Apps resources.

The synthetic browser regression fixture is in
`tests/fixtures/SyntheticResponsive.pa.yaml` and
`tests/fixtures/SyntheticGalleryRows.json`. The Chromium visual suite
validates two local row cards with different glyphs, verified background
colors, and wrapped positions; screenshots are uploaded as CI artifacts.
These fixtures do **not** measure pixel-identical rendering against Power
Apps Studio. A genuine screenshot comparison additionally needs a
user-provided reference at the same viewport and runtime state.
