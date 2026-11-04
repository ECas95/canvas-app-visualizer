import { describe, expect, it } from "vitest";
import { diagnoseSourceGeometry, type GeometryNode } from "./previewGeometryDiagnostics";

const node = (id: string, x: number, y: number, width: number, height: number,
  type = "Classic/Label@2.5.1", parentId?: string): GeometryNode => ({
  id, name: id, x, y, width, height, type, parentId, verified: true
});

describe("generic Canvas geometry findings", () => {
  it("detects a child cropped by its nested container and a viewport overflow", () => {
    const all = [
      node("Card", 30, 40, 100, 100, "GroupContainer@1.3.0"),
      node("OutsideCard", 110, 70, 70, 55, "Classic/Label@2.5.1", "Card"),
      node("OutsideViewport", 200, 10, 120, 40)
    ];
    const report = diagnoseSourceGeometry(all, 260, 180);
    const clipped = report.find(issue => issue.controlId === "OutsideCard");
    expect(clipped?.kind).toBe("clipped");
    expect(clipped?.excessPercent).toBeGreaterThan(50);
    const viewport = report.find(issue => issue.controlId === "OutsideViewport");
    expect(viewport?.kind).toBe("out-of-viewport");
  });

  it("recognizes strong sibling overlap as a review hint rather than proof of a bug", () => {
    const report = diagnoseSourceGeometry([
      node("First", 0, 0, 100, 100),
      node("Second", 10, 10, 95, 95)
    ], 400, 300);
    expect(report.find(issue => issue.kind === "overlap")?.severity).toBe("review");
  });

  it("does not invent geometry for runtime-dependent controls or SVG decorations", () => {
    const unknown = { ...node("Unknown", 0, 0, 10, 10), verified: false };
    const report = diagnoseSourceGeometry([
      unknown,
      node("Background", 0, 0, 200, 100, "Classic/Rectangle@2.0"),
      node("Label", 0, 0, 200, 100)
    ], 200, 100);
    expect(report.filter(issue => issue.kind === "unknown-layout")).toHaveLength(1);
    expect(report.filter(issue => issue.kind === "overlap")).toHaveLength(0);
  });

  it("bounds results for pathological imported layouts", () => {
    const nodes = Array.from({ length: 300 }, (_, i) =>
      node(String(i), -100, -100, 120, 120));
    expect(diagnoseSourceGeometry(nodes, 400, 300).length).toBeLessThanOrEqual(150);
  });
});
