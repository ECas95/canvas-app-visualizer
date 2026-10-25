import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { buildCanvasModel } from "../core/model/normalize";
import { CanvasVisualControl } from "./CanvasVisualControl";

function button(properties: Record<string, unknown>, controlType = "Classic/Button@2.2.0"): CanvasControl {
  return {
    id: "synthetic-button", name: "SyntheticButton", controlType,
    properties, children: [], zIndex: 0,
    sourceFile: "Src/Synthetic.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticButton",
    sourceFormat: "pa-yaml-v3"
  };
}

function render(control: CanvasControl, viewport = 768): string {
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={10} y={20} width={160} height={48}
    clipId="synthetic-button-text-clip"
    simulationSymbols={{ "App.Width": viewport }}
  /></svg>);
}

describe("Canvas button Text uncertainty", () => {
  it.each([
    ["SQL-dependent classic", "Classic/Button@2.2.0", "=ThisItem.DisplayName"],
    ["permission-dependent modern", "ModernButton@2.0.0", '=If(varSqlAuthorized, "Open", "Locked")']
  ])("flags %s text without claiming a runtime caption", (_name, type, formula) => {
    const html = render(button({ Text: formula }, type));
    expect(html).toContain('data-preview-text-state="unknown"');
    expect(html).toContain("the ellipsis is a preview placeholder");
    expect(html).toContain("…</tspan>");
    expect(html).not.toContain("Open</tspan>");
    expect(html).not.toContain("Locked</tspan>");
    expect(html).not.toContain("DisplayName</tspan>");
  });

  it("does not invent a default caption when legacy Label is runtime-dependent", () => {
    const html = render(button({ Label: "=varRuntimeLabel" }));
    expect(html).toContain('data-preview-text-state="unknown"');
    expect(html).toContain("…</tspan>");
    expect(html).not.toContain("Button</tspan>");
  });

  it("renders verified literal Text without an uncertainty marker", () => {
    const html = render(button({ Text: '="Save"' }));
    expect(html).toContain("Save</tspan>");
    expect(html).not.toContain('data-preview-text-state="unknown"');
    expect(html).not.toContain("…</tspan>");
  });

  it.each(["=Blank()", '=""', '=If(false, "Never")'])(
    "preserves a verified empty button caption for %s",
    formula => {
      const html = render(button({ Text: formula }));
      expect(html).not.toContain('data-preview-text-state="unknown"');
      expect(html).not.toContain("…</tspan>");
      expect(html).not.toContain("Button</tspan>");
      expect(html).not.toContain("Never</tspan>");
    }
  );

  it.each([390, 768, 1366])(
    "resolves viewport-only Text at %i px without runtime assumptions",
    viewport => {
      const html = render(button({
        Text: '=If(App.Width < 720, "Phone", "Desktop")'
      }), viewport);
      expect(html).toContain(viewport < 720 ? "Phone</tspan>" : "Desktop</tspan>");
      expect(html).not.toContain('data-preview-text-state="unknown"');
    }
  );

  it("retains the illustrative default when no Text or Label is serialized", () => {
    const html = render(button({}));
    expect(html).toContain("Button</tspan>");
    expect(html).not.toContain('data-preview-text-state="unknown"');
  });

  it("keeps SQL-dependent Text unknown after generic .pa.yaml import", () => {
    const yaml = [
      "Screens:", "  Synthetic:", "    Children:",
      "      - SubmitButton:",
      "          Control: Classic/Button@2.2.0",
      "          Properties:", "            Text: =varSqlCaption",
      "            Width: =160", "            Height: =48"
    ].join("\n");
    const model = buildCanvasModel([{
      path: "Src/Synthetic.pa.yaml", name: "Synthetic.pa.yaml",
      content: yaml, origin: "yaml", format: "pa-yaml-v3"
    }], "yaml");
    const html = render(model.screens[0].children[0]);
    expect(html).toContain('data-preview-text-state="unknown"');
    expect(html).toContain("…</tspan>");
    expect(html).not.toContain("varSqlCaption</tspan>");
  });
});
