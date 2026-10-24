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

  it("uses known App and Self symbols when clipping a nested host", () => {
    const responsive = renderHost("=If(App.Width > 720, Self.Width / 10, 2)");
    expect(responsive).toMatch(/<clipPath[^>]*><path d="M 20 20 H 110/);
    expect(responsive).toContain("Local fixture");
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


function renderSourceOnlyGalleryGuide(variant: "Vertical" | "Horizontal", laterSibling = false) {
  const templateLabel = control("PrivateRow", "Classic/Label@2.5.1", {
    Text: '="Not a verified row"', Width: "=100", Height: "=20"
  });
  const gallery = control("SourceGallery", "Classic/Gallery@2.3.0", {
    X: "=20", Y: "=30", Width: "=600", Height: "=300",
    Items: "=RemoteTable", WrapCount: "=3",
    TemplateSize: "=292", TemplatePadding: "=8"
  }, [templateLabel]);
  gallery.variant = variant;
  const screen: CanvasScreen = {
    id: "Fixture", name: "Fixture", properties: {},
    children: laterSibling ? [gallery, control("OverlaySibling", "Classic/Label@2.5.1", {
      X: "=20", Y: "=30", Width: "=600", Height: "=300", Text: '="Later sibling"'
    })] : [gallery],
    sourceFile: "Src/Fixture.pa.yaml", sourceFormat: "pa-yaml-v3"
  };
  return renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
}

describe("CanvasPreview source-only gallery guide clipping", () => {
  it("clips the template guide to the gallery instead of spilling into siblings", () => {
    const html = renderSourceOnlyGalleryGuide("Vertical");
    expect(html).toMatch(/<g[^>]*clip-path="url\(#[^"]+-bounds-0\)"/);
    expect(html).toContain('x="228" y="38" width="184" height="276"');
    expect(html).toContain("Template only — runtime records unavailable");
    expect(html).not.toContain("Not a verified row");
    expect(html).not.toContain("Inspect PrivateRow");
  });

  it("paints the gallery guide before later overlapping siblings", () => {
    const html = renderSourceOnlyGalleryGuide("Vertical", true);
    const guide = html.indexOf("Template only — runtime records unavailable");
    const sibling = html.indexOf('aria-label="Inspect OverlaySibling');
    expect(guide).toBeGreaterThan(0);
    expect(sibling).toBeGreaterThan(guide);
  });

  it("draws horizontal gallery WrapCount guide slots vertically", () => {
    const html = renderSourceOnlyGalleryGuide("Horizontal");
    expect(html).toContain('x="28" y="138" width="276" height="84"');
    expect(html).toContain('x="28" y="238" width="276" height="84"');
    expect(html).not.toContain("Inspect PrivateRow");
  });
});


function renderUnresolvedVisibility(visible: string, childText = "Synthetic protected content") {
  const child = control("ConditionalChild", "Classic/Label@2.5.1", {
    X: "=5", Y: "=5", Width: "=180", Height: "=30", Text: '="' + childText + '"'
  });
  const host = control("ConditionalHost", "GroupContainer@1.3.0", {
    X: "=20", Y: "=20", Width: "=280", Height: "=120", Visible: visible
  }, [child]);
  const screen: CanvasScreen = {
    id: "SafeFixture", name: "SafeFixture", properties: {}, children: [host],
    sourceFile: "Src/SafeFixture.pa.yaml", sourceFormat: "pa-yaml-v3"
  };
  return renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
}

describe("CanvasPreview unresolved ancestor visibility", () => {
  it("keeps an unknown parent inspectable without exposing its descendants", () => {
    const html = renderUnresolvedVisibility("=varHasPermission");
    expect(html).toContain("Inspect ConditionalHost");
    expect(html).toContain("Visible unknown");
    expect(html).toContain("runtime condition unavailable");
    expect(html).not.toContain("Inspect ConditionalChild");
    expect(html).not.toContain("Synthetic protected content");
  });

  it("renders known-visible descendants and omits known-hidden parents", () => {
    const visible = renderUnresolvedVisibility("=true");
    expect(visible).toContain("Inspect ConditionalChild");
    expect(visible).toContain("Synthetic protected content");
    expect(visible).not.toContain("Visible unknown");

    const hidden = renderUnresolvedVisibility("=false");
    expect(hidden).not.toContain("Inspect ConditionalHost");
    expect(hidden).not.toContain("Inspect ConditionalChild");
  });

  it("resolves viewport-only visibility without treating unknown variables as true", () => {
    expect(renderUnresolvedVisibility("=App.Width > 720"))
      .toContain("Inspect ConditionalChild");
    expect(renderUnresolvedVisibility("=varHasPermission && App.Width > 720"))
      .not.toContain("Inspect ConditionalChild");
  });

  it("does not show gallery template guides behind unresolved Visible", () => {
    const gallery = control("ConditionalGallery", "Classic/VerticalGallery@2.3.0", {
      X: "=10", Y: "=10", Width: "=420", Height: "=240",
      Visible: "=varCanRead", Items: "=RemoteRecords",
      TemplateSize: "=100", WrapCount: "=2"
    }, [control("TemplateChild", "Classic/Label@2.5.1", {
      Text: '="Not a verified record"'
    })]);
    const screen: CanvasScreen = {
      id: "GalleryFixture", name: "GalleryFixture", properties: {}, children: [gallery],
      sourceFile: "Src/GalleryFixture.pa.yaml", sourceFormat: "pa-yaml-v3"
    };
    const html = renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
    expect(html).toContain("Inspect ConditionalGallery");
    expect(html).toContain("Visible unknown");
    expect(html).not.toContain("Template only — runtime records unavailable");
    expect(html).not.toContain("Inspect TemplateChild");
  });
});


function renderOverflowHost(axis: "horizontal" | "vertical", overflow: string, laterSibling = false) {
  const children = ["First", "Second"].map(name => control(name, "Classic/Label@2.5.1", {
    Width: axis === "horizontal" ? "=80" : "=100",
    Height: axis === "vertical" ? "=80" : "=60",
    Text: '="Synthetic content"'
  }));
  const host = control("OverflowHost", "GroupContainer@1.3.0", {
    X: "=20", Y: "=30", Width: "=100", Height: "=100",
    LayoutDirection: axis === "horizontal" ? "=LayoutDirection.Horizontal" : "=LayoutDirection.Vertical",
    [axis === "horizontal" ? "LayoutOverflowX" : "LayoutOverflowY"]: overflow
  }, children);
  host.variant = "AutoLayout";
  const screen: CanvasScreen = {
    id: "OverflowFixture", name: "OverflowFixture", properties: {},
    children: laterSibling ? [host, control("OverlaySibling", "Classic/Label@2.5.1", {
      X: "=20", Y: "=30", Width: "=100", Height: "=100", Text: '="Later sibling"'
    })] : [host],
    sourceFile: "Src/OverflowFixture.pa.yaml", sourceFormat: "pa-yaml-v3"
  };
  return renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
}

describe("CanvasPreview local-only container scrolling", () => {
  it("shows a vertical scroll affordance only for proven overflow", () => {
    const html = renderOverflowHost("vertical", "=LayoutOverflow.Scroll");
    expect(html).toContain('data-preview-scrollbar="vertical"');
    expect(html).toContain("Wheel scrolling is local to this preview");
    expect(html).toContain("Inspect First");
    expect(html).toContain("Inspect Second");
  });

  it("paints the scrollbar above its children but below a later sibling", () => {
    const html = renderOverflowHost("vertical", "=LayoutOverflow.Scroll", true);
    const child = html.indexOf('aria-label="Inspect Second');
    const scrollbar = html.indexOf('data-preview-scrollbar="vertical"');
    const sibling = html.indexOf('aria-label="Inspect OverlaySibling');
    expect(child).toBeGreaterThan(0);
    expect(scrollbar).toBeGreaterThan(child);
    expect(sibling).toBeGreaterThan(scrollbar);
  });

  it("shows horizontal scroll affordance for a horizontal layout", () => {
    const html = renderOverflowHost("horizontal", "=LayoutOverflow.Scroll");
    expect(html).toContain('data-preview-scrollbar="horizontal"');
    expect(html).not.toContain('data-preview-scrollbar="vertical"');
  });

  it("does not fabricate scrollability for Hide or dynamic Power Fx", () => {
    expect(renderOverflowHost("vertical", "=LayoutOverflow.Hide"))
      .not.toContain('data-preview-scrollbar="vertical"');
    expect(renderOverflowHost("vertical", "=If(flag, LayoutOverflow.Scroll, LayoutOverflow.Hide)"))
      .not.toContain('data-preview-scrollbar="vertical"');
  });
});
