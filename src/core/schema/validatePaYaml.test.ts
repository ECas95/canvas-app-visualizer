import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import type { SourceFile } from "../../types/canvas";
import { getBundledSchemaInfo, validatePaYamlObject } from "./validatePaYaml";

function file(content: string): SourceFile {
  return {
    path: "Src/Home.pa.yaml",
    name: "Home.pa.yaml",
    content,
    origin: "yaml",
    format: "pa-yaml-v3"
  };
}

describe("Canvas v3 schema validation", () => {
  it("bundles the official v3 schema identity", () => {
    const info = getBundledSchemaInfo();
    expect(info.id).toContain("/pa-yaml/v3.0/");
  });

  it("accepts a minimal current screen source", () => {
    const content = [
      "Screens:",
      "  Home:",
      "    Children:",
      "      - Title:",
      "          Control: Label@1.0.0",
      "          Properties:",
      '            Text: ="Hello"'
    ].join("\n");

    expect(validatePaYamlObject(parse(content), file(content))).toEqual([]);
  });

  it("rejects a property value without the Power Fx prefix", () => {
    const content = [
      "Screens:",
      "  Home:",
      "    Children:",
      "      - Title:",
      "          Control: Label",
      "          Properties:",
      "            Text: Hello"
    ].join("\n");

    const problems = validatePaYamlObject(parse(content), file(content));

    expect(
      problems.some(problem =>
        problem.message.includes("must match pattern")
      )
    ).toBe(true);
  });

  it("rejects a current control without Control", () => {
    const content = [
      "Screens:",
      "  Home:",
      "    Children:",
      "      - Title:",
      "          Properties:",
      '            Text: ="Hello"'
    ].join("\n");

    const problems = validatePaYamlObject(parse(content), file(content));

    expect(
      problems.some(problem =>
        problem.message.toLowerCase().includes("required property")
      )
    ).toBe(true);
  });

  it("warns when several current top-level objects are combined in one file", () => {
    const content = [
      "App:",
      "  Properties:",
      "    StartScreen: =Home",
      "Screens:",
      "  Home:",
      "    Children: []"
    ].join("\n");

    const problems = validatePaYamlObject(parse(content), file(content));

    expect(
      problems.some(problem =>
        problem.message.includes("one top-level Canvas object")
      )
    ).toBe(true);
  });
});
