import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl, CanvasScreen } from "../types/canvas";
import { CanvasPreview } from "./CanvasPreview";

function control(name: string, type: string, properties: Record<string, unknown>,
  children: CanvasControl[] = []): CanvasControl {
  return {
    id: name, name, controlType: type, properties, children,
    sourceFile: "Src/Generic.pa.yaml", sourcePath: "Screens/Generic/" + name,
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
}

function renderHost(radius: string) {
  const child = control("Child", "Classic/Label@2.5.1", {
    X: "=0", Y: "=0", Width: "=30", Height: "=20", Text: '="Local fixture"'
  });
  const host = control("Host", "GroupContainer@1.3.0", {
    X: "=10", Y: "=20", Width: "=100", Height: "=40",
    RadiusTopLeft: radius, RadiusTopRight: "=0",
    RadiusBottomRight: "=6", RadiusBottomLeft: "=2"
  }, [child]);
  const screen: CanvasScreen = {
    id: "Generic", name: "Generic", properties: {}, children: [host],
    sourceFile: "Src/Generic.pa.yaml", sourceFormat: "pa-yaml-v3"
  };
  return renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
}

describe("CanvasPreview nested host clipping", () => {
  it("uses serialized host corners for the child clipping definition", () => {
    const html = renderHost("=12");
    expect(html).toMatch(/<clipPath[^>]*><path d="M 22 20 H 110 Q 110 20 110 20/);
    expect(html).toContain("Q 110 60 104 60");
    expect(html).toContain("Local fixture");
  });

  it("does not hide child pixels using guessed runtime corner radii", () => {
    const html = renderHost("=If(varAccess, 12, 0)");
    expect(html).toMatch(/<clipPath[^>]*><path d="M 10 20 H 110/);
  });
});
