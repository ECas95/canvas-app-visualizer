/**
 * Browser-level Canvas renderer regression: synthetic source only.
 * Captures synthetic Chromium screenshots and verifies SVG geometry at
 * desktop/tablet/phone profiles. No Power Apps service, SQL or login.
 *
 * The images document this renderer, not pixel parity with Power Apps Studio.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
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
  await page.getByLabel("Simulated viewport").selectOption("tablet");
  assert.equal(await svg.locator('[data-preview-reference="local-overlay"]').count(), 0);
  assert.ok((await page.locator(".preview-note").textContent()).includes("Overlay is withheld"));
  await page.getByLabel("Simulated viewport").selectOption("desktop");
  assert.equal(await svg.locator('[data-preview-reference="local-overlay"]').count(), 1);
  report.push({ scenario: "reference-overlay", viewport: "1366x768",
    localOnly: true, displayedAtMatchingViewport: true, withheldAtMismatchedViewport: true });
  await writeFile(resolve(output, "geometry.json"), JSON.stringify(report, null, 2) + "\n");
  console.log("Chromium visual smoke: 3 profiles, 8 screenshots including local Gallery and reference overlay; source geometry verified.");
} finally {
  await browser?.close();
  await server.close();
}
