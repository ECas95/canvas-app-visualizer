import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasControl } from "../types/canvas";
import { buildCanvasModel } from "../core/model/normalize";
import { CanvasVisualControl } from "./CanvasVisualControl";
import { PREVIEW_ICON_PATHS } from "../core/layout/previewIcon";

function render(icon: string | undefined, type = "Classic/Icon@2.5.0", viewport = 768): string {
  const control: CanvasControl = {
    id: "synthetic-icon-uncertainty", name: "SyntheticIconUncertainty",
    controlType: type,
    properties: icon === undefined ? {} : { Icon: icon },
    children: [], sourceFile: "Src/Synthetic.pa.yaml",
    sourcePath: "Screens/Synthetic/SyntheticIconUncertainty",
    sourceFormat: "pa-yaml-v3", zIndex: 0
  };
  return renderToStaticMarkup(<svg><CanvasVisualControl
    control={control} x={0} y={0} width={48} height={48}
    clipId="synthetic-icon-uncertainty-clip"
    simulationSymbols={{ "App.Width": viewport }}
  /></svg>);
}

describe("Canvas Icon source uncertainty", () => {
  it.each([
    ["runtime formula", "=varSqlIcon", "Classic/Icon@2.5.0"],
    ["permission-dependent formula", "=If(varSqlAuthorized, Icon.Add, Icon.Home)", "Classic/Icon@2.5.0"],
    ["unsupported classic enum", "=Icon.AddressBook", "Classic/Icon@2.5.0"],
    ["unsupported modern Fluent name", '="CheckmarkCircle"', "ModernIcon@1.1.0"]
  ])("marks %s as unverified instead of silently drawing a glyph", (_case, formula, type) => {
    const markup = render(formula, type);
    expect(markup).toContain('data-preview-icon-state="unknown"');
    expect(markup).toContain("no glyph is verified");
    expect(markup).toContain(">?</tspan>");
    expect(markup).not.toContain('d="' + PREVIEW_ICON_PATHS.add + '"');
  });

  it("marks an absent Icon property as source-unavailable rather than inventing a glyph", () => {
    expect(render(undefined)).toContain('data-preview-icon-state="unknown"');
  });

  it.each([390, 768, 1366])("does not flag a known responsive icon at %i px", width => {
    const markup = render("=If(App.Width < 720, Icon.Add, Icon.Home)", "Classic/Icon@2.5.0", width);
    expect(markup).not.toContain('data-preview-icon-state="unknown"');
    expect(markup).toContain('d="' + (width < 720 ? PREVIEW_ICON_PATHS.add : PREVIEW_ICON_PATHS.home) + '"');
  });

  it("does not mistake verified Icon.None for an unknown icon", () => {
    const markup = render("=Icon.None");
    expect(markup).not.toContain('data-preview-icon-state="unknown"');
    expect(markup).not.toContain(">?</tspan>");
  });

  it("preserves unknown status after importing a generic versioned .pa.yaml fixture", () => {
    const yaml = [
      "Screens:", "  Synthetic:", "    Children:",
      "      - StatusIcon:", "          Control: ModernIcon@1.1.0",
      "          Properties:", "            Icon: =varRuntimeFluentIcon",
      "            Width: =48", "            Height: =48"
    ].join("\n");
    const model = buildCanvasModel([{
      path: "Src/Synthetic.pa.yaml", name: "Synthetic.pa.yaml",
      content: yaml, origin: "yaml", format: "pa-yaml-v3"
    }], "yaml");
    expect(model.screens).toHaveLength(1);
    const control = model.screens[0].children[0];
    const markup = renderToStaticMarkup(<svg><CanvasVisualControl
      control={control} x={0} y={0} width={48} height={48}
      clipId="yaml-icon-uncertainty" /></svg>);
    expect(markup).toContain('data-preview-icon-state="unknown"');
    expect(markup).toContain("no glyph is verified");
  });
});
