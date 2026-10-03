import { describe, expect, it } from "vitest";
import { controlRect, literalNumber, literalText, rgba } from "./layout";
import type { CanvasControl } from "../../types/canvas";

describe("layout literal helpers", () => {
  it("parses numeric formulas", () => {
    expect(literalNumber("=40")).toBe(40);
    expect(literalNumber("=Parent.Width")).toBeNull();
  });

  it("parses constant text expressions", () => {
    expect(literalText('="Hello"')).toBe("Hello");
    expect(literalText('="Hello " & "world"')).toBe("Hello world");
  });

  it("parses RGBA formulas", () => {
    expect(rgba("=RGBA(1, 2, 3, 0.5)")).toBe("rgba(1,2,3,0.5)");
  });

  it("resolves common Parent and Self geometry expressions", () => {
    const control: CanvasControl = {
      id: "1",
      name: "Centered",
      controlType: "Label",
      properties: {
        Width: "=Parent.Width / 2",
        Height: "=40",
        X: "=(Parent.Width - Self.Width) / 2",
        Y: "=20"
      },
      children: [],
      sourceFile: "Src/Home.pa.yaml",
      sourcePath: "Screens/Home/Centered",
      zIndex: 1,
      sourceFormat: "pa-yaml-v3"
    };

    const rect = controlRect(control, 0, {
      parentWidth: 1000,
      parentHeight: 600,
      appWidth: 1000,
      appHeight: 600
    });

    expect(rect.width).toBe(500);
    expect(rect.x).toBe(250);
    expect(rect.dynamic).toBe(false);
  });
});
