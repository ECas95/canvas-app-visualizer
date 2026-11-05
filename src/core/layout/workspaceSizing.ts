/**
 * Workbench sizing is UI-only: no Canvas formulas or runtime data are evaluated.
 * Keep enough room for the preview and both inspectors on desktop layouts.
 */
export interface WorkspaceWidths {
  explorer: number;
  details: number;
}

export type WorkspacePanel = "explorer" | "details";

export const WORKSPACE_DEFAULTS: WorkspaceWidths = {
  explorer: 266,
  details: 380
};

export const WORKSPACE_LIMITS = {
  explorerMin: 190,
  explorerMax: 440,
  detailsMin: 260,
  detailsMax: 600,
  previewMin: 340,
  dividers: 16
} as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function availablePanelWidth(containerWidth: number): number {
  const minimum = WORKSPACE_LIMITS.explorerMin + WORKSPACE_LIMITS.detailsMin;
  if (!Number.isFinite(containerWidth)) return minimum;
  return Math.max(minimum, containerWidth -
    WORKSPACE_LIMITS.previewMin - WORKSPACE_LIMITS.dividers);
}

export function fitWorkspaceWidths(
  widths: WorkspaceWidths,
  containerWidth: number
): WorkspaceWidths {
  let explorer = clamp(widths.explorer,
    WORKSPACE_LIMITS.explorerMin, WORKSPACE_LIMITS.explorerMax);
  let details = clamp(widths.details,
    WORKSPACE_LIMITS.detailsMin, WORKSPACE_LIMITS.detailsMax);
  const excess = Math.max(0, explorer + details - availablePanelWidth(containerWidth));
  const detailsReduction = Math.min(excess, details - WORKSPACE_LIMITS.detailsMin);
  details -= detailsReduction;
  explorer -= Math.min(excess - detailsReduction, explorer - WORKSPACE_LIMITS.explorerMin);
  return { explorer, details };
}

/**
 * deltaX is the movement of the divider in screen pixels.
 * Dragging the left divider right expands Explorer; dragging the right
 * divider left expands Details. The opposite panel remains unchanged.
 */
export function resizeWorkspacePanel(
  widths: WorkspaceWidths,
  panel: WorkspacePanel,
  deltaX: number,
  containerWidth: number
): WorkspaceWidths {
  const fitted = fitWorkspaceWidths(widths, containerWidth);
  if (!Number.isFinite(deltaX)) return fitted;
  const budget = availablePanelWidth(containerWidth);
  if (panel === "explorer") {
    return {
      ...fitted,
      explorer: clamp(fitted.explorer + deltaX,
        WORKSPACE_LIMITS.explorerMin,
        Math.min(WORKSPACE_LIMITS.explorerMax, budget - fitted.details))
    };
  }
  return {
    ...fitted,
    details: clamp(fitted.details - deltaX,
      WORKSPACE_LIMITS.detailsMin,
      Math.min(WORKSPACE_LIMITS.detailsMax, budget - fitted.explorer))
  };
}
