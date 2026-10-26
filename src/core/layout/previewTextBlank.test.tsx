import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../../types/canvas";
import { buildCanvasModel } from "../model/normalize";
import { previewText } from "./previewAppearance";
import { CanvasVisualControl } from "../../components/CanvasVisualControl";

function control(type: string, properties: Record<string, unknown>): CanvasControl {
  return {
    id: "SyntheticText", name: "SyntheticText", controlType: type,
    properties, children: [], zIndex: 1,
    sourceFile: "Src/SyntheticText.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticText",
    sourceFormat: "pa-yaml-v3"
  };
}

function svg(item: CanvasControl, symbols?: Record<string, string | number | boolean>): string {
  return renderToStaticMarkup(<svg><CanvasVisualControl control={item}
    x={0} y={0} width={180} height={50}
    clipId="synthetic-text-clip" simulationSymbols={symbols} /></svg>);
}

describe("verified blank text versus runtime-unknown Canvas text", () => {
  it("does not call a proven Blank() label unknown or paint a placeholder", () => {
    const item = control("Classic/Label@2.5.1", { Text: "=Blank()" });
    expect(previewText(item)).toBe("");
    const html = svg(item);
    expect(html).not.toContain('data-preview-text-state="unknown"');
    expect(html).not.toContain("Text unknown");
    expect(html).not.toContain("Blank()</tspan>");
  });

  it("treats an If with no selected branch and no else as verified empty", () => {
    const item = control("Classic/Label@2.5.1", {
      Text: '=If(false, "Never visible")'
    });
    expect(previewText(item)).toBe("");
    const html = svg(item);
    expect(html).not.toContain("Never visible");
    expect(html).not.toContain("Text unknown");
  });

  it("does not substitute the illustrative Button caption for Blank()", () => {
    const item = control("Classic/Button@2.2.0", { Text: "=Blank()" });
    const html = svg(item);
    expect(previewText(item)).toBe("");
    expect(html).not.toContain("Button</tspan>");
    expect(html).not.toContain("…</tspan>");
  });

  it("never falls back to Label when explicit Text needs SQL/runtime", () => {
    const item = control("Classic/Label@2.5.1", {
      Text: "=ThisItem.Secret", Label: '="Stale fallback"'
    });
    expect(previewText(item)).toBeNull();
    const html = svg(item);
    expect(html).toContain('data-preview-text-state="unknown"');
    expect(html).not.toContain("Stale fallback");
    expect(html).not.toContain("ThisItem.Secret</tspan>");
  });

  it("resolves a viewport-only blank branch but keeps unknown permission branches unresolved", () => {
    const item = control("ModernText@1.0.0", {
      Text: '=If(App.Width < 720, Blank(), "Desktop title")'
    });
    expect(previewText(item, { "App.Width": 390 })).toBe("");
    expect(previewText(item, { "App.Width": 1366 })).toBe("Desktop title");
    expect(previewText(item)).toBeNull();
    expect(svg(item, { "App.Width": 390 })).not.toContain("Text unknown");
    expect(svg(item, { "App.Width": 1366 })).toContain("Desktop title");
    expect(svg(item)).toContain('data-preview-text-state="unknown"');
    const secured = control("ModernText@1.0.0", {
      Text: '=If(varSqlAuthorized, Blank(), "Denied")'
    });
    expect(previewText(secured)).toBeNull();
    expect(svg(secured)).toContain('data-preview-text-state="unknown"');
  });

  it("does not mistake quoted Blank() or longer expressions for the function", () => {
    const literal = control("Classic/Label@2.5.1", { Text: '="Blank()"' });
    const expression = control("Classic/Label@2.5.1", { Text: '=Blank() & "x"' });
    expect(previewText(literal)).toBe("Blank()");
    expect(previewText(expression)).toBeNull();
    expect(svg(literal)).toContain("Blank()</tspan>");
    expect(svg(expression)).toContain('data-preview-text-state="unknown"');
  });

  it("preserves a source-verified empty Text after synthetic pa.yaml import", () => {
    const yaml = [
      "Screens:", "  Synthetic:", "    Children:",
      "      - EmptyCaption:",
      "          Control: Classic/Label@2.5.1",
      "          Properties:",
      '            Text: =If(false, "Not loaded")',
      "            Width: =180",
      "            Height: =50"
    ].join("\n");
    const model = buildCanvasModel([{
      path: "Src/SyntheticText.pa.yaml", name: "SyntheticText.pa.yaml",
      content: yaml, origin: "yaml", format: "pa-yaml-v3"
    }], "yaml");
    const item = model.screens[0].children[0];
    expect(previewText(item)).toBe("");
    expect(svg(item)).not.toContain("Text unknown");
    expect(svg(item)).not.toContain("Not loaded");
  });
});
