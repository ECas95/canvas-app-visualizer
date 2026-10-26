import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { CanvasVisualControl } from "./CanvasVisualControl";

function render(displayMode?: string, symbols?: Record<string, number | string | boolean>): string {
  const control: CanvasControl = {
    id: "synthetic-button", name: "SyntheticButton",
    controlType: "Classic/Button@2.2.0",
    properties: {
      Text: '="Verified action"',
      ...(displayMode === undefined ? {} : { DisplayMode: displayMode })
    },
    children: [], sourceFile: "Src/Synthetic.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticButton",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={10} y={20} width={140} height={64}
    clipId="display-mode-test" simulationSymbols={symbols}
  /></svg>);
}

describe("Canvas DisplayMode runtime uncertainty", () => {
  it("marks unresolved SQL/security-dependent DisplayMode without inferring permission", () => {
    const html = render("=If(varSqlAuthorized, DisplayMode.Edit, DisplayMode.Disabled)");
    expect(html).toContain('data-preview-display-mode-state="unknown"');
    expect(html).toContain("interaction permissions are not verified");
    expect(html).toContain("Verified action");
    expect(html).not.toContain("varSqlAuthorized");
  });

  it("does not label a verified disabled control as runtime-unknown", () => {
    const html = render("=DisplayMode.Disabled");
    expect(html).toContain('opacity="0.66"');
    expect(html).not.toContain('data-preview-display-mode-state="unknown"');
  });

  it("resolves viewport-only conditions without inferring SQL or identity", () => {
    const formula = "=If(App.Width < 720, DisplayMode.Disabled, DisplayMode.Edit)";
    const phone = render(formula, { "App.Width": 390 });
    const desktop = render(formula, { "App.Width": 1366 });
    expect(phone).toContain('opacity="0.66"');
    expect(desktop).toContain('opacity="1"');
    expect(phone).not.toContain('data-preview-display-mode-state="unknown"');
    expect(desktop).not.toContain('data-preview-display-mode-state="unknown"');
  });

  it("does not mark an omitted DisplayMode as unknown", () => {
    const html = render();
    expect(html).not.toContain('data-preview-display-mode-state="unknown"');
    expect(html).not.toContain("interaction permissions are not verified");
  });
});
