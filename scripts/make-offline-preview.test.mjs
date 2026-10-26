import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOfflinePreview } from "./make-offline-preview.mjs";

async function withFixture(run, indexOverride) {
  const dir = await mkdtemp(join(tmpdir(), "canvas-offline-preview-"));
  const dist = join(dir, "dist");
  const assets = join(dist, "assets");
  const output = join(dir, "out", "preview.html");
  try {
    await mkdir(assets, { recursive: true });
    const index = indexOverride ?? `<!doctype html><html><head>
<link rel="stylesheet" crossorigin href="./assets/index-example.css">
</head><body><div id="root"></div>
<script type="module" crossorigin src="./assets/index-example.js"></script>
</body></html>`;
    await writeFile(join(dist, "index.html"), index);
    await writeFile(join(assets, "index-example.css"), `body { color: red; } /* </style> */`);
    await writeFile(join(assets, "index-example.js"),
      `document.getElementById("root").textContent = "Canvas App Visualizer"; /* </script> $& */`);
    await run({ dist, output });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("bundles built assets into one offline HTML preview without external asset URLs", async () => {
  await withFixture(async ({ dist, output }) => {
    await createOfflinePreview(join(dist, "index.html"), output);
    const html = await readFile(output, "utf8");
    assert.match(html, /data-offline-preview="css"/);
    assert.match(html, /data-offline-preview="js"/);
    assert.match(html, /Canvas App Visualizer/);
    assert.match(html, /content="unmerged-pr-offline"/);
    assert.doesNotMatch(html, /src="\.\/assets\//);
    assert.doesNotMatch(html, /<script[^>]*\bsrc=/);
    assert.doesNotMatch(html, /href="\.\/assets\//);
    assert.match(html, /<\\\/script>/);
    assert.match(html, /<\\\/style>/);
  });
});

test("rejects HTML with an unexpected script origin instead of silently publishing", async () => {
  await withFixture(async ({ dist, output }) => {
    await assert.rejects(
      createOfflinePreview(join(dist, "index.html"), output),
      /Unexpected build asset reference/
    );
  }, `<!doctype html><html><head>
<link rel="stylesheet" href="./assets/index-example.css"></head><body>
<script type="module" src="https://example.invalid/app.js"></script></body></html>`);
});
