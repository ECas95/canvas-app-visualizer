import type { CanvasControl } from "../../types/canvas";
import {
  autoLayoutChildren, controlRect, isAutoLayout,
  type LayoutContext, type PositionedControl
} from "./layout";

export type InspectVisibility = "visible" | "hidden" | "unknown";
export type VisibilityInspectionFilter = "all" | "hidden" | "unknown" | "template";

export interface InspectVisibilityRecord {
  id: string;
  name: string;
  controlType: string;
  own: InspectVisibility;
  effective: InspectVisibility;
  templateDefinition: boolean;
  condition: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  geometryVerified: boolean;
}

/**
 * A proven false ancestor hides the subtree. A child that is itself
 * false stays hidden even if an ancestor is unresolved. Otherwise one
 * unresolved ancestor makes the child's effective visibility unknown.
 * This is three-valued logic, not a runtime permission verdict.
 */
export function effectiveInspectVisibility(
  parent: InspectVisibility,
  own: InspectVisibility
): InspectVisibility {
  if (parent === "hidden" || own === "hidden") return "hidden";
  if (parent === "unknown" || own === "unknown") return "unknown";
  return "visible";
}

/**
 * AutoLayout normally omits source-proven hidden children from the flow.
 * Restore them exclusively for inspection without shifting the coordinates
 * of visible siblings. When the hidden node has no proven in-flow slot its
 * X/Y is only a paint fallback, so always mark its geometry unverified.
 */
export function autoLayoutInspectionChildren(
  parent: CanvasControl,
  context: LayoutContext
): PositionedControl[] {
  const laidOut = autoLayoutChildren(parent, context);
  const byId = new Map(laidOut.map(item => [item.control.id, item]));
  return parent.children.map((control, index) =>
    byId.get(control.id) ?? {
      control,
      rect: {
        ...controlRect(control, index, context),
        dynamic: true
      },
      sourceVisibility: "hidden" as const
    }
  );
}

/** Strictly bounded, opt-in synthetic scenario values, never SQL records. */
export const MAX_SCENARIO_JSON_BYTES = 8 * 1024;
const RESERVED = new Set([
  "app", "self", "parent", "thisitem", "thisrecord", "user", "true", "false",
  "__proto__", "prototype", "constructor", "tostring", "valueof",
  "hasownproperty", "tolocalestring"
]);

export function parseVisibilityScenario(json: string):
  Record<string, string | number | boolean> {
  if (new TextEncoder().encode(json).length > MAX_SCENARIO_JSON_BYTES) {
    throw new Error("Scenario JSON exceeds the 8 KB local limit.");
  }
  let raw: unknown;
  try { raw = JSON.parse(json); }
  catch { throw new Error("Scenario JSON is not valid JSON."); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Scenario must be a JSON object of scalar variables.");
  }
  const entries = Object.entries(raw);
  if (entries.length > 48) throw new Error("Scenario supports up to 48 variables.");
  const result: Record<string, string | number | boolean> = Object.create(null);
  const seen = new Set<string>();
  for (const [name, value] of entries) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name) ||
        RESERVED.has(name.toLowerCase()) ||
        seen.has(name.toLowerCase()) ||
        !((typeof value === "boolean") ||
          (typeof value === "number" && Number.isFinite(value)) ||
          (typeof value === "string" && value.length <= 256))) {
      throw new Error("Scenario fields must be distinct safe scalar variables; no records or arrays.");
    }
    seen.add(name.toLowerCase());
    result[name] = value;
  }
  return result;
}

export function filterInspectionRecords(
  rows: readonly InspectVisibilityRecord[],
  filter: VisibilityInspectionFilter,
  query = ""
): InspectVisibilityRecord[] {
  const q = query.trim().toLowerCase();
  return rows.filter(row =>
    (filter === "all" ||
      (filter === "hidden" && row.effective === "hidden") ||
      (filter === "unknown" && row.effective === "unknown") ||
      (filter === "template" && row.templateDefinition)) &&
    (!q ||
      row.name.toLowerCase().includes(q) ||
      row.controlType.toLowerCase().includes(q) ||
      (row.condition ?? "").toLowerCase().includes(q))
  );
}

/** Coverage is computed from the imported hierarchy, independently of paint. */
export function countDeclaredVisualControls(controls: readonly CanvasControl[]): number {
  let count = 0;
  const stack = [...controls];
  while (stack.length && count < 20_000) {
    const item = stack.pop()!;
    count++;
    stack.push(...item.children);
  }
  return count;
}
