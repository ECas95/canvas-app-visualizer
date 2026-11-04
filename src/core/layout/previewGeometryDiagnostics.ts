/** Source-only geometric diagnostics; never assumes the current SQL/runtime state. */
export interface GeometryNode {
  id: string;
  name: string;
  type: string;
  parentId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  verified: boolean;
}

export type GeometryIssueKind = "clipped" | "out-of-viewport" | "overlap" | "unknown-layout";

export interface GeometryIssue {
  id: string;
  controlId: string;
  relatedId?: string;
  label: string;
  kind: GeometryIssueKind;
  severity: "warning" | "review" | "info";
  /** Estimated fraction of this control's area outside its verified clipping parent. */
  excessPercent: number;
  detail: string;
}

export function diagnoseSourceGeometry(
  nodes: readonly GeometryNode[],
  viewportWidth: number,
  viewportHeight: number
): GeometryIssue[] {
  if (![viewportWidth, viewportHeight].every(v => Number.isFinite(v) && v > 0)) return [];
  const byId = new Map(nodes.map(node => [node.id, node]));
  const issues: GeometryIssue[] = [];
  const max = 150;

  function add(issue: GeometryIssue): void {
    if (issues.length < max) issues.push(issue);
  }
  function area(node: GeometryNode): number {
    return Math.max(0, node.width) * Math.max(0, node.height);
  }
  function intersection(a: GeometryNode, b: GeometryNode): number {
    return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  }
  const root: GeometryNode = {
    id: "@viewport", name: "Canvas viewport", type: "Viewport",
    x: 0, y: 0, width: viewportWidth, height: viewportHeight,
    verified: true
  };
  for (const node of nodes) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y) ||
        !Number.isFinite(node.width) || !Number.isFinite(node.height) ||
        node.width < 0 || node.height < 0 || !node.verified) {
      add({
        id: node.id + "::unknown", controlId: node.id, label: node.name,
        kind: "unknown-layout", severity: "info", excessPercent: 0,
        detail: "Source dimensions or runtime-dependent state cannot be established."
      });
      continue;
    }
    const total = area(node);
    if (total === 0) continue;
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    const parentClips = parent && /(gallery|container|form|datacard)/i.test(parent.type);
    const clip = parentClips ? parent : root;
    if (!clip.verified || !Number.isFinite(clip.width) || !Number.isFinite(clip.height)) continue;
    const visible = intersection(node, clip);
    const outside = Math.max(0, 1 - visible / total);
    // A child may intentionally extend beyond a scrollable container. Such
    // findings remain review hints, not proof of incorrect Canvas geometry.
    if (outside > .01) {
      add({
        id: node.id + "::" + (parentClips ? "clipped" : "viewport"),
        controlId: node.id, relatedId: parentClips ? parent?.id : undefined,
        label: node.name,
        kind: parentClips ? "clipped" : "out-of-viewport",
        severity: parentClips ? "review" : "info",
        excessPercent: Math.round(outside * 10000) / 100,
        detail: parentClips
          ? "Part of this control extends outside its parent container; verify clipping/scroll."
          : "Control extends outside the chosen Canvas viewport."
      });
    }
  }

  // Sibling overlaps are not inherently bugs (badges may intentionally sit
  // over cards). Only flag large same-level intersections as review hints.
  const groups = new Map<string, GeometryNode[]>();
  for (const node of nodes) {
    if (!node.verified || area(node) === 0) continue;
    const group = node.parentId ?? "@root";
    groups.set(group, [...(groups.get(group) ?? []), node]);
  }
  for (const siblings of groups.values()) {
    if (siblings.length > 80) continue; // avoid quadratic work in very large screens
    for (let a = 0; a < siblings.length; a++) {
      for (let b = a + 1; b < siblings.length; b++) {
        const first = siblings[a], second = siblings[b];
        const common = intersection(first, second);
        const minimum = Math.min(area(first), area(second));
        if (!minimum || common / minimum < .65) continue;
        // Full-cover backgrounds, labels over rectangle layers and control
        // adornments are intentional in many Canvas apps; don't present as errors.
        if (/(?:rectangle|shape|image|icon)/i.test(first.type + "/" + second.type)) continue;
        add({
          id: first.id + "::" + second.id,
          controlId: second.id, relatedId: first.id,
          label: second.name, kind: "overlap", severity: "review",
          excessPercent: Math.round(common / minimum * 10000) / 100,
          detail: "Strong overlap with sibling " + first.name +
            "; verify whether the layering is intentional."
        });
      }
    }
  }
  return issues;
}
