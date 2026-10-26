import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildCanvasModel } from "../core/model/normalize";
import type { CanvasControl } from "../types/canvas";
import { CanvasVisualControl } from "./CanvasVisualControl";

/** Synthetic controls only: no imported app, SQL records, identity or permissions. */
function container(properties: Record<string, unknown>, controlType = "GroupContainer@1.3.0"): CanvasControl {
  return {
    id: "synthetic-shadow", name: "SyntheticShadow", controlType,
    properties, children: [], sourceFile: "Src/Synthetic.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticShadow",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
}

function render(
  properties: Record<string, unknown>,
  viewport = 768,
  controlType = "GroupContainer@1.3.0"
): string {
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={container(properties, controlType)} x={10} y={20}
    width={160} height={80} clipId="synthetic-shadow-clip"
    simulationSymbols={{ "App.Width": viewport }} /></svg>);
}

describe("Canvas container DropShadow certainty", () => {
  it.each([390, 768, 1366])(
    "discloses runtime-dependent DropShadow at %i px without inventing authorization",
    viewport => {
      const html = render({
        Fill: "=Color.White",
        DropShadow: "=If(varSqlAuthorized, DropShadow.Bold, DropShadow.None)"
      }, viewport);
      expect(html).toContain('data-preview-shadow-state="unknown"');
      expect(html).toContain("absence of a shadow is not verified");
      expect(html).not.toContain("drop-shadow(");
      expect(html).not.toContain("varSqlAuthorized");
    }
  );

  it.each([
    { viewport: 390, hasShadow: true },
    { viewport: 768, hasShadow: false },
    { viewport: 1366, hasShadow: false }
  ])("resolves a viewport-only DropShadow branch at $viewport px", ({ viewport, hasShadow }) => {
    const html = render({
      Fill: "=Color.White",
      DropShadow: "=If(App.Width < 720, DropShadow.Bold, DropShadow.None)"
    }, viewport);
    expect(html.includes("drop-shadow(")).toBe(hasShadow);
    expect(html).not.toContain('data-preview-shadow-state="unknown"');
    expect(html).not.toContain('data-preview-shadow-state="not-rendered"');
  });

  it("does not mark omitted or explicitly disabled shadows as uncertain", () => {
    expect(render({ Fill: "=Color.White" })).not.toContain("data-preview-shadow-state=");
    const none = render({ Fill: "=Color.White", DropShadow: "=DropShadow.None" });
    expect(none).not.toContain("data-preview-shadow-state=");
    expect(none).not.toContain("drop-shadow(");
  });

  it("discloses known shadows omitted for transparent or unknown fills", () => {
    for (const fill of ["=Color.Transparent", "=If(varThemeReady, Color.White, Color.Black)"]) {
      const html = render({ Fill: fill, DropShadow: "=DropShadow.Regular" });
      expect(html).toContain('data-preview-shadow-state="not-rendered"');
      expect(html).toContain("shadow is omitted in this preview");
      expect(html).not.toContain("drop-shadow(");
    }
  });

  it("rejects unsupported enum members and text pretending to be a shadow enum", () => {
    for (const shadow of ['="DropShadow.Bold"', "=DropShadow.SuperBold"]) {
      const html = render({ Fill: "=Color.White", DropShadow: shadow });
      expect(html).toContain('data-preview-shadow-state="unknown"');
      expect(html).not.toContain("drop-shadow(");
    }
  });

  it("does not apply container shadows to unrelated controls", () => {
    const html = render({
      Fill: "=Color.White", DropShadow: "=DropShadow.Bold"
    }, 768, "Classic/Button@2.2.0");
    expect(html).not.toContain("drop-shadow(");
    expect(html).not.toContain("data-preview-shadow-state=");
  });

  it("accepts a local, explicitly supplied state without assuming runtime data", () => {
    const control = container({
      Fill: "=Color.White",
      DropShadow: "=If(varLocal, DropShadow.Light, DropShadow.None)"
    });
    const html = renderToStaticMarkup(<svg><CanvasVisualControl
      control={control} x={0} y={0} width={100} height={50}
      clipId="local-shadow" simulationSymbols={{ varLocal: true }} /></svg>);
    expect(html).toContain("drop-shadow(");
    expect(html).not.toContain('data-preview-shadow-state="unknown"');
  });

  it("works with the official pa.yaml Screens/Children/Properties structure", () => {
    const yaml = [
      "Screens:",
      "  Synthetic:",
      "    Children:",
      "      - SyntheticContainer:",
      "          Control: GroupContainer@1.3.0",
      "          Properties:",
      "            Fill: =Color.White",
      "            DropShadow: =If(varRuntime, DropShadow.Bold, DropShadow.None)"
    ].join("\n");
    const model = buildCanvasModel([{
      path: "Src/Synthetic.pa.yaml", name: "Synthetic.pa.yaml",
      content: yaml, origin: "yaml", format: "pa-yaml-v3"
    }], "yaml");
    expect(model.screens).toHaveLength(1);
    const html = renderToStaticMarkup(<svg><CanvasVisualControl
      control={model.screens[0].children[0]} x={0} y={0}
      width={160} height={80} clipId="yaml-shadow" /></svg>);
    expect(html).toContain('data-preview-shadow-state="unknown"');
  });
});
