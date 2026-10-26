import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CanvasVisualControl } from "../../components/CanvasVisualControl";
import type { CanvasControl } from "../../types/canvas";
import { previewColor, previewColorWithSymbols, previewIsOpaqueColor } from "./previewAppearance";

function container(fill: string): CanvasControl {
  return {
    id: "SyntheticOpaqueContainer",
    name: "SyntheticOpaqueContainer",
    controlType: "GroupContainer@1.3.0",
    properties: { Fill: fill, DropShadow: "=DropShadow.Regular" },
    children: [],
    sourceFile: "Src/SyntheticOpaqueContainer.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticOpaqueContainer",
    sourceFormat: "pa-yaml-v3",
    zIndex: 1
  };
}

describe("Canvas decimal RGBA opacity and container shadow", () => {
  it("recognizes verified fractional RGB channels with fully opaque alpha", () => {
    for (const formula of [
      "=RGBA(10.5, 20, 30, 1)",
      "=RGBA(.5, 20, 30, 100%)",
      "=RGBA(255, 0.25, 0, 1)"
    ]) {
      const color = previewColor(formula);
      expect(color).not.toBeNull();
      expect(previewIsOpaqueColor(color)).toBe(true);
    }
  });

  it("never treats invalid, malformed, transparent or unknown RGBA as opaque", () => {
    for (const color of [
      "rgba(10.5,20,30,0.5)",
      "rgba(256,20,30,1)",
      "rgba(-1,20,30,1)",
      "rgba(10,20,30,1e0)",
      "rgba(10,20,30,2)",
      "rgba(10..5,20,30,1)",
      null
    ]) {
      expect(previewIsOpaqueColor(color)).toBe(false);
    }
    expect(previewColorWithSymbols("=RGBA(varSqlColor,20,30,1)")).toBeNull();
  });

  it.each([
    [390, true],
    [768, false],
    [1366, false]
  ])("keeps a responsive shadow only for verified opaque Fill at %i px",
    (appWidth, opaque) => {
      const fill = "=If(App.Width < 720, RGBA(10.5,20,30,1), RGBA(10.5,20,30,0.5))";
      const symbols = { "App.Width": appWidth };
      expect(previewIsOpaqueColor(previewColorWithSymbols(fill, symbols))).toBe(opaque);
      const markup = renderToStaticMarkup(
        <CanvasVisualControl control={container(fill)}
          simulationSymbols={symbols} x={0} y={0}
          width={180} height={80} clipId="synthetic-clip" />
      );
      expect(markup.includes("drop-shadow(")).toBe(opaque);
      expect(markup.includes('data-preview-shadow-state="not-rendered"')).toBe(!opaque);
    }
  );

  it("never paints a shadow from runtime-dependent Fill", () => {
    const markup = renderToStaticMarkup(
      <CanvasVisualControl control={container("=If(varSqlReady, RGBA(10.5,20,30,1), Color.White)")}
        x={0} y={0} width={180} height={80} clipId="synthetic-clip" />
    );
    expect(markup).not.toContain("drop-shadow(");
    expect(markup).toContain('data-preview-shadow-state="not-rendered"');
  });
});
