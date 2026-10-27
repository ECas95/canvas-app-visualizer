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

  it("keeps AutoLayout visibility unknown when Parent geometry is only a preview fallback", () => {
    const sensitive = control("UnverifiedChild", "GroupContainer@1.3.0", {
      Width: "=100", Height: "=30", Visible: "=Parent.Width > 2000"
    }, [control("SensitiveLabel", "Classic/Label@2.5.1", {
      Text: '="Synthetic protected descendant"', Width: "=90", Height: "=20"
    })]);
    const host = control("AutoHost", "GroupContainer@1.3.0", {
      X: "=0", Y: "=0", Width: "=varSqlWidth", Height: "=120",
      LayoutDirection: "=LayoutDirection.Horizontal",
      LayoutAlignItems: "=LayoutAlignItems.Start"
    }, [sensitive, control("Sibling", "Classic/Label@2.5.1", {
      Width: "=100", Height: "=30", Text: '="Synthetic sibling"'
    })]);
    host.variant = "AutoLayout";
    const screen: CanvasScreen = {
      id: "Synthetic", name: "Synthetic", properties: {}, children: [host],
      sourceFile: "Src/SyntheticVisibility.pa.yaml", sourceFormat: "pa-yaml-v3"
    };
    const html = renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
    expect(html).toContain("Inspect UnverifiedChild");
    expect(html).toContain("Inspect Sibling");
    expect(html).not.toContain("Synthetic protected descendant");
    expect(html).not.toContain("Inspect SensitiveLabel");
  });

  it("does not trust fallback Self.Width when width depends on runtime SQL state", () => {
    const html = preview("=Self.Width > 250", "=varSqlWidth");
    expect(html).toContain("Inspect ConditionalHost");
    expect(html).not.toContain("Synthetic descendant");
    expect(html).not.toContain("Inspect VisibleChild");
  });

  it.each([
    "=Parent.Width > 2000",
    "=Parent.Width < 2000"
  ])("does not decide absolute-child visibility using an unknown parent's fallback: %s", condition => {
    const protectedText = control("ProtectedText", "Classic/Label@2.5.1", {
      Text: '="Synthetic protected descendant"', Width: "=120", Height: "=20"
    });
    const conditional = control("ConditionalChild", "GroupContainer@1.3.0", {
      X: "=4", Y: "=4", Width: "=150", Height: "=50", Visible: condition
    }, [protectedText]);
    const host = control("RuntimeSizedHost", "GroupContainer@1.3.0", {
      X: "=0", Y: "=0", Width: "=varSqlWidth", Height: "=120"
    }, [conditional]);
    const screen: CanvasScreen = {
      id: "Synthetic", name: "Synthetic", properties: {}, children: [host],
      sourceFile: "Src/SyntheticVisibility.pa.yaml", sourceFormat: "pa-yaml-v3"
    };
    const html = renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
    expect(html).toContain("Inspect ConditionalChild");
    expect(html).not.toContain("Synthetic protected descendant");
    expect(html).not.toContain("Inspect ProtectedText");
  });

  it.each([
    ["=300", true],
    ["=100", false]
  ])("preserves verified Parent.Width visibility for a fixed host %s", (width, shown) => {
    const leaf = control("KnownLeaf", "Classic/Label@2.5.1", {
      Text: '="Synthetic verified descendant"', Width: "=100", Height: "=20"
    });
    const conditional = control("KnownChild", "GroupContainer@1.3.0", {
      X: "=4", Y: "=4", Width: "=120", Height: "=40",
      Visible: "=Parent.Width > 200"
    }, [leaf]);
    const host = control("FixedHost", "GroupContainer@1.3.0", {
      X: "=0", Y: "=0", Width: width, Height: "=120"
    }, [conditional]);
    const screen: CanvasScreen = {
      id: "Synthetic", name: "Synthetic", properties: {}, children: [host],
      sourceFile: "Src/SyntheticVisibility.pa.yaml", sourceFormat: "pa-yaml-v3"
    };
    const html = renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
    expect(html.includes("Synthetic verified descendant")).toBe(shown);
    expect(html.includes("Inspect KnownChild")).toBe(shown);
  });
  it.each(["Width", "Height"] as const)(
    "does not certify omitted parent %s as a runtime dimension",
    omitted => {
      const conditional = control("ConditionalChild", "GroupContainer@1.3.0", {
        X: "=4", Y: "=4", Width: "=100", Height: "=40",
        Visible: omitted === "Width" ? "=Parent.Width > 200" : "=Parent.Height > 200"
      }, [control("ProtectedLeaf", "Classic/Label@2.5.1", {
        Width: "=80", Height: "=20", Text: '="Synthetic protected text"'
      })]);
      const properties: Record<string, unknown> = {
        X: "=0", Y: "=0", Width: "=500", Height: "=300"
      };
      delete properties[omitted];
      const screen: CanvasScreen = {
        id: "Synthetic", name: "Synthetic", properties: {},
        children: [control("DefaultSizedHost", "GroupContainer@1.3.0",
          properties, [conditional])],
        sourceFile: "Src/SyntheticVisibility.pa.yaml", sourceFormat: "pa-yaml-v3"
      };
      const html = renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
      expect(html).toContain("Inspect ConditionalChild");
      expect(html).not.toContain("Synthetic protected text");
      expect(html).not.toContain("Inspect ProtectedLeaf");
    }
  );

  it.each(["Width", "Height"] as const)(
    "does not prove Self visibility from omitted %s paint defaults",
    omitted => {
      const properties: Record<string, unknown> = {
        X: "=0", Y: "=0", Width: "=300", Height: "=300",
        Visible: omitted === "Width" ? "=Self.Width > 200" : "=Self.Height > 200"
      };
      delete properties[omitted];
      const screen: CanvasScreen = {
        id: "Synthetic", name: "Synthetic", properties: {},
        children: [control("DefaultSizedConditional", "GroupContainer@1.3.0",
          properties, [control("ProtectedLeaf", "Classic/Label@2.5.1", {
            Width: "=80", Height: "=20", Text: '="Synthetic protected text"'
          })])],
        sourceFile: "Src/SyntheticVisibility.pa.yaml", sourceFormat: "pa-yaml-v3"
      };
      const html = renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
      expect(html).toContain("Inspect DefaultSizedConditional");
      expect(html).not.toContain("Synthetic protected text");
      expect(html).not.toContain("Inspect ProtectedLeaf");
    }
  );

});
