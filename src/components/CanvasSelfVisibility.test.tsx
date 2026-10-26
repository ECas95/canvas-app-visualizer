import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl, CanvasScreen } from "../types/canvas";
import { CanvasPreview } from "./CanvasPreview";

// Synthetic controls only: no private Canvas YAML, SQL rows or runtime identity.
function control(name: string, type: string, properties: Record<string, unknown>,
  children: CanvasControl[] = []): CanvasControl {
  return {
    id: name, name, controlType: type, properties, children,
    sourceFile: "Src/SyntheticVisibility.pa.yaml",
    sourcePath: "Screens/Synthetic/" + name,
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
}

function preview(visible: string, width: string, x = "=16"): string {
  const child = control("VisibleChild", "Classic/Label@2.5.1", {
    Text: '="Synthetic descendant"', Width: "=120", Height: "=24"
  });
  const host = control("ConditionalHost", "GroupContainer@1.3.0", {
    X: x, Y: "=24", Width: width, Height: "=64", Visible: visible
  }, [child]);
  const screen: CanvasScreen = {
    id: "Synthetic", name: "Synthetic", properties: {},
    children: [host], sourceFile: "Src/SyntheticVisibility.pa.yaml",
    sourceFormat: "pa-yaml-v3"
  };
  return renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
}

describe("CanvasPreview current-control Self scope in Visible", () => {
  it("renders descendants when a verified Self.Width/Height condition is true", () => {
    const html = preview("=Self.Width > 250 && Self.Height = 64", "=300");
    expect(html).toContain("Synthetic descendant");
    expect(html).toContain("Inspect VisibleChild");
  });

  it("omits descendants when verified Self geometry makes Visible false", () => {
    const html = preview("=Self.Width > 250", "=200");
    expect(html).not.toContain("Synthetic descendant");
    expect(html).not.toContain("Inspect ConditionalHost");
  });

  it("resolves Self.X/Y relative to the parent instead of screen offsets", () => {
    const html = preview("=Self.X = 16 && Self.Y = 24", "=300");
    expect(html).toContain("Synthetic descendant");
  });

  it("does not trust fallback Self.Width when width depends on runtime SQL state", () => {
    const html = preview("=Self.Width > 250", "=varSqlWidth");
    expect(html).toContain("Inspect ConditionalHost");
    expect(html).not.toContain("Synthetic descendant");
    expect(html).not.toContain("Inspect VisibleChild");
  });
});
