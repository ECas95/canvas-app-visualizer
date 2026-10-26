import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildCanvasModel } from "../core/model/normalize";
import { previewCornerRadiusUnverified } from "../core/layout/previewCorners";
import { CanvasVisualControl } from "./CanvasVisualControl";

/** Synthetic .pa.yaml only: no SQL rows, identity or permission snapshots. */
function renderRadius(
  properties: Record<string, string>,
  viewport: number,
  controlType = "Classic/Button@2.2.0"
): string {
  const yaml = [
    "Screens:",
    "  Synthetic:",
    "    Children:",
    "      - SyntheticButton:",
    "          Control: " + controlType,
    "          Properties:",
    '            Text: ="Synthetic"',
    ...Object.entries(properties).map(([name, formula]) => "            " + name + ": " + formula)
  ].join("\n");
  const model = buildCanvasModel([{
    path: "Src/SyntheticRadius.pa.yaml", name: "SyntheticRadius.pa.yaml",
    content: yaml, origin: "yaml", format: "pa-yaml-v3"
  }], "yaml");
  expect(model.screens).toHaveLength(1);
  const control = model.screens[0].children[0];
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={10} y={20} width={160} height={60}
    clipId="synthetic-radius-clip"
    simulationSymbols={{ "App.Width": viewport }} /></svg>);
}

describe("Canvas per-corner radius certainty", () => {
  it.each([390, 768, 1366])(
    "marks runtime-dependent corners unknown at %i px without inventing permissions",
    viewport => {
      const html = renderRadius({
        RadiusTopLeft: "=If(varSqlAuthorized, 24, 0)",
        RadiusTopRight: "=0"
      }, viewport);
      expect(html).toContain('data-preview-radius-state="unknown"');
      expect(html).toContain("outline is approximate and clipping uses only known corners");
      expect(html).toContain('d="M 14 20'); // 4px illustrative outline
      expect(html).toContain('d="M 11 21 H'); // square clipping for unknown top-left
      expect(html).not.toContain("varSqlAuthorized");
    }
  );

  it.each([
    { viewport: 390, radius: 24 },
    { viewport: 768, radius: 6 },
    { viewport: 1366, radius: 6 }
  ])("resolves responsive corners from known App.Width at $viewport px", ({ viewport, radius }) => {
    const html = renderRadius({
      RadiusTopLeft: "=If(App.Width < 720, 24, 6)",
      RadiusTopRight: "=0",
      RadiusBottomRight: "=8",
      RadiusBottomLeft: "=0"
    }, viewport);
    expect(html).toContain('d="M ' + (10 + radius) + ' 20');
    expect(html).not.toContain('data-preview-radius-state="unknown"');
  });

  it("does not label omitted or verified zero corners as runtime unknown", () => {
    expect(renderRadius({}, 390)).not.toContain('data-preview-radius-state="unknown"');
    expect(renderRadius({ RadiusTopLeft: "=0" }, 390))
      .not.toContain('data-preview-radius-state="unknown"');
  });

  it("marks invalid negative and unsupported expressions", () => {
    expect(previewCornerRadiusUnverified({ RadiusTopLeft: "=-5" })).toBe(true);
    expect(previewCornerRadiusUnverified({ RadiusTopRight: "=Unsupported(2)" })).toBe(true);
    expect(renderRadius({ RadiusTopLeft: "=-5" }, 390))
      .toContain('data-preview-radius-state="unknown"');
  });

  it("distinguishes known local symbols from unavailable permission state", () => {
    const properties = { RadiusTopLeft: "=If(varAllowed, 12, 0)" };
    expect(previewCornerRadiusUnverified(properties)).toBe(true);
    expect(previewCornerRadiusUnverified(properties, { varAllowed: false })).toBe(false);
    expect(previewCornerRadiusUnverified(properties, { varAllowed: true })).toBe(false);
  });

  it("supports independent corners on a modern Button", () => {
    const html = renderRadius({
      RadiusTopLeft: "=16", RadiusTopRight: "=0",
      RadiusBottomRight: "=8", RadiusBottomLeft: "=0"
    }, 768, "ModernButton@1.0.0");
    expect(html).toContain('d="M 26 20');
    expect(html).not.toContain('data-preview-radius-state="unknown"');
  });
});
