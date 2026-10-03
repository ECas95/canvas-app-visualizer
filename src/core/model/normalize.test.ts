import { describe, expect, it } from "vitest";
import { buildCanvasModel } from "./normalize";

describe("buildCanvasModel", () => {
  it("normalizes screens and nested controls", () => {
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
      [{ path: "Src/Home.pa.yaml", name: "Home.pa.yaml", content, origin: "yaml" }],
      "yaml"
    );

    expect(model.screens).toHaveLength(1);
    expect(model.screens[0].children).toHaveLength(2);
    expect(model.screens[0].children[0].controlType).toBe("Label");
    expect(model.screens[0].children[0].version).toBe("1.2.3");
    expect(model.screens[0].children[1].children[0].name).toBe("InnerLabel");
  });
});
