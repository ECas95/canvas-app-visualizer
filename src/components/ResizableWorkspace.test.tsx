import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ResizableWorkspace } from "./ResizableWorkspace";

describe("ResizableWorkspace", () => {
  it("renders both accessible keyboard-focusable separators in panel order", () => {
    const html = renderToStaticMarkup(
      <ResizableWorkspace>
        <aside id="explorer">Explorer</aside>
        <main id="preview">Preview</main>
        <aside id="details">Details</aside>
      </ResizableWorkspace>
    );
    expect(html.match(/role="separator"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Resize App explorer"');
    expect(html).toContain('aria-label="Resize Properties and Diagnostics"');
    expect(html).toContain('aria-valuenow="266"');
    expect(html).toContain('aria-valuenow="380"');
    expect(html.match(/tabindex="0"/g)).toHaveLength(2);
    expect(html.indexOf('id="explorer"')).toBeLessThan(html.indexOf('id="preview"'));
    expect(html.indexOf('id="preview"')).toBeLessThan(html.indexOf('id="details"'));
  });
});
