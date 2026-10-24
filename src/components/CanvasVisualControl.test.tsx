import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { CanvasVisualControl } from "./CanvasVisualControl";
import { buildCanvasModel } from "../core/model/normalize";

function label(properties: Record<string, unknown>): CanvasControl {
  return {
    id: "synthetic-label", name: "SyntheticLabel",
    controlType: "Classic/Label@2.5.1", properties, children: [],
    sourceFile: "Src/Synthetic.pa.yaml", sourcePath: "Screens/Synthetic/SyntheticLabel",
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
}

function render(properties: Record<string, unknown>, symbols?: Record<string, string | number | boolean>) {
  return renderToStaticMarkup(
    <CanvasVisualControl control={label(properties)} x={10} y={20}
      width={140} height={64} clipId="test-label-clip" simulationSymbols={symbols} />
  );
}

describe("Microsoft ModernText .pa.yaml rendering", () => {
  it("renders the documented ModernText family as text with wrapped content", () => {
    const yaml = [
      "Screens:",
      "  Synthetic:",
      "    Children:",
      "      - ModernHeading:",
      "          Control: ModernText@1.0.0",
      "          Properties:",
      '            Text: ="Modern heading with wrapping"',
      "            Wrap: =true",
      "            Width: =140",
      "            Height: =64"
    ].join("\n");
    const model = buildCanvasModel([{
      path: "Src/SyntheticModernText.pa.yaml", name: "SyntheticModernText.pa.yaml",
      content: yaml, origin: "yaml", format: "pa-yaml-v3"
    }], "yaml");
    const control = model.screens[0].children[0];
    expect(control.controlType).toBe("ModernText@1.0.0");
    const html = renderToStaticMarkup(<svg><CanvasVisualControl
      control={control} x={10} y={20} width={140} height={64}
      clipId="modern-text-clip" /></svg>);
    expect(html).toContain("<foreignObject");
    expect(html).toContain("Modern heading with wrapping");
    expect(html).toContain("font-size:15px");
    expect(html).not.toContain("ModernHeading</tspan>");
  });

  it("keeps explicit modern text sizing and does not invent unresolved text", () => {
    const control: CanvasControl = {
      ...label({ Text: "=varSqlTitle", Size: "=22", Wrap: "=false" }),
      controlType: "ModernText@1.0.0"
    };
    const unknown = renderToStaticMarkup(<svg><CanvasVisualControl
      control={control} x={10} y={20} width={140} height={64}
      clipId="modern-text-unknown" /></svg>);
    expect(unknown).not.toContain("varSqlTitle");
    expect(unknown).not.toContain("SyntheticLabel</tspan>");
    const known = renderToStaticMarkup(<svg><CanvasVisualControl
      control={{ ...control, properties: { Text: '="Verified title"', Size: "=22", Wrap: "=false" } }}
      x={10} y={20} width={140} height={64}
      clipId="modern-text-known" /></svg>);
    expect(known).toContain("Verified title");
    expect(known).toContain('font-size="22"');
  });
});

describe("source-faithful Canvas label wrapping", () => {
  it("uses the same source Font family in SVG and wrapped HTML labels", () => {
    const props = { Text: '="Font sample"', Font: "=Font.Arial" };
    const singleLine = render({ ...props, Wrap: "=false" });
    const wrapped = render({ ...props, Wrap: "=true" });
    expect(singleLine).toContain('font-family="Arial,sans-serif"');
    expect(wrapped).toContain("font-family:Arial,sans-serif");
    expect(wrapped).toContain("<foreignObject");
  });

  it("does not treat an unknown runtime Font as a verified font", () => {
    const html = render({ Text: '="Safe"', Font: "=varUserFont", Wrap: "=true" });
    expect(html).toContain("font-family:&quot;Segoe UI&quot;,system-ui,sans-serif");
  });

  it("wraps only when the serialized Wrap property resolves true", () => {
    const html = render({
      Text: '="A label with enough words to wrap across several lines"',
      Wrap: "=true"
    });
    expect(html).toContain("<foreignObject");
    expect(html).toContain("white-space:pre-wrap");
    expect(html).toContain("overflow-wrap:break-word");
    expect(html).toContain("A label with enough words");
  });

  it("preserves single-line SVG behavior for false and unresolved Wrap", () => {
    const base = { Text: '="Source label"' };
    expect(render({ ...base, Wrap: "=false" })).not.toContain("<foreignObject");
    expect(render({ ...base, Wrap: "=varRuntimeWrap" })).not.toContain("<foreignObject");
    expect(render(base)).not.toContain("<foreignObject");
    expect(render({ ...base, Wrap: "=false" })).toContain("<text");
  });

  it("reacts to known viewport dimensions without inventing runtime variables", () => {
    const properties = {
      Text: '="Responsive heading with wrapping"',
      Wrap: "=App.Width < 720",
      Size: "=If(App.Width < 720, 20, 24)"
    };
    const phone = render(properties, { "App.Width": 390 });
    const desktop = render(properties, { "App.Width": 1366 });
    expect(phone).toContain("<foreignObject");
    expect(phone).toContain("font-size:20px");
    expect(desktop).not.toContain("<foreignObject");
    expect(desktop).toContain('font-size="24"');
  });

  it("uses known source padding and text alignment for wrapped labels", () => {
    const html = render({
      Text: '="Aligned"', Wrap: "=true",
      Align: "=Align.Right", VerticalAlign: "=VerticalAlign.Bottom",
      PaddingTop: "=3", PaddingRight: "=6",
      PaddingBottom: "=7", PaddingLeft: "=12"
    });
    expect(html).toContain("padding-top:3px");
    expect(html).toContain("padding-right:6px");
    expect(html).toContain("padding-bottom:7px");
    expect(html).toContain("padding-left:12px");
    expect(html).toContain("align-items:flex-end");
    expect(html).toContain("text-align:right");
  });

  it("justifies wrapped text from the documented Align.Justify enum", () => {
    const html = render({
      Text: '="A paragraph of text with multiple words to justify"',
      Wrap: "=true", Align: "=Align.Justify", FontWeight: "=FontWeight.Lighter"
    });
    expect(html).toContain("text-align:justify");
    expect(html).toContain("font-weight:300");
  });

  it("keeps SVG text on a valid anchor when justification cannot be measured", () => {
    const html = render({
      Text: '="No browser wrapping"', Wrap: "=false", Align: "=Align.Justify"
    });
    expect(html).toContain('text-anchor="start"');
    expect(html).not.toContain('text-anchor="justify"');
    expect(html).not.toContain("<foreignObject");
  });

  it("does not render unrelated Power Fx members as verified text alignment", () => {
    const html = render({ Text: '="Unverified"', Align: "=User.Right" });
    expect(html).toMatch(/<text[^>]* x="15\.6/);
    expect(html).not.toContain('text-anchor="end"');
  });

  it("keeps unresolved data-source text absent and never synthesizes gallery rows", () => {
    const html = render({ Text: "=ThisItem.Name", Wrap: "=true" });
    expect(html).not.toContain("<foreignObject");
    expect(html).not.toContain("ThisItem.Name");
  });

  it("escapes imported label text instead of interpreting it as HTML", () => {
    const html = render({ Text: '="A <script>alert(1)</script> & B"', Wrap: "=true" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; B");
  });

  it("does not cut normal wrapped text at the old 240-character limit", () => {
    const text = "W".repeat(300);
    const html = render({ Text: '="' + text + '"', Wrap: "=true" });
    expect(html).toContain(text);
  });
  it("renders source-declared dashed borders without affecting text", () => {
    const html = render({
      Text: '="Outline"', Fill: "=Color.White", BorderColor: "=Color.Red",
      BorderThickness: "=2", BorderStyle: "=BorderStyle.Dashed"
    });
    expect(html).toContain('stroke-dasharray="6 4"');
    expect(html).toContain('stroke-width="2"');
    expect(html).toContain("Outline");
  });

  it("renders dotted borders with round caps", () => {
    const html = render({
      Text: '="Dotted"', Fill: "=Color.White", BorderColor: "=Color.Red",
      BorderThickness: "=2", BorderStyle: "=BorderStyle.Dotted"
    });
    expect(html).toContain('stroke-dasharray="0 4"');
    expect(html).toContain('stroke-linecap="round"');
  });

  it("suppresses explicit borders when BorderStyle.None is serialized", () => {
    const html = render({
      Text: '="No border"', Fill: "=Color.White", BorderColor: "=Color.Red",
      BorderThickness: "=4", BorderStyle: "=BorderStyle.None"
    });
    expect(html).toContain('stroke-width="0"');
    expect(html).not.toContain("stroke-dasharray=");
    expect(html).toContain("No border");
  });

  it("does not guess a runtime-dependent BorderStyle", () => {
    const html = render({
      Text: '="Unknown style"', Fill: "=Color.White", BorderColor: "=Color.Red",
      BorderThickness: "=2", BorderStyle: "=If(varReady, BorderStyle.Dotted, BorderStyle.None)"
    });
    expect(html).toContain('stroke-width="2"');
    expect(html).not.toContain("stroke-dasharray=");
  });

});

function renderContainer(properties: Record<string, unknown>, type = "GroupContainer@1.3.0",
  symbols?: Record<string, string | number | boolean>) {
  return renderToStaticMarkup(
    <CanvasVisualControl
      control={{ ...label(properties), controlType: type, name: "SyntheticContainer" }}
      x={10} y={20} width={140} height={64} clipId="test-container-clip"
      simulationSymbols={symbols}
    />
  );
}

describe("Canvas container DropShadow rendering", () => {
  it("adds a bounded shadow to the source-colored container outline only", () => {
    const html = renderContainer({
      Fill: "=Color.White", DropShadow: "=DropShadow.Regular",
      RadiusTopLeft: "=12", RadiusTopRight: "=0",
      RadiusBottomRight: "=6", RadiusBottomLeft: "=2"
    });
    expect(html).toContain("filter:drop-shadow(");
    expect(html).toContain("M 22 20");
    expect(html.match(/filter:drop-shadow\(/g)).toHaveLength(1);
  });

  it("does not add shadows for None, unknown runtime formulas or absent Fill", () => {
    const props = { Fill: "=Color.White" };
    expect(renderContainer({ ...props, DropShadow: "=DropShadow.None" }))
      .not.toContain("filter:drop-shadow(");
    expect(renderContainer({ ...props, DropShadow: "=varShadow" }))
      .not.toContain("filter:drop-shadow(");
    expect(renderContainer({ DropShadow: "=DropShadow.Bold" }))
      .not.toContain("filter:drop-shadow(");
    expect(renderContainer({ Fill: "=Color.Transparent", DropShadow: "=DropShadow.Bold" }))
      .not.toContain("filter:drop-shadow(");
  });

  it("does not render an opaque shadow for translucent RGBA or ColorValue fills", () => {
    const shadow = { DropShadow: "=DropShadow.Bold" };
    for (const fill of [
      "=RGBA(255,255,255,0)", "=RGBA(255,255,255,0.5)",
      '=ColorValue("#ffffff00")', '=ColorValue("#ffffff80")',
      '=ColorValue("#fff0")'
    ]) {
      expect(renderContainer({ ...shadow, Fill: fill }))
        .not.toContain("filter:drop-shadow(");
    }
  });

  it("retains shadows for verified fully opaque RGBA and alpha-hex fills", () => {
    const shadow = { DropShadow: "=DropShadow.Light" };
    for (const fill of [
      "=RGBA(255,255,255,1)", '=ColorValue("#ffffffff")',
      '=ColorValue("#ffff")', "=Color.White"
    ]) {
      expect(renderContainer({ ...shadow, Fill: fill }))
        .toContain("filter:drop-shadow(");
    }
  });

  it("does not apply container-only DropShadow to labels or galleries", () => {
    const props = { Fill: "=Color.White", DropShadow: "=DropShadow.Bold" };
    expect(render(props)).not.toContain("filter:drop-shadow(");
    expect(renderContainer(props, "Gallery@2.15.0"))
      .not.toContain("filter:drop-shadow(");
  });
});

describe("responsive Canvas outline radii", () => {
  it("uses the same known viewport radius for the SVG outline and text clip", () => {
    const props = {
      Fill: "=Color.White",
      RadiusTopLeft: "=If(App.Width < 720, 12, 0)",
      RadiusTopRight: "=0", RadiusBottomLeft: "=0", RadiusBottomRight: "=0"
    };
    const phone = renderContainer(props, "GroupContainer@1.3.0", { "App.Width": 390 });
    const desktop = renderContainer(props, "GroupContainer@1.3.0", { "App.Width": 1366 });
    expect(phone).toContain('d="M 22 20');
    expect(desktop).toContain('d="M 10 20');
    expect(renderContainer(props)).toContain('d="M 14 20');
  });
});

describe("Canvas multiline SVG text vertical alignment", () => {
  const multiline = { Text: "=LocalText", Size: "=20", Wrap: "=false" };
  const symbols = { LocalText: "First line\nSecond line" };

  it("anchors the first line at Top padding instead of centering the whole block above it", () => {
    const html = render({
      ...multiline, VerticalAlign: "=VerticalAlign.Top", PaddingTop: "=4"
    }, symbols);
    expect(html).toContain("First line");
    expect(html).toContain("Second line");
    expect(html).toMatch(/<text[^>]* y="34"/);
    expect(html).toContain('dy="24"');
  });

  it("anchors the final line above Bottom padding", () => {
    const html = render({
      ...multiline, VerticalAlign: "=VerticalAlign.Bottom", PaddingBottom: "=6"
    }, symbols);
    expect(html).toMatch(/<text[^>]* y="44"/);
    expect(html).toContain('dy="24"');
  });

  it("preserves centered multiline positioning", () => {
    const html = render({
      ...multiline, VerticalAlign: "=VerticalAlign.Middle"
    }, symbols);
    expect(html).toMatch(/<text[^>]* y="40"/);
  });

  it("uses only resolvable viewport padding and never executes runtime-dependent padding", () => {
    const props = {
      ...multiline, VerticalAlign: "=VerticalAlign.Top",
      PaddingTop: "=If(App.Width < 720, 6, 12)"
    };
    expect(render(props, { ...symbols, "App.Width": 390 })).toMatch(/<text[^>]* y="36"/);
    expect(render(props, { ...symbols, "App.Width": 1366 })).toMatch(/<text[^>]* y="42"/);
    expect(render({ ...props, PaddingTop: "=varRuntimePadding" }, symbols))
      .toMatch(/<text[^>]* y="30"/);
  });
});

describe("Canvas SVG text content-box padding", () => {
  it("positions left-aligned text at source PaddingLeft", () => {
    const html = render({
      Text: '="Left"', Align: "=Align.Left", PaddingLeft: "=12"
    });
    expect(html).toMatch(/<text[^>]* x="22"/);
  });

  it("positions right-aligned text inside source PaddingRight", () => {
    const html = render({
      Text: '="Right"', Align: "=Align.Right", PaddingRight: "=18"
    });
    expect(html).toMatch(/<text[^>]* x="132"/);
    expect(html).toContain('text-anchor="end"');
  });

  it("centers text within asymmetric left/right padding", () => {
    const html = render({
      Text: '="Center"', Align: "=Align.Center",
      PaddingLeft: "=10", PaddingRight: "=30"
    });
    expect(html).toMatch(/<text[^>]* x="70"/);
    expect(html).toContain('text-anchor="middle"');
  });

  it("centers the multiline block within asymmetric vertical padding", () => {
    const html = render({
      Text: "=LocalText", Size: "=20", Wrap: "=false",
      VerticalAlign: "=VerticalAlign.Middle",
      PaddingTop: "=10", PaddingBottom: "=2"
    }, { LocalText: "First\nSecond" });
    expect(html).toMatch(/<text[^>]* y="44"/);
    expect(html).toContain('dy="24"');
  });

  it("resolves viewport padding without guessing runtime-dependent values", () => {
    const props = {
      Text: '="Responsive"', Align: "=Align.Left",
      PaddingLeft: "=If(App.Width < 720, 8, 24)"
    };
    expect(render(props, { "App.Width": 390 })).toMatch(/<text[^>]* x="18"/);
    expect(render(props, { "App.Width": 1366 })).toMatch(/<text[^>]* x="34"/);
    expect(render({ ...props, PaddingLeft: "=varRuntimePadding" }))
      .toMatch(/<text[^>]* x="15\.6/);
  });

  it("preserves the independent checkbox label offset", () => {
    const html = renderToStaticMarkup(
      <CanvasVisualControl control={{ ...label({ Text: '="Check"' }),
        controlType: "Classic/CheckBox@2.1.0" }}
        x={10} y={20} width={140} height={64} clipId="checkbox-clip" />
    );
    expect(html).toMatch(/<text[^>]* x="39"/);
  });
});


describe("native-size Canvas ImagePosition rendering", () => {
  const asset = {
    name: "companylogo",
    path: "Resources/CompanyLogo.png",
    dataUrl: "data:image/png;base64,AA=="
  };
  function renderImage(position: string, dataUrl = asset.dataUrl) {
    return renderToStaticMarkup(<svg><CanvasVisualControl
      control={{
        ...label({ Image: "=Media.CompanyLogo", ImagePosition: position }),
        controlType: "Classic/Image@2.1.0"
      }}
      mediaAssets={[{ ...asset, dataUrl }]}
      x={10} y={20} width={140} height={64} clipId="synthetic-image-clip"
    /></svg>);
  }

  it("centers imported raster at intrinsic size without stretching", () => {
    const html = renderImage("=ImagePosition.Center");
    expect(html).toContain("<foreignObject");
    expect(html).toContain("background-size:auto");
    expect(html).toContain("background-repeat:no-repeat");
    expect(html).toContain("background-position:center");
    expect(html).not.toContain("preserveAspectRatio=");
  });

  it("tiles imported raster at intrinsic size within the control clip", () => {
    const html = renderImage("=ImagePosition.Tile");
    expect(html).toContain("<foreignObject");
    expect(html).toContain("background-repeat:repeat");
    expect(html).toContain("background-position:left top");
    expect(html).toContain("background-size:auto");
    expect(html).toContain('clip-path="url(#synthetic-image-clip)"');
  });

  it("preserves SVG Fit, Fill, Stretch and unresolved mode behavior", () => {
    expect(renderImage("=ImagePosition.Fit"))
      .toContain('preserveAspectRatio="xMidYMid meet"');
    expect(renderImage("=ImagePosition.Fill"))
      .toContain('preserveAspectRatio="xMidYMid slice"');
    expect(renderImage("=ImagePosition.Stretch"))
      .toContain('preserveAspectRatio="none"');
    const unknown = renderImage("=varImagePosition");
    expect(unknown).not.toContain("<foreignObject");
    expect(unknown).toContain('preserveAspectRatio="xMidYMid meet"');
  });

  it("does not interpolate unsafe image URLs into native-size CSS", () => {
    const html = renderImage("=ImagePosition.Tile", "https://example.com/tracker.png");
    expect(html).not.toContain("<foreignObject");
    expect(html).not.toContain("example.com");
    expect(html).not.toContain("background-image:");
  });
});
