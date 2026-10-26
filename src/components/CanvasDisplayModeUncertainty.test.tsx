import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { CanvasVisualControl } from "./CanvasVisualControl";
import { previewDisplayMode } from "../core/layout/previewAppearance";

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
  it.each([
    [390, "disabled", 'opacity="0.66"'],
    [768, "view", 'opacity="1"'],
    [1366, "edit", 'opacity="1"']
  ] as const)("resolves verified responsive Switch DisplayMode at %i px", (width, expected, opacity) => {
    const formula = "=Switch(true, App.Width < 600, DisplayMode.Disabled, App.Width < 1024, DisplayMode.View, DisplayMode.Edit)";
    expect(previewDisplayMode(formula, { "App.Width": width })).toBe(expected);
    const html = render(formula, { "App.Width": width });
    expect(html).toContain(opacity);
    expect(html).not.toContain('data-preview-display-mode-state="unknown"');
  });

  it("respects Switch match order, defaults and nested typed enum branches", () => {
    expect(previewDisplayMode("=Switch(2, 1, DisplayMode.Disabled, 2, If(false, DisplayMode.Edit, DisplayMode.View), DisplayMode.Edit)"))
      .toBe("view");
    expect(previewDisplayMode("=Switch(false, true, DisplayMode.Disabled, DisplayMode.Edit)"))
      .toBe("edit");
    expect(previewDisplayMode("=Switch(1, 2, DisplayMode.Disabled, DisplayMode.Edit)"))
      .toBe("edit");
    expect(previewDisplayMode("=Switch(1, 2, DisplayMode.Disabled)"))
      .toBe("unresolved");
    expect(previewDisplayMode("=Switch(1, 1, DisplayMode.Disabled, varSqlRole, DisplayMode.Edit)"))
      .toBe("disabled");
  });

  it.each([
    "=Switch(varSqlRole, 1, DisplayMode.Edit, DisplayMode.Disabled)",
    "=Switch(true, varSqlPermission, DisplayMode.Edit, DisplayMode.Disabled)",
    "=Switch(true, false, DisplayMode.Disabled, varSqlPermission, DisplayMode.Edit, DisplayMode.View)",
    '=Switch("admin", "admin", DisplayMode.Edit, DisplayMode.Disabled)',
    '=Switch(true, true, "DisplayMode.Edit", DisplayMode.Disabled)',
    "=Switch(true, 1, DisplayMode.Edit, DisplayMode.Disabled)",
    "=Switch(true, true, varSqlDisplayMode, DisplayMode.Edit)",
    "=Switch(true, true, DisplayMode.Edit) & DisplayMode.Disabled",
    "=Connector.Switch(true, true, DisplayMode.Edit, DisplayMode.Disabled)",
    "=Switch()"
  ])("does not infer runtime permissions or typed enum values from %s", formula => {
    expect(previewDisplayMode(formula)).toBe("unresolved");
    const html = render(formula);
    expect(html).toContain('data-preview-display-mode-state="unknown"');
  });

});
