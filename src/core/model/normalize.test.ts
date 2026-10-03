import { describe, expect, it } from "vitest";
import { buildCanvasModel, splitLegacyDeclaration } from "./normalize";
import type { SourceFile } from "../../types/canvas";

function source(
  path: string,
  content: string,
  format: SourceFile["format"] = "pa-yaml-v3"
): SourceFile {
  return {
    path,
    name: path.split("/").at(-1) ?? path,
    content,
    origin: "yaml",
    format
  };
}

describe("buildCanvasModel", () => {
  it("normalizes current screens and nested controls", () => {
    const content = [
      "Screens:",
      "  Home:",
      "    Children:",
      "      - Label1:",
      "          Control: Label@1.2.3",
      "          Properties:",
      '            Text: ="Hello"',
      "      - Gallery1:",
      "          Control: Gallery",
      "          Children:",
      "            - InnerLabel:",
      "                Control: Label"
    ].join("\n");

    const model = buildCanvasModel(
      [source("Src/Home.pa.yaml", content)],
      "yaml"
    );

    expect(model.sourceFormat).toBe("pa-yaml-v3");
    expect(model.screens).toHaveLength(1);
    expect(model.screens[0].children).toHaveLength(2);
    expect(model.screens[0].children[0].controlType).toBe("Label");
    expect(model.screens[0].children[0].version).toBe("1.2.3");
    expect(model.screens[0].children[1].children[0].name).toBe("InnerLabel");
  });

  it("normalizes retired fx.yaml screens, groups, and explicit z-index", () => {
    const content = [
      "Screen1 As screen:",
      "    Fill: =RGBA(250, 250, 250, 1)",
      "    Label2 As label:",
      '        Text: ="Second"',
      "        X: =100",
      "        ZIndex: =2",
      "    Group1 As group:",
      "        ZIndex: =1",
      "        Label1 As label:",
      '            Text: ="First"',
      "            ZIndex: =1"
    ].join("\n");

    const model = buildCanvasModel(
      [source("Src/Screen1.fx.yaml", content, "fx-yaml-legacy")],
      "yaml"
    );

    expect(model.sourceFormat).toBe("fx-yaml-legacy");
    expect(model.screens).toHaveLength(1);
    expect(model.screens[0].properties.Fill).toBe("=RGBA(250, 250, 250, 1)");
    expect(model.screens[0].children[0].name).toBe("Group1");
    expect(model.screens[0].children[0].children[0].name).toBe("Label1");
    expect(model.screens[0].children[1].name).toBe("Label2");
  });

  it("extracts formulas nested in retired CanvasComponent UDF declarations", () => {
    const content = [
      "GeoUtils As CanvasComponent:",
      "    Distance(Lat1 As Number, Lat2 As Number):",
      "        Lat1:",
      "            Default: =0",
      "        Lat2:",
      "            Default: =0",
      "        ThisProperty:",
      "            Default: =Abs(Lat2 - Lat1)",
      "    Height: =10",
      "    Width: =10"
    ].join("\n");

    const model = buildCanvasModel(
      [source("Src/Components/GeoUtils.fx.yaml", content, "fx-yaml-legacy")],
      "yaml"
    );

    expect(model.components).toHaveLength(1);
    expect(
      model.components[0].properties[
        "Distance(Lat1 As Number, Lat2 As Number).ThisProperty.Default"
      ]
    ).toBe("=Abs(Lat2 - Lat1)");
  });

  it("infers modern format for generic yaml with a modern top-level object", () => {
    const model = buildCanvasModel(
      [
        source(
          "Home.yaml",
          "Screens:\n  Home:\n    Children: []\n",
          "unknown-yaml"
        )
      ],
      "yaml"
    );

    expect(model.files[0].format).toBe("pa-yaml-v3");
  });
});

describe("splitLegacyDeclaration", () => {
  it("splits control declarations", () => {
    expect(splitLegacyDeclaration("Icon1 As icon.ArrowUp")).toEqual({
      name: "Icon1",
      type: "icon.ArrowUp"
    });
  });

  it("preserves As tokens inside UDF parameter lists", () => {
    expect(
      splitLegacyDeclaration(
        "JsonDiffToTable(JsonBefore As String, JsonAfter As String)"
      )
    ).toBeNull();
  });

  it("unquotes legacy names and types", () => {
    expect(
      splitLegacyDeclaration("'color-functions_1' As 'color-functions'")
    ).toEqual({
      name: "color-functions_1",
      type: "color-functions"
    });
  });
});
