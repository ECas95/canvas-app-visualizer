import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildCanvasModel } from "../core/model/normalize";
import { CanvasPreview } from "./CanvasPreview";

/**
 * Synthetic source-only fixtures. Neither SQL records nor permissions are
 * available in a .pa.yaml; their placeholders must stay clipped to their
 * own bounds instead of covering unrelated siblings.
 *
 * Source order follows Microsoft PowerApps-Tooling pa-yaml/v3.0 schema.
 */
function renderSyntheticPreview(controlWidth: number): string {
  const yaml = `Screens:
  Synthetic:
    Children:
      - GalleryStatus:
          Control: GroupContainer@1.3.0
          Properties:
            X: =12
            Y: =18
            Width: =${controlWidth}
            Height: =72
            Visible: =IsEmpty(DataGallery.AllItems)
      - Guarded:
          Control: GroupContainer@1.3.0
          Properties:
            X: =12
            Y: =120
            Width: =${controlWidth}
            Height: =42
            Visible: =varPermission
          Children:
            - GuardedText:
                Control: Classic/Label@2.5.1
                Properties:
                  Text: ="Synthetic restricted child"
      - DataGallery:
          Control: Classic/VerticalGallery@2.3.0
          Properties:
            X: =12
            Y: =270
            Width: =320
            Height: =100
            Items: =SqlSource
          Children:
            - TemplateText:
                Control: Classic/Label@2.5.1
                Properties:
                  Text: ="Synthetic template, not a row"
      - Independent:
          Control: Classic/Label@2.5.1
          Properties:
            X: =180
            Y: =190
            Width: =140
            Height: =30
            Text: ="Known independent"
`;
  const model = buildCanvasModel([{
    path: "Src/SyntheticPlaceholderClip.pa.yaml",
    name: "SyntheticPlaceholderClip.pa.yaml",
    content: yaml, origin: "yaml", format: "pa-yaml-v3"
  }], "yaml");
  expect(model.screens).toHaveLength(1);
  return renderToStaticMarkup(<CanvasPreview
    screen={model.screens[0]} onSelect={() => {}} />);
}

function clippedTextId(html: string, text: string): string {
  const element = html.match(/<text[^>]*>[^<]*<\/text>/g)?.find(tag => tag.includes(text));
  expect(element, `Expected a rendered placeholder for ${text}`).toBeDefined();
  const id = element?.match(/clip-path="url\(#([^"]+)\)"/)?.[1];
  expect(id, `Placeholder ${text} must reference its own SVG clip path`).toBeDefined();
  return id!;
}

describe("Canvas source-only placeholder clipping", () => {
  it.each([36, 120, 320])(
    "clips unknown gallery and permission placeholders to their own %i px bounds",
    width => {
      const html = renderSyntheticPreview(width);
      const galleryClip = clippedTextId(html, "Gallery state unknown");
      const guardedClip = clippedTextId(html, "Visible unknown");
      expect(galleryClip).not.toBe(guardedClip);

      // The two clip paths are tied to each control's actual source geometry.
      expect(html).toContain(`<clipPath id="${galleryClip}"><path d="M 12 18 H ${12 + width}`);
      expect(html).toContain(`<clipPath id="${guardedClip}"><path d="M 12 120 H ${12 + width}`);

      // A gallery template is not a loaded SQL row, and an unresolved Visible
      // formula does not authorize rendering potentially restricted children.
      expect(html).not.toContain("Synthetic template, not a row");
      expect(html).not.toContain("Synthetic restricted child");
      expect(html).toContain("Known independent");
      expect(html).toContain("not an empty result");
    }
  );

  it("retains separate clipping when unknown controls overlap another sibling", () => {
    const html = renderSyntheticPreview(320);
    const galleryClip = clippedTextId(html, "Gallery state unknown");
    const guardedClip = clippedTextId(html, "Visible unknown");
    expect(html).toContain(`clip-path="url(#${galleryClip})"`);
    expect(html).toContain(`clip-path="url(#${guardedClip})"`);
    expect(html).toContain("Inspect Independent");
  });
});
