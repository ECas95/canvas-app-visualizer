import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildCanvasModel } from "../core/model/normalize";
import { previewColorWithSymbols } from "../core/layout/previewAppearance";
import { CanvasPreview } from "./CanvasPreview";

/**
 * Generic, synthetic PowerApps-Tooling pa-yaml/v3.0 screen.
 * No real SQL records, identities, permission grants or private screenshots.
 *
 * A Screen.Fill formula can depend on runtime state; a white preview
 * fallback is not proof that Power Apps would paint a white background.
 * https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-screen
 * https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-colors
 * https://github.com/microsoft/PowerApps-Tooling/tree/master/schemas/pa-yaml/v3.0
 */
function renderScreen(fill?: string): string {
  const properties = fill === undefined ? "" :
    `    Properties:\n      Fill: ${fill}\n`;
  const yaml = `Screens:
  Synthetic:
${properties}    Children:
      - StaticLabel:
          Control: Classic/Label@2.5.1
          Properties:
            X: =12
            Y: =16
            Width: =200
            Height: =40
            Text: ="Synthetic static label"
`;
  const model = buildCanvasModel([{
    path: "Src/SyntheticScreenFill.pa.yaml",
    name: "SyntheticScreenFill.pa.yaml",
    content: yaml, origin: "yaml", format: "pa-yaml-v3"
  }], "yaml");
  expect(model.screens).toHaveLength(1);
  if (fill !== undefined) expect(model.screens[0].properties.Fill).toBe(fill);
  return renderToStaticMarkup(<CanvasPreview
    screen={model.screens[0]} onSelect={() => {}} />);
}

describe("Canvas screen Fill source-only uncertainty", () => {
  it("marks runtime-dependent screen colors unknown instead of verified white", () => {
    const html = renderScreen("=If(varSqlAuthorized, Color.Green, Color.Red)");
    expect(html).toContain('data-preview-screen-fill-state="unknown"');
    expect(html).toContain('fill="#ffffff"');
    expect(html).toContain("Screen Fill unknown — background color is a preview fallback");
    expect(html).toContain("not a verified background");
    expect(html).not.toContain("varSqlAuthorized");
    expect(html).toContain("Synthetic static label");
  });

  it("does not infer a screen color from a SQL field or permission state", () => {
    const html = renderScreen("=If(First(ExternalRecords).CanRead, Color.Green, Color.Red)");
    expect(html).toContain('data-preview-screen-fill-state="unknown"');
    expect(html).not.toContain("ExternalRecords");
  });

  it("keeps an omitted screen Fill distinct from an unresolved formula", () => {
    const html = renderScreen();
    expect(html).not.toContain("data-preview-screen-fill-state");
    expect(html).not.toContain("Screen Fill unknown");
    expect(html).toContain('fill="#ffffff"');
  });

  it("renders a verified enum color without a warning", () => {
    const html = renderScreen("=Color.Red");
    expect(html).toContain('fill="#ff0000"');
    expect(html).not.toContain("data-preview-screen-fill-state");
    expect(html).not.toContain("Screen Fill unknown");
  });

  it("preserves known RGBA transparency", () => {
    const html = renderScreen("=RGBA(12, 34, 56, 0.5)");
    expect(html).toContain('fill="rgba(12,34,56,0.5)"');
    expect(html).not.toContain("data-preview-screen-fill-state");
  });

  it("resolves a desktop-responsive Fill from App.Width without runtime state", () => {
    const html = renderScreen("=If(App.Width > 720, Color.Blue, Color.Red)");
    expect(html).toContain('fill="#0000ff"');
    expect(html).not.toContain("data-preview-screen-fill-state");
  });

  it.each([
    [390, "#ff0000"],
    [768, "#0000ff"],
    [1366, "#0000ff"]
  ])("keeps responsive Power Fx color evaluation source-based at %i px", (width, color) => {
    expect(previewColorWithSymbols(
      "=If(App.Width < 720, Color.Red, Color.Blue)",
      { "App.Width": width }
    )).toBe(color);
  });

  it("flags invalid or unsupported color formulas without injecting their content", () => {
    const html = renderScreen('=ColorValue("javascript:alert(1)")');
    expect(html).toContain('data-preview-screen-fill-state="unknown"');
    expect(html).toContain('fill="#ffffff"');
    expect(html).not.toContain("javascript:alert");
  });

  it("does not mistake a quoted Color enum name for a color value", () => {
    const html = renderScreen('="Color.Red"');
    expect(html).toContain('data-preview-screen-fill-state="unknown"');
    expect(html).not.toContain('fill="#ff0000"');
  });

  it("treats explicit transparent Fill as known rather than unknown", () => {
    const html = renderScreen("=Color.Transparent");
    expect(html).toContain('fill="transparent"');
    expect(html).not.toContain("data-preview-screen-fill-state");
  });
});
