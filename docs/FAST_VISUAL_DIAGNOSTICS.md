# Visual diagnostics v0.6

Canvas App Visualizer now provides a faster and more reproducible way to evaluate differences between a local screenshot of Power Apps and a Canvas source-based preview.

## Improvements shipped

**1. Scanline-based performance.** For a Canvas viewport containing `P = width × height` pixels, `H` rows and `R` bounded regions, comparison is now `O(P + H × R)` instead of rescanning every pixel in every overlapping control. The algorithm processes one image row at a time with three prefix arrays: absolute RGB channel differences, squared RGB differences and pixels above the threshold. Storage beyond the output heatmap is `O(width + R)`; this matters for hundreds of nested labels, cards and containers.

**2. Consistent regional accuracy.** RMSE is `sqrt(sum(channel_delta²) / (pixels × 3))`, both for the whole screen and for each clipped control region. Previous regional RMSE used `sqrt(mean_rgb_error²)` per pixel, which systematically understated a pure red mismatch.

**3. Prioritize actionable corrections.** The report lets you rank regions by:
- **Largest total impact** (area × mean absolute RGB error): useful for finding big incorrectly placed containers, gallery backgrounds and cards.
- **Highest average error**: useful for small but drastically different controls, e.g. an incorrect icon or color.

Nested regions and gallery sample slots can overlap, so their impact values are **not additive** and are not claims about unique affected pixels.

**4. Choose sensitivity.** Use **Pixel threshold** (0–128/255 in steps of 8) and rerun **Measure difference**. Results are discarded automatically when the threshold changes, as well as when source controls, screen state, local fixture, viewport or scrolling change.

**5. Export an inspection report.** Choose **Export JSON report** to download a local-only JSON document with the screen name, reference file name, measurement time, metrics, rankings and source control names. Image contents, heatmaps, credentials and raw local gallery records are excluded. Names may themselves be sensitive; share a report only after reviewing it.

## Recommended validation workflow for scrMain

Import the original .msapp, select scrMain and the correct desktop viewport, and load a **cropped Canvas-only** screenshot through Reference image. When available, supply a local record fixture matching the displayed source state; external SQL queries are never executed by the visualizer. Select **Measure difference** to see the overall error and red heatmap. Start with **Largest total impact** to fix major container geometry, then use **Highest average error** to inspect icons, button labels and nested styling. Click a ranked region to locate its Canvas source control. Export the JSON report as a local comparison baseline, repeat the measurement after fixes and compare both reports.

## What the scores do not establish

An RGB difference is not a certification of functional correctness or runtime fidelity. Incorrect or missing SQL rows, permissions, dynamic states, fonts, scroll position, image assets or theme cause mismatches even if the source layout formulas are correct. The reference and rendered Canvas must show the same runtime state for meaningful comparison. Source-only gallery placeholders must never be interpreted as verified records.

## Validation

Vitest verifies zero error, exact RGB channel RMSE, nested clipped regions, compositing and 400 overlapping source bounds against brute-force calculations. Chromium browser smoke tests also verify export, prioritization, sensitivity changes, heatmap, same-viewport reference requirements and invalidation. No private application YAML or screenshot is committed.
