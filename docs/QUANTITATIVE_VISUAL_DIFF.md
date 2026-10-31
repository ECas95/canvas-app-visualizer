# Quantitative Canvas screenshot comparison

The browser-only **Measure difference** action extends the manual reference overlay.

## Use

1. Import the Canvas .msapp or current .pa.yaml and select a screen in **Visual** mode.
2. Pick the same Desktop/Tablet/Phone viewport used to capture the original Canvas app.
3. Import a cropped, same-size PNG/JPEG/WebP from **Reference image**. The reference must show only Canvas pixels, without Power Apps Studio chrome.
4. If the Gallery is connected to external data, enable **Gallery samples** and optionally supply a local JSON fixture with the same fields/state as the reference. These values are visual examples, not authorization checks.
5. Choose **Measure difference**. The local browser rasterizes a copy of the source SVG **without the reference or previous heatmap layers**, compares pixels at the exact same size and shows a red difference heatmap. Use **Show heatmap** to toggle it. No image data is sent to a server.
6. Look at **Mean RGB error** (0–255), **RMSE** (0–255), and **Different pixels** (percentage where mean RGB error exceeds 32). Click a ranked source region to inspect the relevant container, gallery, nested control or gallery sample card. Nested regions overlap; do not add their scores together.
7. Changing screens, viewport, local rows, scrolling or other relevant visual state invalidates the previous measurement. Rerun after adjustments.

## What the numbers mean

- Mean absolute RGB error = average absolute difference across the 3 channels per pixel. Zero indicates identical rendered RGB values for this capture.
- Root mean square error (RMSE) penalizes larger differences.
- Differing pixels = percent of pixels whose **per-pixel mean RGB error** exceeds 32/255.
- A region is the intersection of the Canvas screen and a control/template cell bounding box. Ranking is by mean absolute error; it points to **where** differences accumulate, not automatically why.
- The heatmap is a red, alpha-scaled aid; it is not part of measured preview pixels.

**Important limits:** A mismatch in data, fonts, assets, theme, session permissions, visible state or screenshot cropping may dominate the score. Rasterizing SVG can produce differences from a full browser rendering of HTML/SVG, especially embedded foreignObject text or unsupported resources. The tool reports errors where it cannot safely rasterize; it does not claim pixel-perfect parity, SSIM, UAT success, or live Power Apps behavior. No SQL/Dataverse connector or runtime is executed.

## Current nested-layout correction

The Gallery sample renderer now distinguishes the Gallery item's **Parent.TemplateWidth/Height scope** from the immediate parent scopes of nested containers. Child controls within a nested container are measured using that container's own Parent.Width/Height, instead of incorrectly inheriting gallery template properties. Geometry whose formulas remain unresolved is not presented as verified.

## Validation

- Unit tests cover zero difference, known RGB channel changes, alpha compositing, clipped nested regions and limits.
- Chromium browser regression creates a synthetic screenshot, then verifies difference metrics, Gallery sample regions, heatmap, and invalidation when the viewport changes.
- All assets remain browser-local; local reference files are removed from preview state when switching screens or clearing the reference.
