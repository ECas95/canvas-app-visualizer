/**
 * Browser smoke test for the self-contained PR preview opened using file://.
 * No .msapp upload, connector calls, SQL, identities or runtime permissions.
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const url = pathToFileURL(resolve("artifacts/preview/canvas-app-visualizer.html")).href;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push("console: " + message.text());
  });
  page.on("requestfailed", request =>
    errors.push("request: " + request.url() + " — " + (request.failure()?.errorText ?? "failed"))
  );
  await page.goto(url, { waitUntil: "load" });
  try {
    await page.locator('input[type="file"]').first().waitFor({ timeout: 8000 });
  } catch (error) {
    console.error("Offline preview failed to mount. Browser errors:", errors);
    console.error("Offline document:", (await page.content()).slice(0, 600));
    throw error;
  }
  const title = await page.title();
  assert.equal(title, "Canvas App Visualizer");
  assert.deepEqual(errors, [], `Offline preview page errors: ${errors.join("; ")}`);
  console.log("Offline review HTML opened successfully in Chromium using file://");
} finally {
  await browser.close();
}
