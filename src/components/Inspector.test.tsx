import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import {
  Inspector, filterInspectorProperties, formatSerializedValue,
  inspectProperties, serializedGeometry
} from "./Inspector";

describe("serialized property inspector", () => {
  const source = {
    Height: 42,
    X: " =Parent.Width - 20",
    Visible: "=If(varOpen, true, false)",
    Text: "Literal caption",
    Empty: null
  };
  const entries = inspectProperties(source);

  it("identifies Power Fx formulas with leading whitespace", () => {
    expect(entries.filter(entry => entry.formula).map(entry => entry.name))
      .toEqual(["Visible", "X"]);
    expect(entries.find(entry => entry.name === "Text")?.formula).toBe(false);
  });

  it("searches property names case-insensitively", () => {
    expect(filterInspectorProperties(entries, "height", false).map(entry => entry.name))
      .toEqual(["Height"]);
  });

  it("searches serialized formula content without evaluating it", () => {
    expect(filterInspectorProperties(entries, "parent.width", false).map(entry => entry.name))
      .toEqual(["X"]);
  });

  it("combines formula-only and text filters", () => {
    expect(filterInspectorProperties(entries, "varopen", true).map(entry => entry.name))
      .toEqual(["Visible"]);
    expect(filterInspectorProperties(entries, "caption", true)).toEqual([]);
  });

  it("handles whitespace-only and unmatched searches", () => {
    expect(filterInspectorProperties(entries, "   ", false)).toEqual(entries);
    expect(filterInspectorProperties(entries, "does-not-exist", false)).toEqual([]);
  });

  it("only displays explicitly serialized geometry in X/Y/Width/Height order", () => {
    expect(serializedGeometry(entries).map(entry => entry.name)).toEqual(["X", "Height"]);
    expect(serializedGeometry([])).toEqual([]);
  });

  it("renders complex and cyclic values without throwing", () => {
    expect(formatSerializedValue(null)).toBe("null");
    expect(formatSerializedValue({ nested: [1, 2] })).toContain('"nested"');
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(formatSerializedValue(cyclic)).toBe("[Value cannot be serialized]");
  });

  it("renders raw geometry, source metadata and accessible search controls", () => {
    const control: CanvasControl = {
      id: "label-1", name: "Label1", controlType: "Label",
      properties: source, children: [], sourceFile: "Screens/Home.pa.yaml",
      sourcePath: "Home/Label1", zIndex: 0, sourceFormat: "pa-yaml-v3"
    };
    const html = renderToStaticMarkup(
      <Inspector selection={{ kind: "control", value: control }} />
    );
    expect(html).toContain("Serialized geometry");
    expect(html).toContain("Source values · not evaluated");
    expect(html).toContain("=Parent.Width - 20");
    expect(html).toContain("Screens/Home.pa.yaml");
    expect(html).toContain('aria-label="Search serialized properties"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("5 serialized properties · 2 formulas");
    expect(html).not.toContain("Resolved geometry");
  });

  it("keeps the no-selection empty state", () => {
    expect(renderToStaticMarkup(<Inspector />)).toContain("Nothing selected");
  });
});
