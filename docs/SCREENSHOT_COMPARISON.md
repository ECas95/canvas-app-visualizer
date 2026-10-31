# Canvas App Visualizer v0.4 — reference comparison and local text formulas

## Compare an imported Canvas screen with its original screenshot

1. Import the .msapp/.pa.yaml into the web workbench. Choose the screen and the **Visual** tab.
2. Set the **Viewport** to match the original screenshot: Desktop 1366 × 768, Tablet 768 × 1024, or Phone 390 × 844.
3. In Power Apps, capture **only the Canvas content**, excluding Studio/editor chrome, toolbars, margins and browser borders. Crop to *exactly* the selected Canvas size.
4. Select that PNG, JPEG or WebP image under **Reference image**. The browser verifies the raster file header, decodes it and checks the width/height. Files larger than 8 MB, invalid formats and mismatched dimensions are rejected.
5. Use **Overlay reference** to enable or disable the image. Adjust **Opacity** from 0–100% to inspect alignment of the preview's controls, images, padding and gallery cards.
6. Select **Clear reference** to discard the image. Switching screens also clears the reference. Nothing is uploaded or committed to GitHub.

The overlay is pointer-events disabled and cannot trigger control actions. When you change to a different viewport, a reference whose dimensions do not match is withheld rather than stretched.

**Important:** This is a user-driven *visual comparison*, not automatic per-pixel parity measurement. The screenshot must have the same source/theme/runtime state to support a meaningful comparison. SQL-backed galleries also require appropriately provided local records to resemble their runtime state; the source alone cannot verify permissions or data.

## Newly supported deterministic Power Fx Gallery text

Local browser JSON data can now drive limited source expressions including:

- `Left(ThisItem.Name, 5)`
- `Right(ThisItem.Code, 3)`
- `Mid(ThisItem.Name, 2, 4)` or `Mid(ThisItem.Name, 2)`
- `Substitute(ThisItem.Code, "-", " ")` (or an explicitly numbered occurrence)
- `Concatenate("Module: ", ThisItem.Name)`

These pure functions resolve only bounded, known ASCII text scalars. Unsupported types, missing `ThisItem` data, locale-sensitive input, unknown connectors, malformed arguments and overlong results remain unresolved. The bounded evaluator does not execute Power Apps behavior code or external services.

Official references:
- https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-left-mid-right
- https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-replace-substitute
- https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-concatenate

## Testing and limitations

- Source-only preview remains the default.
- Vitest covers scalar functions, unverified inputs, known screenshot signatures, image-size mismatch and SSR overlay behavior.
- Playwright generates a **synthetic PNG in Chromium** and confirms that the local overlay appears at the matching viewport, is withheld on a different viewport, and returns when dimensions match again. A screenshot artifact is captured; no user screenshots are shipped with the repository.
- Visual comparison of actual Power Apps screen pixels remains a future calibration step. Never label a screenshot with unknown data as verified or claim 100% parity without real matching runtime data.
