import { describe, expect, it } from "vitest";
import type { CanvasControl } from "../../types/canvas";
import {
  autoLayoutInspectionChildren, countDeclaredVisualControls,
  effectiveInspectVisibility, filterInspectionRecords,
  parseVisibilityScenario, MAX_SCENARIO_JSON_BYTES,
  type InspectVisibilityRecord
} from "./visibilityInspection";

function control(name: string, props: Record<string, unknown>,
  children: CanvasControl[] = []): CanvasControl {
  return {
    id: name, name, controlType: "Classic/Label@2.5.1", properties: props,
    children, sourceFile: "Src/Fictional.pa.yaml",
    sourcePath: "Screens/Fictional/" + name,
    sourceFormat: "pa-yaml-v3", zIndex: 1
  };
}

describe("full Canvas visibility inventory", () => {
  it("propagates visible, hidden and unresolved conditions through nested containers", () => {
    expect(effectiveInspectVisibility("visible", "hidden")).toBe("hidden");
    expect(effectiveInspectVisibility("hidden", "unknown")).toBe("hidden");
    expect(effectiveInspectVisibility("unknown", "hidden")).toBe("hidden");
    expect(effectiveInspectVisibility("unknown", "visible")).toBe("unknown");
    expect(effectiveInspectVisibility("visible", "unknown")).toBe("unknown");
    expect(effectiveInspectVisibility("visible", "visible")).toBe("visible");
  });

  it("recovers AutoLayout hidden source children without moving visible siblings", () => {
    const shown = control("VisibleChild", {
      Width: "=80", Height: "=30", Visible: "=true"
    });
    const hidden = control("HiddenChild", {
      Width: "=50", Height: "=30", Visible: "=false"
    });
    const later = control("LaterChild", {
      Width: "=70", Height: "=30", Visible: "=true"
    });
    const parent = {
      ...control("Column", {
        LayoutDirection: "=LayoutDirection.Horizontal",
        LayoutGap: "=8"
      }, [shown, hidden, later]),
      controlType: "GroupContainer@1.3.0", variant: "AutoLayout"
    };
    const ctx = {
      parentWidth: 360, parentHeight: 80, appWidth: 1366, appHeight: 768
    };
    const rows = autoLayoutInspectionChildren(parent, ctx);
    expect(rows.map(item => item.control.name)).toEqual([
      "VisibleChild", "HiddenChild", "LaterChild"
    ]);
    expect(rows[1].sourceVisibility).toBe("hidden");
    expect(rows[1].rect.dynamic).toBe(true);
    // Inspecting a hidden node must not shift in-flow visible geometry.
    expect(rows[2].rect.x).toBeGreaterThan(rows[0].rect.x);
  });

  it("validates explicit synthetic scenario fields without source records", () => {
    const parsed = parseVisibilityScenario(
      '{"varAuthorized":true,"varStage":"review","varCount":3}'
    );
    expect(parsed.varAuthorized).toBe(true);
    expect(parsed.varStage).toBe("review");
    expect(parsed.varCount).toBe(3);
    expect(Object.getPrototypeOf(parsed)).toBe(null);
    for (const unsafe of [
      '[]', '{"__proto__":true}', '{"Parent":4}',
      '{"varRows":[1,2]}', '{"varObj":{"x":1}}',
      '{"a":null}', '{"a":1,"A":2}', "not json",
      " ".repeat(MAX_SCENARIO_JSON_BYTES + 1)
    ]) {
      expect(() => parseVisibilityScenario(unsafe)).toThrow();
    }
  });

  it("filters by effective state, template definitions and source formula", () => {
    const rows: InspectVisibilityRecord[] = [
      { id: "A", name: "Guarded", controlType: "Classic/Label",
        own: "unknown", effective: "unknown", templateDefinition: false,
        condition: "=varAccess", x: 0, y: 0, width: 10, height: 10,
        geometryVerified: true },
      { id: "B", name: "BehindParent", controlType: "Classic/Label",
        own: "visible", effective: "hidden", templateDefinition: false,
        condition: null, x: 2, y: 2, width: 10, height: 10,
        geometryVerified: true },
      { id: "C", name: "TemplateCell", controlType: "Classic/Label",
        own: "visible", effective: "visible", templateDefinition: true,
        condition: null, x: 3, y: 3, width: 10, height: 10,
        geometryVerified: false }
    ];
    expect(filterInspectionRecords(rows, "unknown").map(r => r.name))
      .toEqual(["Guarded"]);
    expect(filterInspectionRecords(rows, "hidden").map(r => r.name))
      .toEqual(["BehindParent"]);
    expect(filterInspectionRecords(rows, "template").map(r => r.name))
      .toEqual(["TemplateCell"]);
    expect(filterInspectionRecords(rows, "all", "varAccess").map(r => r.id))
      .toEqual(["A"]);
    expect(countDeclaredVisualControls([
      control("Root", {}, [control("Nested", {})])
    ])).toBe(2);
  });
});
