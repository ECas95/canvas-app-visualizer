/**
 * Browser-level Canvas renderer regression: synthetic source only.
 * Captures synthetic Chromium screenshots and verifies SVG geometry at
 * desktop/tablet/phone profiles. No Power Apps service, SQL or login.
 *
 * The images document this renderer, not pixel parity with Power Apps Studio.
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import JSZip from "jszip";
import { createServer } from "vite";

const profiles = [
  { name: "desktop", width: 1366, height: 768, columns: 3 },
  { name: "tablet", width: 768, height: 1024, columns: 2 },
  { name: "phone", width: 390, height: 844, columns: 1 }
];
const output = resolve("artifacts/visual");
await mkdir(output, { recursive: true });
const server = await createServer({
  server: { host: "127.0.0.1", port: 4173, strictPort: true },
  logLevel: "error"
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1720, height: 980 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce"
  });
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await page.locator('input[type="file"]').setInputFiles(
    resolve("tests/fixtures/SyntheticResponsive.pa.yaml")
  );
  const svg = page.getByRole("img", { name: "VisualRegression canvas preview" });
  await svg.waitFor({ timeout: 20000 });
  // A large Canvas preview should be the default, even for complex sources.
  assert.equal(await page.locator("#canvas-preview-tools").isVisible(), false);
  assert.equal(await page.locator("#canvas-preview-details").isVisible(), false);
  const compactStageHeight = await page.locator(".canvas-stage").evaluate(node =>
    node.getBoundingClientRect().height);
  await page.getByRole("button", { name: "Show controls" }).click();
  await page.getByRole("button", { name: "Show details" }).click();
  assert.equal(await page.locator("#canvas-preview-tools").isVisible(), true);
  assert.equal(await page.locator("#canvas-preview-details").isVisible(), true);
  const expandedStageHeight = await page.locator(".canvas-stage").evaluate(node =>
    node.getBoundingClientRect().height);
  assert.ok(compactStageHeight > expandedStageHeight + 40,
    "Collapsing diagnostic and toolbar bands must restore Canvas height");
  const report = [];

  for (const profile of profiles) {
    await page.getByLabel("Simulated viewport").selectOption(profile.name);
    await page.getByRole("button", { name: "Visual", exact: true }).click();
    const actual = await svg.evaluate(element => {
      const gallery = element.querySelector('[data-preview-gallery-records="unknown"] > rect');
      return {
        viewBox: element.getAttribute("viewBox"),
        galleryX: Number(gallery?.getAttribute("x")),
        galleryY: Number(gallery?.getAttribute("y")),
        galleryWidth: Number(gallery?.getAttribute("width")),
        galleryHeight: Number(gallery?.getAttribute("height")),
        unknownGalleries: element.querySelectorAll('[data-preview-gallery-records="unknown"]').length,
        phantomTemplateSlots: element.querySelectorAll('rect[stroke-dasharray="6 5"]').length,
        privateTemplateRendered: element.textContent?.includes("ThisItem.Title") ?? false
      };
    });
    assert.equal(actual.viewBox, `0 0 ${profile.width} ${profile.height}`);
    assert.equal(actual.galleryX, 20);
    assert.equal(actual.galleryY, 130);
    assert.equal(actual.galleryWidth, profile.width - 40);
    assert.equal(actual.galleryHeight, 350);
    assert.equal(actual.unknownGalleries, 1);
    assert.equal(actual.phantomTemplateSlots, 0);
    assert.equal(actual.privateTemplateRendered, false);
    await page.locator(".canvas-stage").screenshot({
      path: resolve(output, `${profile.name}-visual.png`),
      animations: "disabled"
    });

    await page.getByRole("button", { name: "Structure", exact: true }).click();
    const structure = await svg.evaluate(element => ({
      guideSlots: element.querySelectorAll('rect[stroke-dasharray="6 5"]').length,
      galleryUnknownOverlay: element.querySelectorAll('[data-preview-gallery-records="unknown"]').length
    }));
    assert.equal(structure.guideSlots, profile.columns - 1);
    assert.equal(structure.galleryUnknownOverlay, 0);
    await page.locator(".canvas-stage").screenshot({
      path: resolve(output, `${profile.name}-structure.png`),
      animations: "disabled"
    });
    report.push({ profile, visual: actual, structure });
  }
  // This fixture is intentionally fabricated. The assertion checks that two
  // user-provided *local* rows drive distinct source-defined icons, colors
  // and cell positions, without claiming parity with Power Apps runtime.
  await page.getByLabel("Simulated viewport").selectOption("desktop");
  await page.getByRole("button", { name: "Visual", exact: true }).click();
  await page.getByRole("checkbox", { name: "Gallery samples (synthetic)" }).check();
  await page.getByLabel("Load local gallery JSON records").setInputFiles(
    resolve("tests/fixtures/SyntheticGalleryRows.json")
  );
  const localGallery = page.locator('[data-preview-gallery-samples="local-snapshot"]');
  await localGallery.waitFor({ timeout: 20000 });
  const local = await svg.evaluate(element => {
    const cards = [...element.querySelectorAll('[data-sample-card]')];
    return {
      cards: cards.length,
      fills: cards.map(card =>
        card.querySelector('[data-preview-gallery-template-fill="verified"]')?.getAttribute("fill")),
      positions: cards.map(card => {
        const rect = card.querySelector('[data-preview-gallery-template-fill="verified"]');
        return [Number(rect?.getAttribute("x")), Number(rect?.getAttribute("y"))];
      }),
      iconPaths: [...element.querySelectorAll('[data-sample-template-control="GalleryRowIcon"] svg[viewBox="0 0 24 24"] > path')]
        .map(icon => icon.getAttribute("d")),
      labels: element.textContent ?? "",
      localMode: element.querySelector('[data-preview-gallery-samples]')?.getAttribute("data-preview-gallery-samples")
    };
  });
  assert.equal(local.cards, 2);
  assert.deepEqual(local.fills, ["#008000", "#ff0000"]);
  assert.deepEqual(local.positions, [[20, 130], [462, 130]]);
  assert.equal(local.iconPaths.length, 2);
  assert.notEqual(local.iconPaths[0], local.iconPaths[1]);
  assert.equal(local.localMode, "local-snapshot");
  assert.ok(local.labels.includes("Example Operations"));
  assert.ok(local.labels.includes("Example Reporting"));
  await page.locator(".canvas-stage").screenshot({
    path: resolve(output, "desktop-local-gallery.png"),
    animations: "disabled"
  });
  report.push({ scenario: "local-gallery", cards: local.cards,
    fills: local.fills, positions: local.positions, iconCount: local.iconPaths.length });
  // Compare mode: local user reference, exact 1366x768 Canvas dimensions.
  // Construct a generated PNG solely inside Chromium; never use private
  // Power Apps screenshots or upload images to a service.
  const referencePng = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1366; canvas.height = 768;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D unavailable");
    context.fillStyle = "#c6d9ee";
    context.fillRect(0, 0, 1366, 768);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Load local Power Apps reference screenshot").setInputFiles({
    name: "synthetic-reference.png", mimeType: "image/png",
    buffer: Buffer.from(referencePng, "base64")
  });
  const overlay = svg.locator('[data-preview-reference="local-overlay"]');
  await overlay.waitFor({ timeout: 15000 });
  assert.equal(await overlay.locator("image").getAttribute("opacity"), "0.5");
  assert.ok((await page.locator(".preview-note").textContent()).includes("synthetic-reference.png"));
  await page.locator(".canvas-stage").screenshot({
    path: resolve(output, "desktop-reference-overlay.png"),
    animations: "disabled"
  });
  await page.getByRole("button", { name: "Measure difference" }).click();
  const metrics = page.getByRole("region", { name: "Visual difference metrics" });
  await metrics.waitFor({ timeout: 20000 });
  const diffText = await metrics.textContent();
  assert.ok(diffText?.includes("Mean RGB error:"));
  assert.ok(diffText?.includes("Different pixels"));
  assert.equal(await svg.locator('[data-preview-diff-heatmap="active"]').count(), 1);
  const rankedRegions = await metrics.locator(".preview-diff-regions button").allTextContents();
  assert.ok(rankedRegions.some(text => text.includes("sample card")));
  const priority = page.getByLabel("Visual region ranking");
  await priority.selectOption("intensity");
  assert.equal(await priority.inputValue(), "intensity");
  await priority.selectOption("impact");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export JSON report" }).click()
  ]);
  const exportPath = await download.path();
  assert.ok(exportPath);
  const exported = JSON.parse(await readFile(exportPath, "utf8"));
  assert.equal(exported.schemaVersion, 1);
  assert.equal(exported.metrics.threshold, 32);
  assert.ok(exported.regions.length > 0);
  assert.ok(exported.regions.every(r => typeof r.impactScore === "number"));
  assert.equal("heatmap" in exported.metrics, false);
  const thresholdSlider = page.getByLabel("Pixel difference threshold");
  await thresholdSlider.focus();
  await thresholdSlider.press("ArrowRight");
  await page.getByText("Pixel threshold: 40/255").waitFor();
  assert.equal(await metrics.count(), 0); // no stale report after changing threshold
  await page.getByRole("button", { name: "Measure difference" }).click();
  await metrics.waitFor({ timeout: 20000 });
  assert.ok((await metrics.textContent())?.includes("threshold 40/255"));
  report.push({ scenario: "quantitative-diff", hasMetrics: true,
    hasHeatmap: true, gallerySlotRanked: true,
    exportedJSON: true, adjustableThreshold: true });
  await page.locator(".canvas-stage").screenshot({
    path: resolve(output, "desktop-difference-heatmap.png"), animations: "disabled"
  });
  await page.getByLabel("Simulated viewport").selectOption("tablet");
  assert.equal(await metrics.count(), 0);
  assert.equal(await svg.locator('[data-preview-reference="local-overlay"]').count(), 0);
  assert.ok((await page.locator(".preview-note").textContent()).includes("Overlay is withheld"));
  await page.getByLabel("Simulated viewport").selectOption("desktop");
  assert.equal(await svg.locator('[data-preview-reference="local-overlay"]').count(), 1);
  report.push({ scenario: "reference-overlay", viewport: "1366x768",
    localOnly: true, displayedAtMatchingViewport: true, withheldAtMismatchedViewport: true });
  // Fully synthetic multi-screen navigation regression. No real connector.
  await page.getByRole("button", { name: "Open another" }).click();
  await page.locator('input[type="file"]').setInputFiles(
    resolve("tests/fixtures/SyntheticNavigation.pa.yaml")
  );
  await page.getByRole("img", { name: "SampleHome canvas preview" }).waitFor();
  await page.getByRole("button", { name: "Show controls" }).click();
  await page.getByRole("button", { name: "Show details" }).click();
  await page.getByRole("checkbox", { name: "Simulate local state" }).check();
  await page.getByRole("button", { name: /Inspect GoDetails/ }).click();
  await page.getByRole("img", { name: "SampleDetails canvas preview" })
    .waitFor({ timeout: 12000 });
  assert.ok((await page.locator(".preview-navigation-status").textContent())
    ?.includes("SampleDetails"));
  await page.getByRole("button", { name: /Inspect BackHome/ }).click();
  await page.getByRole("img", { name: "SampleHome canvas preview" })
    .waitFor({ timeout: 12000 });
  assert.ok((await page.locator(".preview-navigation-status").textContent())
    ?.includes("SampleHome"));
  report.push({ scenario: "safe-navigation", navigate: true, back: true,
    lifecycle: true, localOnly: true });
  // All elements: no private MSAPP data. Inspect hidden, conditional,
  // nested and gallery-template YAML definitions in their authored geometry.
  await page.getByRole("button", { name: "Open another" }).click();
  await page.locator('input[type="file"]').setInputFiles(
    resolve("tests/fixtures/SyntheticVisibility.pa.yaml")
  );
  const lab = page.getByRole("img", { name: "VisibilityLab canvas preview" });
  await lab.waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Show controls" }).click();
  await page.getByRole("button", { name: "Show details" }).click();
  await page.getByRole("button", { name: "All elements" }).click();
  await lab.locator('[data-inspect-template="definition"]').waitFor();
  assert.equal(await lab.getAttribute("data-inspection-declared-controls"), "7");
  assert.equal(await lab.getAttribute("data-inspection-drawn-controls"), "7");
  const hidden = lab.locator('g[aria-label^="Inspect HiddenCaption"]');
  const conditional = lab.locator('g[aria-label^="Inspect ConditionalPanel"]');
  const external = lab.locator('g[aria-label^="Inspect ExternalGate"]');
  assert.equal(await hidden.getAttribute("data-inspect-effective-visibility"), "hidden");
  assert.equal(await conditional.getAttribute("data-inspect-effective-visibility"), "unknown");
  assert.equal(await external.getAttribute("data-inspect-effective-visibility"), "unknown");
  assert.ok((await lab.getAttribute("viewBox"))?.includes("1630"));
  await page.getByLabel("Load visibility scenario JSON").setInputFiles(
    resolve("tests/fixtures/SyntheticVisibilityScenario.json")
  );
  await page.getByText("Synthetic conditions:", { exact: false }).waitFor();
  assert.equal(await conditional.getAttribute("data-inspect-effective-visibility"), "visible");
  assert.equal(await external.getAttribute("data-inspect-effective-visibility"), "unknown");
  await page.locator(".canvas-stage").screenshot({
    path: resolve(output, "all-source-visibility.png"),
    animations: "disabled"
  });
  await page.getByRole("button", { name: "Visual", exact: true }).click();
  assert.equal(await lab.locator('g[aria-label^="Inspect HiddenCaption"]').count(), 0);
  assert.equal(await lab.locator('g[aria-label^="Inspect TemplateCaption"]').count(), 0);
  report.push({ scenario: "all-source-visibility", controls: 7,
    hidden: true, conditional: true, template: true,
    offscreen: true, scenarioLocalOnly: true });

  // Layout regression: importing a valid synthetic .msapp with an ignored
  // Package JSON notice must not turn that warning into the 1fr grid row.
  // A separate Power Fx status line is always present.
  const samplePackage = new JSZip();
  samplePackage.file("Src/SyntheticResponsive.pa.yaml",
    await readFile(resolve("tests/fixtures/SyntheticResponsive.pa.yaml"), "utf8"));
  samplePackage.file("Properties.json", '{"synthetic":true}');
  const packageBytes = await samplePackage.generateAsync({ type: "nodebuffer" });
  await page.getByRole("button", { name: "Open another" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "SyntheticWarnings.msapp",
    mimeType: "application/octet-stream",
    buffer: packageBytes
  });
  await page.getByRole("img", { name: "VisualRegression canvas preview" })
    .waitFor({ timeout: 20000 });
  const warningStrip = page.locator(".warning-strip");
  await warningStrip.waitFor({ timeout: 12000 });
  assert.ok((await warningStrip.textContent())
    ?.includes("Package JSON outside the selected Canvas source"));
  async function checkWorkbenchRows(minWorkspaceHeight) {
    const bounds = await page.evaluate(() => {
      const rect = selector => {
        const element = document.querySelector(selector);
        if (!element) throw new Error("Missing layout node " + selector);
        const r = element.getBoundingClientRect();
        return { x: r.x, top: r.top, bottom: r.bottom, height: r.height };
      };
      return {
        shellChildren: document.querySelector(".workbench")?.children.length,
        notices: rect(".workbench-notices"),
        warning: rect(".warning-strip"),
        workspace: rect(".workspace"),
        explorer: rect(".app-tree"),
        preview: rect(".preview"),
        inspector: rect(".right-panel"),
        status: rect(".statusbar")
      };
    });
    assert.equal(bounds.shellChildren, 5);
    assert.ok(bounds.notices.height < 115, "Notices must not fill the workspace");
    assert.ok(bounds.warning.height < 85, "Import warning must remain compact");
    assert.ok(bounds.workspace.height > minWorkspaceHeight,
      "The Canvas workspace must retain the flexible grid row");
    assert.ok(bounds.workspace.top >= bounds.notices.bottom - 1);
    assert.ok(bounds.workspace.bottom <= bounds.status.top + 1);
    for (const key of ["explorer", "preview", "inspector"]) {
      assert.ok(bounds[key].height > minWorkspaceHeight - 8,
        key + " was squeezed beneath import notices");
    }
    return bounds;
  }
  const desktopLayout = await checkWorkbenchRows(580);
  await page.locator(".workbench").screenshot({
    path: resolve(output, "msapp-import-warning-workspace-desktop.png"),
    animations: "disabled"
  });
  await page.setViewportSize({ width: 1000, height: 740 });
  const narrowLayout = await checkWorkbenchRows(350);
  await page.locator(".workbench").screenshot({
    path: resolve(output, "msapp-import-warning-workspace-narrow.png"),
    animations: "disabled"
  });
  report.push({ scenario: "msapp-warning-shell-layout", shellChildren: 5,
    desktopWorkspaceHeight: Math.round(desktopLayout.workspace.height),
    narrowWorkspaceHeight: Math.round(narrowLayout.workspace.height),
    warningCompact: true, canvasAndPanelsVisible: true });

  // User-reported usability regression: long diagnostics and controls
  // should never permanently consume the screen. Both can be closed
  // independently; Canvas-only focus offers an always-visible exit.
  assert.equal(await page.locator("#canvas-preview-tools").isVisible(), false);
  assert.equal(await page.locator("#canvas-preview-details").isVisible(), false);
  const beforeFocus = await page.locator(".canvas-stage").evaluate(node =>
    node.getBoundingClientRect().height);
  await page.getByRole("button", { name: "Canvas only" }).click();
  const focused = page.locator(".preview.canvas-only");
  await focused.waitFor();
  assert.equal(await page.locator(".preview-toolbar").isVisible(), false);
  assert.equal(await page.locator(".preview-footer").isVisible(), false);
  const focusHeight = await page.locator(".canvas-stage").evaluate(node =>
    node.getBoundingClientRect().height);
  assert.ok(focusHeight > beforeFocus + 45);
  await page.locator(".preview").screenshot({
    path: resolve(output, "canvas-only-focus.png"), animations: "disabled"
  });
  await page.getByRole("button", { name: "Exit Canvas only view" }).click();
  assert.equal(await focused.count(), 0);
  await page.getByRole("button", { name: "Show controls" }).click();
  await page.getByRole("button", { name: "Show details" }).click();
  assert.equal(await page.locator("#canvas-preview-tools").isVisible(), true);
  assert.equal(await page.locator("#canvas-preview-details").isVisible(), true);
  await page.getByRole("button", { name: "Hide details" }).click();
  assert.equal(await page.locator("#canvas-preview-details").isVisible(), false);
  assert.equal(await page.locator("#canvas-preview-tools").isVisible(), true);
  await page.getByRole("button", { name: "Hide controls" }).click();
  assert.equal(await page.locator("#canvas-preview-tools").isVisible(), false);
  report.push({ scenario: "compact-canvas-panels",
    defaultCollapsed: true, independentToggles: true,
    focusRestoresCanvas: true, focusExitAvailable: true });

  await writeFile(resolve(output, "geometry.json"), JSON.stringify(report, null, 2) + "\n");
  console.log("Chromium visual smoke: 3 profiles, 10 screenshots including Gallery, reference, quantitative heatmap and all-controls visibility; source geometry verified.");
} finally {
  await browser?.close();
  await server.close();
}
