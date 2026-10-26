import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildCanvasModel } from "../model/normalize";
import { CanvasVisualControl } from "../../components/CanvasVisualControl";
import { previewColor, previewColorWithSymbols } from "./previewAppearance";

describe("Power Fx Color literal trivia in Canvas source previews", () => {
  it("resolves complete Color enum literals with comments and whitespace", () => {
    expect(previewColor("=Color /* source comment */ . Red")).toBe("#ff0000");
    expect(previewColor("= /* leading */ COLOR . BLUE // trailing")).toBe("#0000ff");
    expect(previewColor("=Color. /* member */ Transparent")).toBe("transparent");
  });

  it("resolves ColorValue hex literals with source comments, including alpha", () => {
    expect(previewColor('=ColorValue(/* note */ "#112233" /* note */)'))
      .toBe("#112233");
    expect(previewColor('= /* note */ ColorValue ( "#11223380" ) // note'))
      .toBe("#11223380");
  });

  it("resolves only selected static If branches, not SQL/security-dependent colors", () => {
    expect(previewColorWithSymbols(
      "=If(true, Color /* chosen */ . Green, Color.Red)"
    )).toBe("#008000");
    expect(previewColorWithSymbols(
      '=If(false, Color.Red, ColorValue(/* selected */ "#aabbcc"))'
    )).toBe("#aabbcc");
    expect(previewColorWithSymbols(
      "=If(varSqlAuthorized, Color /* dynamic */ . Green, Color.Red)"
    )).toBeNull();
  });

  it("rejects malformed formulas, lookalike text, and appended operations", () => {
    for (const source of [
      '= "Color.Red"',
      "=Color /* unfinished",
      "=Color.Red & Color.Blue",
      '=ColorValue("#abcdef") & "extra"',
      '=ColorValue("#abcde")',
      '=ColorValue("#abcdef" /* unterminated',
      "=Color.AddressBook"
    ]) {
      expect(previewColor(source)).toBeNull();
    }
  });

  it("propagates verified colors from a synthetic versioned .pa.yaml into SVG", () => {
    const yaml = [
      "Screens:",
      "  Synthetic:",
      "    Children:",
      "      - Badge:",
      "          Control: Classic/Rectangle@2.3.0",
      "          Properties:",
      "            Fill: =Color /* source */ . Red",
      '            BorderColor: =If(true, Color.Blue, ColorValue("#abcdef"))',
      "            BorderThickness: =2",
      "            Width: =120",
      "            Height: =40"
    ].join("\n");
    const model = buildCanvasModel([{
      path: "Src/SyntheticColor.pa.yaml", name: "SyntheticColor.pa.yaml",
      content: yaml, origin: "yaml", format: "pa-yaml-v3"
    }], "yaml");
    const control = model.screens[0].children[0];
    const html = renderToStaticMarkup(<svg><CanvasVisualControl
      control={control} x={0} y={0} width={120} height={40}
      clipId="synthetic-color-clip" /></svg>);
    expect(html).toContain('fill="#ff0000"');
    expect(html).toContain('stroke="#0000ff"');
    expect(html).toContain('stroke-width="2"');
  });
});
