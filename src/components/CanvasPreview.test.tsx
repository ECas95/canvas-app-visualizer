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

  it("does not invent a row when Items was omitted from the serialized source", () => {
    const html = renderGalleryItems();
    expect(html).toContain("Inspect DataGallery");
    expect(html).toContain("Template only — runtime records unavailable");
    expect(html).not.toContain("Inspect TemplateLabel");
    expect(html).not.toContain("Example template, not a verified row");
    expect(html).toContain("Cannot determine loading, emptiness or access from source");
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

  it("uses verified viewport symbols for responsive overflow in the renderer", () => {
    expect(renderOverflowHost("vertical",
      "=If(App.Width > 720, LayoutOverflow.Scroll, LayoutOverflow.Hide)"))
      .toContain('data-preview-scrollbar="vertical"');
    expect(renderOverflowHost("vertical",
      "=If(App.Width < 720, LayoutOverflow.Scroll, LayoutOverflow.Hide)"))
      .not.toContain('data-preview-scrollbar="vertical"');
  });

  it("does not fabricate scrollability for Hide or dynamic Power Fx", () => {
    expect(renderOverflowHost("vertical", "=LayoutOverflow.Hide"))
      .not.toContain('data-preview-scrollbar="vertical"');
    expect(renderOverflowHost("vertical", "=If(flag, LayoutOverflow.Scroll, LayoutOverflow.Hide)"))
      .not.toContain('data-preview-scrollbar="vertical"');
  });
});

describe("CanvasPreview loaded gallery count uncertainty", () => {
  it("withholds conditional descendants when AllItemsCount is only known at runtime", () => {
    const conditional = control("LoadedCountStatus", "GroupContainer@1.3.0", {
      X: "=20", Y: "=30", Width: "=280", Height: "=80",
      Visible: "=If(galCatalog.AllItemsCount = 0, true, false)"
    }, [control("SensitiveChild", "Classic/Label@2.5.1", {
      Text: '="Synthetic only"', Width: "=160", Height: "=24"
    })]);
    const screen: CanvasScreen = {
      id: "LoadedCountFixture", name: "LoadedCountFixture", properties: {},
      children: [conditional], sourceFile: "Src/LoadedCountFixture.pa.yaml",
      sourceFormat: "pa-yaml-v3"
    };
    const html = renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
    expect(html).toContain("Inspect LoadedCountStatus");
    expect(html).toContain("Gallery state unknown");
    expect(html).toContain("not an empty result");
    expect(html).not.toContain("Inspect SensitiveChild");
    expect(html).not.toContain("Synthetic only");
  });
});


function renderScopedGallery(parentWidth: number): string {
  const gallery = control("ScopedGallery", "Classic/Gallery@2.3.0", {
    X: "=20", Y: "=20", Width: "=Parent.Width / 2", Height: "=200",
    Items: "=RemoteRecords",
    WrapCount: "=If(Parent.Width > 600, 2, 1)",
    TemplateSize: "=Parent.Width / 4",
    TemplatePadding: "=If(Parent.Width > 600, 12, 4)"
  }, [control("UnverifiedTemplateChild", "Classic/Label@2.5.1", {
    Text: '="No verified row"', Width: "=100", Height: "=20"
  })]);
  gallery.variant = "Vertical";
  const parent = control("OuterContainer", "GroupContainer@1.3.0", {
    X: "=30", Y: "=40", Width: `=${parentWidth}`, Height: "=400"
  }, [gallery]);
  const screen: CanvasScreen = {
    id: "ScopedFixture", name: "ScopedFixture", properties: {},
    children: [parent], sourceFile: "Src/ScopedFixture.pa.yaml",
    sourceFormat: "pa-yaml-v3"
  };
  return renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
}

describe("CanvasPreview gallery guide formula scope", () => {
  it("uses the actual parent width for WrapCount, TemplateSize and padding", () => {
    // Outer width=800; gallery viewport width=400. The guide must use 800
    // for Parent.Width, yielding 2 columns, 200px templates and 12px padding.
    // Using gallery viewport width would incorrectly yield only 1 column.
    const html = renderScopedGallery(800);
    expect(html).toContain("Inspect ScopedGallery");
    expect(html).toContain('x="262" y="72" width="176" height="176"');
    expect(html).toContain("Template only — runtime records unavailable");
    expect(html).not.toContain("Inspect UnverifiedTemplateChild");
    expect(html).not.toContain("No verified row");
  });

  it("re-evaluates nested gallery geometry for a narrower parent without inventing rows", () => {
    // Parent.Width=500 selects WrapCount=1, TemplateSize=125, Padding=4.
    // A single-column gallery has no additional guide slot.
    const html = renderScopedGallery(500);
    expect(html).toContain("Inspect ScopedGallery");
    expect(html).not.toContain('x="262" y="72" width="176" height="176"');
    expect(html).toContain("Template only — runtime records unavailable");
    expect(html).not.toContain("Inspect UnverifiedTemplateChild");
  });
});


describe("CanvasPreview trailing padding scroll integration", () => {
  function renderPaddedHost(paddingBottom: string) {
    const host = control("PaddedHost", "GroupContainer@1.3.0", {
      X: "=20", Y: "=30", Width: "=100", Height: "=100",
      LayoutDirection: "=LayoutDirection.Vertical",
      LayoutOverflowY: "=LayoutOverflow.Scroll",
      PaddingBottom: paddingBottom
    }, [control("PaddedChild", "Classic/Label@2.5.1", {
      Width: "=100", Height: "=90", Text: '="Synthetic local content"'
    })]);
    host.variant = "AutoLayout";
    const screen: CanvasScreen = {
      id: "PaddingFixture", name: "PaddingFixture", properties: {},
      children: [host], sourceFile: "Src/PaddingFixture.pa.yaml",
      sourceFormat: "pa-yaml-v3"
    };
    return renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
  }

  it("shows a scroll indicator when verified trailing padding extends the content", () => {
    const html = renderPaddedHost("=20");
    expect(html).toContain('data-preview-scrollbar="vertical"');
    expect(html).toContain("Inspect PaddedChild");
    expect(html).toContain("Synthetic local content");
  });

  it("does not claim scrollability when padding is absent or runtime-dependent", () => {
    expect(renderPaddedHost("=0")).not.toContain('data-preview-scrollbar="vertical"');
    expect(renderPaddedHost("=varUnknownPadding"))
      .not.toContain('data-preview-scrollbar="vertical"');
  });
});

function renderEditorGroupOverflow(childHeight: number) {
  const child = control("ActualChild", "Classic/Label@2.5.1", {
    X: "=0", Y: "=0", Width: "=100", Height: "=" + childHeight,
    Text: '="Synthetic group child"'
  });
  const editorGroup = control("EditorGroup", "Group", {
    X: "=0", Y: "=0", Width: "=600", Height: "=400"
  }, [child]);
  const host = control("ScrollHost", "GroupContainer@1.3.0", {
    X: "=0", Y: "=0", Width: "=200", Height: "=100",
    LayoutOverflowY: "=LayoutOverflow.Scroll"
  }, [editorGroup]);
  const screen: CanvasScreen = {
    id: "GroupFixture", name: "GroupFixture", properties: {}, children: [host],
    sourceFile: "Src/GroupFixture.pa.yaml", sourceFormat: "pa-yaml-v3"
  };
  return renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
}

describe("CanvasPreview editor Group scroll geometry", () => {
  it("ignores the editor Group box when real content fits the host", () => {
    const html = renderEditorGroupOverflow(90);
    expect(html).toContain("Synthetic group child");
    expect(html).not.toContain('data-preview-scrollbar="vertical"');
  });

  it("scrolls the host when a grouped child genuinely exceeds its bounds", () => {
    const html = renderEditorGroupOverflow(180);
    expect(html).toContain("Synthetic group child");
    expect(html).toContain('data-preview-scrollbar="vertical"');
  });
});

describe("CanvasPreview unverified gallery template geometry", () => {
  function renderUnverifiedTemplate(parentWidth: number, overrides: Record<string, unknown> = {}) {
    const templateLabel = control("UnverifiedRow", "Classic/Label@2.5.1", {
      Text: '="Source template is not a runtime record"'
    });
    const gallery = control("UnknownTemplate", "Classic/VerticalGallery@2.3.0", {
      X: "=0", Y: "=0", Width: "=Parent.Width", Height: "=320",
      Items: "=RemoteSource", WrapCount: "=If(varAuthorized, 3, 1)",
      TemplateSize: "=292", TemplatePadding: "=8", ...overrides
    }, [templateLabel]);
    const host = control("ViewportHost", "GroupContainer@1.3.0", {
      X: "=0", Y: "=0", Width: `=${parentWidth}`, Height: "=400"
    }, [gallery]);
    const screen: CanvasScreen = {
      id: "UnknownTemplateFixture", name: "UnknownTemplateFixture",
      properties: {}, children: [host],
      sourceFile: "Src/Synthetic.pa.yaml", sourceFormat: "pa-yaml-v3"
    };
    return renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
  }

  it.each([320, 768, 1366])(
    "withholds guessed template slots at %ipx parent width when WrapCount is runtime-dependent",
    width => {
      const html = renderUnverifiedTemplate(width);
      expect(html).toContain("Inspect UnknownTemplate");
      expect(html).toContain("Template geometry unknown — runtime formula or missing defaults");
      expect(html).not.toContain("Template only — runtime records unavailable");
      expect(html).not.toContain('stroke-dasharray="6 5"');
      expect(html).not.toContain("Inspect UnverifiedRow");
      expect(html).not.toContain("Source template is not a runtime record");
      expect(html).toContain("Cannot determine loading, emptiness or access from source");
    }
  );

  it("does not claim a fixed template when TemplateSize or TemplatePadding is unresolved", () => {
    const html = renderUnverifiedTemplate(768, {
      WrapCount: "=2", TemplateSize: "=varTemplateHeight",
      TemplatePadding: "=varTemplatePadding"
    });
    expect(html).toContain("Template geometry unknown — runtime formula or missing defaults");
    expect(html).not.toContain('stroke-dasharray="6 5"');
  });

  it("keeps guides for verified viewport-only Power Fx template geometry", () => {
    const html = renderUnverifiedTemplate(600, {
      WrapCount: "=If(App.Width > 720, 3, 1)",
      TemplateSize: "=If(App.Width > 720, 292, 180)",
      TemplatePadding: "=8"
    });
    expect(html).toContain("Template only — runtime records unavailable");
    expect(html).toContain('stroke-dasharray="6 5"');
    expect(html).not.toContain("Template geometry unknown");
    expect(html).not.toContain("Inspect UnverifiedRow");
  });
});
