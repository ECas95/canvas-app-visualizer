import type { CanvasAppModel, CanvasControl, CanvasScreen, Finding } from "../../types/canvas";

export type FindingLocation =
  | { kind: "screen"; screen: CanvasScreen }
  | { kind: "control"; screen: CanvasScreen; control: CanvasControl };

function normalize(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "").toLowerCase();
}

function lookupKey(path: string, file: string): string {
  return normalize(path) + "|" + normalize(file);
}

/**
 * Resolve diagnostics by their exact source location, not by display names.
 * Different screens can contain identically named controls. File and path
 * jointly identify the original serialized element.
 */
export function buildFindingLocationIndex(app: CanvasAppModel): Map<string, FindingLocation> {
  const index = new Map<string, FindingLocation>();

  function walk(controls: CanvasControl[], screen: CanvasScreen): void {
    for (const control of controls) {
      index.set(lookupKey(control.sourcePath, control.sourceFile), {
        kind: "control", screen, control
      });
      walk(control.children, screen);
    }
  }

  for (const screen of app.screens) {
    index.set(lookupKey("Screens/" + screen.name, screen.sourceFile), {
      kind: "screen", screen
    });
    walk(screen.children, screen);
  }

  return index;
}

export function locationForFinding(
  index: ReadonlyMap<string, FindingLocation>,
  finding: Finding
): FindingLocation | undefined {
  if (!finding.controlPath || !finding.sourceFile) return undefined;
  return index.get(lookupKey(finding.controlPath, finding.sourceFile));
}
