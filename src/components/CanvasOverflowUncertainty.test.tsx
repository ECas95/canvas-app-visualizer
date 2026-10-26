import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildCanvasModel } from "../core/model/normalize";
import { previewOverflowMode } from "../core/layout/previewOverflow";
import { CanvasPreview } from "./CanvasPreview";

/**
 * Synthetic PowerApps-Tooling pa-yaml/v3.0 fixture: no SQL rows, identity,
 * permissions or runtime state. Unresolved overflow must not silently appear
 * to be a verified Hide state.
 */
function renderOverflow(options: {
  x?: string;
  y?: string;
  visible?: string;
  variant?: "AutoLayout" | "ManualLayout";
} = {}): string {
  const properties = [
    "            X: =10",
    "            Y: =20",
    "            Width: =220",
    "            Height: =90",
    "            LayoutDirection: =LayoutDirection.Vertical",
    ...(options.x === undefined ? [] : [`            LayoutOverflowX: ${options.x}`]),
    ...(options.y === undefined ? [] : [`            LayoutOverflowY: ${options.y}`]),
    ...(options.visible === undefined ? [] : [`            Visible: ${options.visible}`])
  ].join("\n");
  const yaml = `Screens:
  Synthetic:
    Children:
      - ScrollHost:
          Control: GroupContainer@1.3.0
          Variant: ${options.variant ?? "AutoLayout"}
          Properties:
${properties}
          Children:
            - SyntheticContent:
                Control: Classic/Label@2.5.1
                Properties:
                  Width: =200
                  Height: =180
                  Text: ="Synthetic, not a database row"
`;
  const model = buildCanvasModel([{
    path: "Src/SyntheticOverflow.pa.yaml",
    name: "SyntheticOverflow.pa.yaml",
    content: yaml, origin: "yaml", format: "pa-yaml-v3"
  }], "yaml");
  expect(model.screens).toHaveLength(1);
  expect(model.screens[0].children[0].variant).toBe(options.variant ?? "AutoLayout");
  return renderToStaticMarkup(<CanvasPreview
    screen={model.screens[0]} onSelect={() => {}} />);
}

describe("Canvas auto-layout overflow uncertainty", () => {
  it("discloses both unresolved axes without simulating a scrollbar", () => {
    const html = renderOverflow({
      x: "=If(varSqlAuthorized, LayoutOverflow.Scroll, LayoutOverflow.Hide)",
      y: "=If(varSqlAuthorized, LayoutOverflow.Hide, LayoutOverflow.Scroll)"
    });
    expect(html).toContain('data-preview-overflow-x-state="unknown"');
    expect(html).toContain('data-preview-overflow-y-state="unknown"');
    expect(html).toContain("1 containers with unknown overflow");
    expect(html).toContain("horizontal overflow unknown; scrolling not verified");
    expect(html).toContain("vertical overflow unknown; scrolling not verified");
    expect(html).not.toContain('data-preview-scrollbar="horizontal"');
    expect(html).not.toContain('data-preview-scrollbar="vertical"');
    expect(html).not.toContain("varSqlAuthorized");
  });

  it("isolates an unresolved vertical axis from a known hidden horizontal axis", () => {
    const html = renderOverflow({
      x: "=LayoutOverflow.Hide",
      y: "=If(varRuntimeFlag, LayoutOverflow.Scroll, LayoutOverflow.Hide)"
    });
    expect(html).toContain('data-preview-overflow-y-state="unknown"');
    expect(html).not.toContain('data-preview-overflow-x-state="unknown"');
    expect(html).toContain("1 containers with unknown overflow");
    expect(html).not.toContain('data-preview-scrollbar="vertical"');
  });

  it("does not mark known Hide or omitted properties as unknown", () => {
    for (const options of [{ x: "=LayoutOverflow.Hide", y: "=LayoutOverflow.Hide" }, {}]) {
      const html = renderOverflow(options);
      expect(html).not.toContain('data-preview-overflow-x-state="unknown"');
      expect(html).not.toContain('data-preview-overflow-y-state="unknown"');
      expect(html).not.toContain("containers with unknown overflow");
    }
  });

  it("preserves a verified local Scroll scrollbar without uncertainty", () => {
    const html = renderOverflow({ y: "=LayoutOverflow.Scroll" });
    expect(html).toContain('data-preview-scrollbar="vertical"');
    expect(html).not.toContain("containers with unknown overflow");
    expect(html).not.toContain('data-preview-overflow-y-state="unknown"');
  });

  it("resolves a viewport-only If at the default desktop viewport", () => {
    const html = renderOverflow({
      y: "=If(App.Width >= 1000, LayoutOverflow.Scroll, LayoutOverflow.Hide)"
    });
    expect(html).toContain('data-preview-scrollbar="vertical"');
    expect(html).not.toContain('data-preview-overflow-y-state="unknown"');
  });

  it.each([
    { width: 390, expected: "hide" },
    { width: 768, expected: "scroll" },
    { width: 1366, expected: "scroll" }
  ])("does not invent overflow for a verified viewport of $width", ({ width, expected }) => {
    expect(previewOverflowMode(
      "=If(App.Width < 720, LayoutOverflow.Hide, LayoutOverflow.Scroll)",
      { "App.Width": width }
    )).toBe(expected);
  });

  it("does not expose overflow diagnostics behind unknown visibility", () => {
    const html = renderOverflow({
      visible: "=varSqlAuthorized",
      y: "=If(varSqlAuthorized, LayoutOverflow.Scroll, LayoutOverflow.Hide)"
    });
    expect(html).toContain("Visible unknown");
    expect(html).not.toContain('data-preview-overflow-y-state="unknown"');
    expect(html).not.toContain("containers with unknown overflow");
    expect(html).not.toContain("Synthetic, not a database row");
  });

  it("does not interpret editor-only manual containers as auto-layout scroll hosts", () => {
    const html = renderOverflow({
      variant: "ManualLayout",
      y: "=If(varFlag, LayoutOverflow.Scroll, LayoutOverflow.Hide)"
    });
    expect(html).not.toContain('data-preview-overflow-y-state="unknown"');
    expect(html).not.toContain("containers with unknown overflow");
  });
});
