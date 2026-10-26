import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { CanvasVisualControl } from "./CanvasVisualControl";

/**
 * Source-only foreground colors must never be presented as verified when
 * they depend on SQL, identity, or another unavailable runtime value.
 * This is a generic .pa.yaml v3 fixture, not a private Canvas app.
 *
 * https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-colors
 * https://github.com/microsoft/PowerApps-Tooling/blob/master/schemas/pa-yaml/v3.0/pa.schema.yaml
 */
function render(
  controlType: string,
  properties: Record<string, unknown>,
  viewport = 768
): string {
  const control: CanvasControl = {
    id: "synthetic-foreground", name: "SyntheticForeground",
    controlType, properties, children: [],
    sourceFile: "Src/GenericForeground.pa.yaml",
    sourcePath: "Screens/Generic/SyntheticForeground",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={10} y={20} width={240} height={72}
    clipId="synthetic-foreground-clip"
    simulationSymbols={{ "App.Width": viewport }}
  /></svg>);
}

describe("source-only Canvas foreground Color certainty", () => {
  it.each([
    ["Classic/Label@2.5.1", { Text: '="Label"', Color: "=varSqlColor" }],
    ["Classic/Button@2.2.0", { Text: '="Save"', Color: "=varSqlColor" }],
    ["Classic/CheckBox@2.1.0", { Text: '="Agree"', Color: "=varSqlColor" }],
    ["Classic/TextInput@2.3.2", { Default: '="Entry"', Color: "=varSqlColor" }],
    ["Classic/Icon@2.5.0", { Icon: "=Icon.Add", Color: "=varSqlColor" }]
  ] as const)("marks unknown foreground on %s without claiming a runtime color", (type, props) => {
    const html = render(type, props);
    expect(html).toContain('data-preview-color-state="unknown"');
    expect(html).toContain("Foreground Color cannot be verified");
    expect(html).not.toContain("varSqlColor</tspan>");
  });

  it("honors ModernIcon.IconColor precedence over a known Color fallback", () => {
    const html = render("ModernIcon@1.1.0", {
      Icon: '="Add"', Color: "=Color.Red", IconColor: "=varSqlIconColor"
    });
    expect(html).toContain('data-preview-color-state="unknown"');
    expect(html).toContain('stroke="#242424"');
    expect(html).not.toContain('stroke="#ff0000"');
  });

  it("resolves a verified modern icon color", () => {
    const html = render("ModernIcon@1.1.0", {
      Icon: '="Add"', IconColor: "=Color.Green"
    });
    expect(html).not.toContain('data-preview-color-state="unknown"');
    expect(html).toContain('stroke="#008000"');
  });

  it("does not substitute normal Color for unresolved DisabledColor", () => {
    const html = render("Classic/Label@2.5.1", {
      Text: '="Disabled"', DisplayMode: "=DisplayMode.Disabled",
      Color: "=Color.Blue", DisabledColor: "=varPermissionColor"
    });
    expect(html).toContain('data-preview-color-state="unknown"');
    expect(html).not.toContain('fill="#0000ff"');
  });

  it("uses a verified DisabledColor in a known disabled mode", () => {
    const html = render("Classic/Label@2.5.1", {
      Text: '="Disabled"', DisplayMode: "=DisplayMode.Disabled",
      Color: "=varNormalColor", DisabledColor: "=Color.Red"
    });
    expect(html).not.toContain('data-preview-color-state="unknown"');
    expect(html).toContain('fill="#ff0000"');
  });

  it.each([
    [390, "#ff0000"],
    [768, "#0000ff"],
    [1366, "#0000ff"]
  ])("resolves responsive foreground without runtime guessing at %i px", (viewport, color) => {
    const html = render("Classic/Label@2.5.1", {
      Text: '="Responsive"',
      Color: "=If(App.Width < 720, Color.Red, Color.Blue)"
    }, viewport);
    expect(html).toContain(`fill="${color}"`);
    expect(html).not.toContain('data-preview-color-state="unknown"');
  });

  it("does not classify omitted Color as runtime unknown", () => {
    const html = render("Classic/Label@2.5.1", { Text: '="Default"' });
    expect(html).not.toContain('data-preview-color-state="unknown"');
  });

  it("keeps a known literal ColorValue as verified", () => {
    const html = render("Classic/Label@2.5.1", {
      Text: '="Hex"', Color: '=ColorValue("#112233")'
    });
    expect(html).toContain('fill="#112233"');
    expect(html).not.toContain('data-preview-color-state="unknown"');
  });

  it("marks unsupported color expressions without emitting unsafe CSS", () => {
    const html = render("Classic/Label@2.5.1", {
      Text: '="Safe"', Color: '=ColorValue("red;stroke:lime")'
    });
    expect(html).toContain('data-preview-color-state="unknown"');
    expect(html).not.toContain("stroke:lime");
  });

  it("keeps foreground and background uncertainty independent", () => {
    const html = render("Classic/Label@2.5.1", {
      Text: '="Known text color"', Color: "=Color.Green", Fill: "=varSqlFill"
    });
    expect(html).toContain('data-preview-fill-state="unknown"');
    expect(html).not.toContain('data-preview-color-state="unknown"');
  });
});
