import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildCanvasModel } from "../core/model/normalize";
import { CanvasVisualControl } from "./CanvasVisualControl";

/**
 * Synthetic .pa.yaml only. Runtime SQL data, identity and permissions are
 * deliberately unavailable; unverified paint must remain identifiable.
 * Microsoft PowerApps-Tooling pa-yaml/v3.0: properties are Power Fx formulas.
 */
function render(viewport: number, fill: string | undefined, border: {
  BorderColor?: string;
  BorderThickness?: string;
  BorderStyle?: string;
} = {}): string {
  const yaml = `Screens:
  Synthetic:
    Children:
      - SyntheticButton:
          Control: Classic/Button@2.2.0
          Properties:
            Text: ="Synthetic"
            X: =10
            Y: =20
            Width: =220
            Height: =48
${fill === undefined ? "" : `            Fill: ${fill}\n`}${Object.entries(border).map(([key, value]) => `            ${key}: ${value}\n`).join("")}`;
  const model = buildCanvasModel([{
    path: "Src/SyntheticPaint.pa.yaml", name: "SyntheticPaint.pa.yaml",
    content: yaml, origin: "yaml", format: "pa-yaml-v3"
  }], "yaml");
  expect(model.screens).toHaveLength(1);
  const control = model.screens[0].children[0];
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={10} y={20} width={220} height={48}
    clipId="synthetic-paint-clip"
    simulationSymbols={{ "App.Width": viewport }} /></svg>);
}

describe("Canvas source-only paint certainty", () => {
  it.each([390, 768, 1366])(
    "marks runtime-dependent Fill and border as unknown at %i px",
    viewport => {
      const html = render(viewport,
        "=If(varSqlAuthorized, Color.Green, Color.Red)", {
          BorderColor: "=varRuntimeBorderColor",
          BorderThickness: "=If(varSqlAuthorized, 4, 0)",
          BorderStyle: "=If(varSqlAuthorized, BorderStyle.Solid, BorderStyle.None)"
        });
      expect(html).toContain('data-preview-fill-state="unknown"');
      expect(html).toContain('data-preview-border-state="unknown"');
      expect(html).toContain("displayed background is a preview fallback");
      expect(html).toContain("displayed border is a preview fallback");
      expect(html).not.toContain("varSqlAuthorized");
    }
  );

  it.each([
    { viewport: 390, color: "#ff0000", border: 0 },
    { viewport: 768, color: "#008000", border: 2 },
    { viewport: 1366, color: "#008000", border: 2 }
  ])("verifies known responsive Fill and border at $viewport px", ({ viewport, color, border }) => {
    const html = render(viewport,
      "=If(App.Width < 720, Color.Red, Color.Green)", {
        BorderColor: "=Color.Black",
        BorderThickness: "=If(App.Width < 720, 0, 2)",
        BorderStyle: "=BorderStyle.Solid"
      });
    expect(html).toContain(`fill="${color}"`);
    expect(html).toContain(`stroke-width="${border}"`);
    expect(html).not.toContain('data-preview-fill-state="unknown"');
    expect(html).not.toContain('data-preview-border-state="unknown"');
  });

  it("treats omitted paint properties as defaults, not unknown runtime values", () => {
    const html = render(390, undefined);
    expect(html).not.toContain('data-preview-fill-state="unknown"');
    expect(html).not.toContain('data-preview-border-state="unknown"');
  });

  it("does not infer a verified border from invalid negative thickness", () => {
    const html = render(390, "=Color.Transparent", {
      BorderColor: "=Color.Red", BorderThickness: "=-2",
      BorderStyle: "=BorderStyle.Solid"
    });
    expect(html).not.toContain('data-preview-fill-state="unknown"');
    expect(html).toContain('data-preview-border-state="unknown"');
  });
});
