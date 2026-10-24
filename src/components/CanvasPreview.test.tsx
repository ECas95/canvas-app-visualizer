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

function renderGalleryCondition(visible: string) {
  const nested = control("NestedSensitiveLabel", "Classic/Label@2.5.1", {
    Text: '="Synthetic child text"', Width: "=100", Height: "=24"
  });
  const condition = control("GalleryStatus", "GroupContainer@1.3.0", {
    X: "=16", Y: "=24", Width: "=300", Height: "=64",
    Visible: visible, OnSelect: "=Set(localFlag, true)"
  }, [nested]);
  const screen: CanvasScreen = {
    id: "Fixture", name: "Fixture", properties: {}, children: [condition],
    sourceFile: "Src/Fixture.pa.yaml", sourceFormat: "pa-yaml-v3"
  };
  return renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
}

describe("CanvasPreview runtime gallery state", () => {
  it("keeps IsEmpty(AllItems) controls inspectable but does not claim an empty result", () => {
    const html = renderGalleryCondition("=IsEmpty(galCatalog.AllItems)");
    expect(html).toContain("Inspect GalleryStatus");
    expect(html).toContain("Gallery state unknown");
    expect(html).toContain("not an empty result");
    expect(html).toContain("nodes with unknown runtime visibility");
    expect(html).not.toContain("Synthetic child text");
    expect(html).not.toContain("Inspect NestedSensitiveLabel");
  });

  it("handles CountRows(AllItems) as unknown without exposing conditional descendants", () => {
    const html = renderGalleryCondition("=CountRows(galCatalog.AllItems) = 0");
    expect(html).toContain("Gallery state unknown");
    expect(html).not.toContain("Synthetic child text");
  });

  it("omits provably false controls even if the expression references AllItems", () => {
    const html = renderGalleryCondition("=false && IsEmpty(galCatalog.AllItems)");
    expect(html).not.toContain("Inspect GalleryStatus");
    expect(html).not.toContain("Gallery state unknown");
  });
});


function renderGalleryItems(items?: string) {
  const templateLabel = control("TemplateLabel", "Classic/Label@2.5.1", {
    X: "=8", Y: "=8", Width: "=160", Height: "=28",
    Text: '="Example template, not a verified row"'
  });
  const gallery = control("DataGallery", "Classic/VerticalGallery@2.3.0", {
    X: "=20", Y: "=30", Width: "=620", Height: "=320",
    TemplateSize: "=292", TemplatePadding: "=8", WrapCount: "=2",
    ...(items === undefined ? {} : { Items: items })
  }, [templateLabel]);
  const screen: CanvasScreen = {
    id: "Synthetic", name: "Synthetic", properties: {}, children: [gallery],
    sourceFile: "Src/Synthetic.pa.yaml", sourceFormat: "pa-yaml-v3"
  };
  return renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
}

describe("CanvasPreview gallery source vs runtime rows", () => {
  it("does not turn a SQL Items formula into a visible template row", () => {
    const html = renderGalleryItems("=Filter(Modules, IsEnabled)");
    expect(html).toContain("Inspect DataGallery");
    expect(html).toContain("Template only — runtime records unavailable");
    expect(html).not.toContain("Inspect TemplateLabel");
    expect(html).not.toContain("Example template, not a verified row");
  });

  it("does not treat a source-only Table expression as an explicit verified snapshot", () => {
    const html = renderGalleryItems('=Table({Title: "Demo"})');
    expect(html).toContain("Template only — runtime records unavailable");
    expect(html).not.toContain("Inspect TemplateLabel");
  });

  it("keeps structural template inspection when no Items source was serialized", () => {
    const html = renderGalleryItems();
    expect(html).toContain("Inspect TemplateLabel");
    expect(html).toContain("Example template, not a verified row");
    expect(html).not.toContain("Template only — runtime records unavailable");
  });
});
