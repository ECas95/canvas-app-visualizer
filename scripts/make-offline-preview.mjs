/**
 * Generate a single-file, local-first preview of the built Canvas App Visualizer.
 *
 * This is a PR review artifact, NOT a GitHub Pages deployment. Embedding the
 * locally built JS/CSS allows reviewers to open the preview using file://
 * without serving a site or sending .msapp/.pa.yaml files to a server.
 * The only assets accepted are files produced in dist/assets by Vite.
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

function localAssetPath(distRoot, reference) {
  if (!/^\.\/assets\/[A-Za-z0-9_.-]+$/.test(reference)) {
    throw new Error(`Unexpected build asset reference: ${reference}`);
  }
  const path = resolve(distRoot, reference);
  if (!path.startsWith(distRoot + sep)) {
    throw new Error("Build asset resolved outside dist");
  }
  return path;
}

export async function createOfflinePreview(
  indexPath = "dist/index.html",
  outputPath = "artifacts/preview/canvas-app-visualizer.html"
) {
  const root = dirname(resolve(indexPath));
  let html = await readFile(indexPath, "utf8");
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)];
  const styles = [...html.matchAll(/<link\b[^>]*>/g)]
    .filter(match => /\brel="stylesheet"/.test(match[0]));

  // Fail rather than publishing an incomplete/incorrect preview if Vite's
  // HTML format changes or the app grows extra code-split scripts.
  if (scripts.length !== 1 || styles.length !== 1 ||
      !/\btype="module"/.test(scripts[0][0])) {
    throw new Error("Expected exactly one built module script and stylesheet");
  }
  const js = await readFile(localAssetPath(root, scripts[0][1]), "utf8");
  const cssRef = styles[0][0].match(/\bhref="([^"]+)"/)?.[1];
  if (!cssRef) throw new Error("Missing built CSS asset reference");
  const css = await readFile(localAssetPath(root, cssRef), "utf8");

  html = html.replace(styles[0][0],
    `<style data-offline-preview="css">\n${css.replace(/<\/style/gi, "<\\/style")}\n</style>`);
  html = html.replace(scripts[0][0],
    `<script type="module" data-offline-preview="js">\n${js.replace(/<\/script/gi, "<\\/script")}\n</script>`);
  // The compiled JavaScript can itself contain strings resembling asset
  // attributes. Validate original HTML tags, not string literals embedded
  // inside the now-inlined module.
  html = html.replace("</head>",
    '  <meta name="canvas-preview-channel" content="unmerged-pr-offline" />\n  </head>');

  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  await writeFile(outputPath, html, "utf8");
  console.log(`Offline review preview: ${outputPath} (${Buffer.byteLength(html)} bytes)`);
  return outputPath;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await createOfflinePreview();
}
