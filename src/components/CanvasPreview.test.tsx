import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl, CanvasScreen } from "../types/canvas";
import { CanvasPreview } from "./CanvasPreview";
import { PREVIEW_ICON_PATHS } from "../core/layout/previewIcon";

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
    expect(html).toMatch(/<clipPath[^>]*><path d="M 22 20 H 110 L 110 20/);
    expect(html).toContain("A 6 6 0 0 1 104 60");
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

describe("CanvasPreview opt-in synthetic gallery cards", () => {
  it("uses real YAML template controls and clearly bracketed ThisItem placeholders", () => {
    const caption = control("TemplateName", "Classic/Label@2.5.1", {
      Text: "=ThisItem.Name", X: "=16", Y: "=36", Width: "=140", Height: "=32"
    });
    const container = control("Card", "GroupContainer@1.5.0", {
      X: "=8", Y: "=8", Width: "=Parent.TemplateWidth - 16",
      Height: "=Parent.TemplateHeight - 16",
      Fill: "=RGBA(255,255,255,1)"
    }, [caption, control("HiddenTemplateLabel", "Classic/Label@2.5.1", {
      Text: '="Should stay hidden"', Visible: "=false",
      X: "=16", Y: "=80", Width: "=140", Height: "=32"
    })]);
    const gallery = control("Gallery", "Gallery@2.15.0", {
      X: "=24", Y: "=100", Width: "=1200", Height: "=580",
      TemplateSize: "=292", TemplatePadding: "=8", WrapCount: "=3",
      Items: "=Filter(colUnknown, IsEnabled)", Visible: "=varReady"
    }, [container]);
    gallery.variant = "Vertical";
    const screen: CanvasScreen = {
      id: "Demo", name: "Demo", properties: {}, children: [gallery],
      sourceFile: "Src/Demo.pa.yaml", sourceFormat: "pa-yaml-v3"
    };
    const original = renderToStaticMarkup(<CanvasPreview screen={screen} onSelect={() => {}} />);
    expect(original).not.toContain('data-preview-gallery-samples="synthetic"');
    expect(original).toContain("Visible unknown");
    const shown = renderToStaticMarkup(<CanvasPreview screen={screen}
      initialGallerySamples={true} onSelect={() => {}} />);
    expect(shown).toContain('data-preview-gallery-samples="synthetic"');
    expect(shown).toContain('data-sample-card="6"');
    expect(shown).toContain("TemplateName");
    expect(shown).toContain("[Name #1]");
    expect(shown).toContain("[Name #6]");
    expect(shown).not.toContain("HiddenTemplateLabel");
    expect(shown).not.toContain("Should stay hidden");
    expect(shown).toContain("no database rows or access verified");
    expect(shown).not.toContain("AVAILABLE");
  });
});

describe("CanvasPreview local JSON gallery record preview", () => {
  it("uses typed row values in the original template without certifying SQL access", () => {
    const field = control("RecordName", "Classic/Label@2.5.1", {
      Text: "=ThisItem.Name", X: "=12", Y: "=12", Width: "=300", Height: "=30"
    });
    const state = control("RecordState", "Classic/Label@2.5.1", {
      Text: '=If(ThisItem.IsEnabled, "AVAILABLE", "UNAVAILABLE")',
      X: "=12", Y: "=46", Width: "=140", Height: "=30",
      Color: "=ThisItem.AccentColor"
    });
    const gallery = control("SampleGallery", "Gallery@2.15.0", {
      X: "=10", Y: "=30", Width: "=600", Height: "=300",
      TemplateSize: "=150", TemplatePadding: "=8", WrapCount: "=2",
      Items: "=SQLModuleCatalog", Visible: "=varReady"
    }, [field, state]);
    gallery.variant = "Vertical";
    const screen: CanvasScreen = {
      id: "Local", name: "Local", properties: {}, children: [gallery],
      sourceFile: "Src/Local.pa.yaml", sourceFormat: "pa-yaml-v3"
    };
    const html = renderToStaticMarkup(<CanvasPreview screen={screen}
      initialGallerySamples={true}
      initialGallerySnapshot={{ galleryId: "SampleGallery", rows: [
        { Name: "Local Preview One", IsEnabled: true, AccentColor: "#006064" },
        { Name: "Local Preview Two", IsEnabled: false, AccentColor: "#808080" }
      ] }}
      onSelect={() => {}} />);
    expect(html).toContain('data-preview-gallery-samples="local-snapshot"');
    expect(html).toContain("Local Preview One");
    expect(html).toContain("Local Preview Two");
    expect(html).toContain("AVAILABLE");
    expect(html).toContain("UNAVAILABLE");
    expect(html).toContain("LOCAL #1");
    expect(html).toContain("LOCAL #2");
    expect(html).not.toContain("[Name #1]");
    expect(html).not.toContain("LOCAL #3");
    expect(html).toContain("user-provided visual records");
    expect(html).toContain("runtime Gallery.Items and access are not verified");
    expect(html).toContain('aria-label="Load local gallery JSON records"');
  });
});

describe("CanvasPreview Gallery local row visual fidelity", () => {
  it("paints verified per-record TemplateFill and icons without inventing SQL rows", () => {
    const icon = control("ModuleIcon", "Classic/Icon@2.5.0", {
      Icon: '=Switch(ThisItem.Category, "Operations", Icon.Settings, "Reporting", Icon.Document, Icon.Information)',
      X: "=20", Y: "=22", Width: "=42", Height: "=42"
    });
    const label = control("ModuleLabel", "Classic/Label@2.5.1", {
      Text: "=ThisItem.Name", X: "=72", Y: "=22", Width: "=230", Height: "=42"
    });
    const gallery = control("Cards", "Classic/VerticalGallery@2.3.0", {
      X: "=24", Y: "=90", Width: "=800", Height: "=360",
      Items: "=SQLCatalog", TemplateSize: "=180", WrapCount: "=2",
      TemplateFill: "=If(ThisItem.IsEnabled, Color.Green, Color.Red)"
    }, [icon, label]);
    gallery.variant = "Vertical";
    const screen: CanvasScreen = {
      id: "Modules", name: "Modules", properties: {}, children: [gallery],
      sourceFile: "Src/Modules.pa.yaml", sourceFormat: "pa-yaml-v3"
    };
    const local = renderToStaticMarkup(<CanvasPreview
      screen={screen} initialGallerySamples={true}
      initialGallerySnapshot={{ galleryId: "Cards", rows: [
        { Name: "Module A", Category: "Operations", IsEnabled: true },
        { Name: "Module B", Category: "Reporting", IsEnabled: false }
      ] }} onSelect={() => {}} />);
    expect(local).toContain('data-preview-gallery-samples="local-snapshot"');
    expect(local).toContain('data-preview-gallery-template-fill="verified"');
    expect(local).toContain('fill="#008000"');
    expect(local).toContain('fill="#ff0000"');
    expect(local).toContain('d="' + PREVIEW_ICON_PATHS.settings + '"');
    expect(local).toContain('d="' + PREVIEW_ICON_PATHS.document + '"');
    expect(local).toContain("Module A");
    expect(local).toContain("Module B");
    expect(local).not.toContain("LOCAL #3");
    expect(local).toContain("runtime Gallery.Items and access are not verified");

    const synthetic = renderToStaticMarkup(<CanvasPreview
      screen={screen} initialGallerySamples={true} onSelect={() => {}} />);
    expect(synthetic).toContain('data-template-fill-state="unknown"');
    expect(synthetic).not.toContain('data-preview-gallery-template-fill="verified"');
    expect(synthetic).not.toContain("Module A");

    const sourceOnly = renderToStaticMarkup(<CanvasPreview
      screen={screen} onSelect={() => {}} />);
    expect(sourceOnly).not.toContain('data-preview-gallery-template-fill="verified"');
    expect(sourceOnly).not.toContain('data-sample-card="1"');
  });
});

describe("CanvasPreview gallery source vs runtime rows", () => {
  it("does not turn a SQL Items formula into a visible template row", () => {
    const html = renderGalleryItems("=Filter(Modules, IsEnabled)");
    expect(html).toContain("Inspect DataGallery");
    expect(html).toContain('data-preview-gallery-records="unknown"');
    expect(html).toContain("Runtime gallery records unavailable");
    expect(html).toContain("Loading, emptiness and permissions are not verified");
    expect(html).not.toContain("Template only — runtime records unavailable");
    expect(html).not.toContain("Inspect TemplateLabel");
    expect(html).not.toContain("Example template, not a verified row");
  });

  it("does not treat a source-only Table expression as an explicit verified snapshot", () => {
    const html = renderGalleryItems('=Table({Title: "Demo"})');
    expect(html).toContain('data-preview-gallery-records="unknown"');
    expect(html).toContain("Runtime gallery records unavailable");
    expect(html).toContain("Loading, emptiness and permissions are not verified");
    expect(html).not.toContain("Template only — runtime records unavailable");
    expect(html).not.toContain("Inspect TemplateLabel");
  });

  it("does not paint three phantom record cards for a source-only WrapCount=3", () => {
    const html = renderGalleryItems("=Filter(SQLModules, IsEnabled)");
    expect(html).toContain('data-preview-gallery-records="unknown"');
    expect(html).toContain("Gallery rows unavailable — use Structure for template geometry");
    expect(html).not.toContain("Template only — runtime records unavailable");
    expect(html).not.toContain('stroke-dasharray="6 5"');
    expect(html).not.toContain("Inspect TemplateLabel");
    expect(html).not.toContain("Example template, not a verified row");
  });

  it("does not invent a row when Items was omitted from the serialized source", () => {
    const html = renderGalleryItems();
    expect(html).toContain("Inspect DataGallery");
    expect(html).toContain('data-preview-gallery-records="unknown"');
    expect(html).toContain("Runtime gallery records unavailable");
    expect(html).toContain("Loading, emptiness and permissions are not verified");
    expect(html).not.toContain("Template only — runtime records unavailable");
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
  return renderToStaticMarkup(<CanvasPreview screen={screen} initialMode="structure" onSelect={() => {}} />);
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
  return renderToStaticMarkup(<CanvasPreview screen={screen} initialMode="structure" onSelect={() => {}} />);
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
    return renderToStaticMarkup(<CanvasPreview screen={screen} initialMode="structure" onSelect={() => {}} />);
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

describe("CanvasPreview SVG title compatibility", () => {
  it("uses a single React-compatible title child for source-only controls", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const html = renderGalleryItems("=Filter(RemoteModules, IsEnabled)");
      expect(html).toContain("<title>DataGallery · Classic/VerticalGallery@2.3.0</title>");
      expect(errorSpy.mock.calls.flat().join(" ")).not.toContain(
        "React expects the `children` prop of <title>"
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("retains unresolved visibility and AllItems qualifiers without React title warnings", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const html = renderGalleryCondition("=IsEmpty(galCatalog.AllItems)");
      expect(html).toContain(
        "<title>GalleryStatus · GroupContainer@1.3.0 · runtime visibility not verified · AllItems unavailable; content intentionally withheld</title>"
      );
      expect(errorSpy.mock.calls.flat().join(" ")).not.toContain(
        "React expects the `children` prop of <title>"
      );
      expect(html).not.toContain("Synthetic child text");
    } finally {
      errorSpy.mockRestore();
    }
  });
});
