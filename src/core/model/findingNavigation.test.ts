import { describe, expect, it } from "vitest";
import type { CanvasAppModel, CanvasControl, CanvasScreen, Finding } from "../../types/canvas";
import { buildFindingLocationIndex, locationForFinding } from "./findingNavigation";

function screen(name: string, file: string): CanvasScreen {
  const control: CanvasControl = {
    id: file + ":Screens/" + name + "/Button1", name: "Button1", controlType: "Button",
    sourcePath: "Screens/" + name + "/Button1", sourceFile: file,
    sourceFormat: "pa-yaml-v3", properties: { Text: '="Open"' },
    zIndex: 1, children: []
  };
  return { id: name, name, sourceFile: file, sourceFormat: "pa-yaml-v3",
    properties: {}, children: [control] };
}

function app(): CanvasAppModel {
  return {
    name: "Demo", sourceKind: "yaml", sourceFormat: "pa-yaml-v3",
    appProperties: {}, files: [], components: [], dataSources: [],
    screens: [screen("Home", "Src/Home.pa.yaml"), screen("Details", "Src/Details.pa.yaml")],
    problems: []
  };
}

const finding = (path: string, file: string): Finding => ({
  id: "test", ruleId: "test", category: "accessibility",
  severity: "warning", title: "Test", message: "Test finding",
  confidence: "medium", controlPath: path, sourceFile: file
});

describe("findings navigation", () => {
  it("resolves identically named controls on the correct screen", () => {
    const index = buildFindingLocationIndex(app());
    const loc = locationForFinding(index, finding("Screens/Details/Button1", "Src/Details.pa.yaml"));
    expect(loc?.kind).toBe("control");
    expect(loc?.screen.name).toBe("Details");
    if (loc?.kind === "control") expect(loc.control.name).toBe("Button1");
  });

  it("navigates screen-level findings and supports case-insensitive paths", () => {
    const index = buildFindingLocationIndex(app());
    expect(locationForFinding(index, finding("screens/HOME", "src/home.pa.yaml"))?.kind).toBe("screen");
  });

  it("does not jump from an ambiguous or missing source location", () => {
    const index = buildFindingLocationIndex(app());
    expect(locationForFinding(index, finding("Screens/Details/Button1", "Src/Home.pa.yaml"))).toBeUndefined();
    expect(locationForFinding(index, { ...finding("Screens/Home/Button1", "Src/Home.pa.yaml"), sourceFile: undefined })).toBeUndefined();
  });
});
