import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { CanvasVisualControl } from "./CanvasVisualControl";
import { buildCanvasModel } from "../core/model/normalize";

function renderInput(type: string, properties: Record<string, unknown>, symbols?: Record<string, string | number | boolean>): string {
  const control: CanvasControl = {
    id: "SyntheticInput", name: "SyntheticInput", controlType: type,
    properties, children: [], zIndex: 1,
    sourceFile: "Src/SyntheticInput.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticInput",
    sourceFormat: "pa-yaml-v3"
  };
  return renderToStaticMarkup(
    <svg><CanvasVisualControl control={control} x={10} y={20}
      width={240} height={44} clipId="synthetic-input-clip" simulationSymbols={symbols} /></svg>
  );
}

describe("Canvas source-only input placeholders", () => {
  it("does not display a hint when a serialized input value depends on runtime state", () => {
    for (const type of ["Classic/TextInput@2.3.2", "ModernTextInput@1.0.0"]) {
      const html = renderInput(type, {
        Default: "=varFromRuntime", HintText: '="Search records"'
      });
      expect(html).not.toContain("Search records");
      expect(html).toContain("…");
    }
  });

  it("renders a hint only for a known empty input, and literal values otherwise", () => {
    const type = "Classic/TextInput@2.3.2";
    expect(renderInput(type, {
      Default: '=""', HintText: '="Search records"'
    })).toContain("Search records");
    const filled = renderInput(type, {
      Default: '="Verified literal"', HintText: '="Search records"'
    });
    expect(filled).toContain("Verified literal");
    expect(filled).not.toContain("Search records");
  });

  it("renders the modern Placeholder from synthetic Microsoft pa.yaml", () => {
    const yaml = [
      "Screens:", "  Demo:", "    Children:", "      - SearchInput:",
      "          Control: ModernTextInput@1.0.0",
      "          Properties:",
      '            Default: =""',
      '            Placeholder: ="Search products"',
      "            Width: =240", "            Height: =44"
    ].join("\n");
    const model = buildCanvasModel([{
      path: "Src/SyntheticModernInput.pa.yaml",
      name: "SyntheticModernInput.pa.yaml",
      content: yaml, origin: "yaml", format: "pa-yaml-v3"
    }], "yaml");
    const control = model.screens[0].children[0];
    const html = renderToStaticMarkup(<svg><CanvasVisualControl
      control={control} x={10} y={20} width={240} height={44}
      clipId="synthetic-modern-clip" simulationSymbols={{}} /></svg>);
    expect(html).toContain('data-preview-input-state="hint"');
    expect(html).toContain("Search products");
    expect(html).toContain('fill="#7f8792"');
  });

  it("reacts to verified local empty/nonempty values without fabricating runtime data", () => {
    const type = "ModernTextInput@1.0.0";
    const props = { Default: "=varSearch", Placeholder: '="Search here"' };
    const unknown = renderInput(type, props);
    const empty = renderInput(type, props, { varSearch: "" });
    const filled = renderInput(type, props, { varSearch: "Verified local" });
    expect(unknown).toContain('data-preview-input-state="unknown"');
    expect(unknown).not.toContain("Search here");
    expect(unknown).toContain("…");
    expect(empty).toContain('data-preview-input-state="hint"');
    expect(empty).toContain("Search here");
    expect(empty).toContain('fill="#7f8792"');
    expect(filled).toContain('data-preview-input-state="value"');
    expect(filled).toContain("Verified local");
    expect(filled).not.toContain("Search here");
  });

  it("keeps classic HintText visible with a known empty Default and local state", () => {
    const html = renderInput("Classic/TextInput@2.3.2", {
      Default: '=""', HintText: '="Find records"'
    }, { varOther: true });
    expect(html).toContain('data-preview-input-state="hint"');
    expect(html).toContain("Find records");
  });
  it("treats a verified Blank() Default as empty for classic and modern text inputs", () => {
    for (const type of ["Classic/TextInput@2.3.2", "ModernTextInput@1.0.0"]) {
      const html = renderInput(type, {
        Default: "=Blank /* source comment */ ()",
        HintText: '="Find records"', Placeholder: '="Find records"'
      });
      expect(html).toContain('data-preview-input-state="hint"');
      expect(html).toContain("Find records");
      expect(html).not.toContain('data-preview-input-state="unknown"');
    }
  });

  it("recognizes only provably selected blank If branches and missing ElseResult", () => {
    for (const formula of [
      '=If(false, "filled")',
      '=If(true, Blank(), "filled")',
      '=If(false, varSqlValue, Blank())',
      '=If(false, "filled", If(false, "other"))'
    ]) {
      const html = renderInput("Classic/TextInput@2.3.2", {
        Default: formula, HintText: '="Verified hint"'
      });
      expect(html).toContain('data-preview-input-state="hint"');
      expect(html).toContain("Verified hint");
    }
    const responsive = renderInput("ModernTextInput@1.0.0", {
      Default: '=If(App.Width < 720, Blank(), "desktop")',
      Placeholder: '="Search"'
    }, { "App.Width": 390 });
    expect(responsive).toContain('data-preview-input-state="hint"');
    expect(responsive).toContain("Search");
  });

  it("does not mistake unknown conditions or lookalike text for a known blank", () => {
    for (const formula of [
      "=varSqlValue",
      "=If(varHasPermission, Blank(), \"ready\")",
      '="Blank()"',
      "=Blank",
      "=Blank(unknown)",
      "=If(varHasPermission, \"filled\")"
    ]) {
      const html = renderInput("Classic/TextInput@2.3.2", {
        Default: formula, HintText: '="Must not appear"'
      });
      expect(html).toContain('data-preview-input-state="unknown"');
      expect(html).not.toContain("Must not appear");
    }
  });

  it("distinguishes an explicitly blank hint from a runtime-dependent hint", () => {
    const empty = renderInput("Classic/TextInput@2.3.2", {
      Default: "=Blank()", HintText: "=Blank()"
    });
    expect(empty).toContain('data-preview-input-state="empty"');
    const unknown = renderInput("ModernTextInput@1.0.0", {
      Default: "=Blank()", Placeholder: "=varSqlHint"
    });
    expect(unknown).toContain('data-preview-input-state="unknown"');
    expect(unknown).not.toContain('data-preview-input-state="empty"');
  });

});
