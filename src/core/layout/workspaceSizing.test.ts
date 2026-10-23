import { describe, expect, it } from "vitest";
import {
  fitWorkspaceWidths,
  resizeWorkspacePanel,
  WORKSPACE_DEFAULTS,
  WORKSPACE_LIMITS
} from "./workspaceSizing";

describe("workbench panel sizing", () => {
  it("preserves the desktop defaults when the viewport has room", () => {
    expect(fitWorkspaceWidths(WORKSPACE_DEFAULTS, 1366))
      .toEqual({ explorer: 266, details: 380 });
  });

  it("shrinks details first to keep the canvas preview usable", () => {
    expect(fitWorkspaceWidths({ explorer: 400, details: 600 }, 1000))
      .toEqual({ explorer: 384, details: 260 });
  });

  it("expands the explorer without changing details", () => {
    expect(resizeWorkspacePanel(WORKSPACE_DEFAULTS, "explorer", 60, 1366))
      .toEqual({ explorer: 326, details: 380 });
  });

  it("expands details when the right divider moves left", () => {
    expect(resizeWorkspacePanel(WORKSPACE_DEFAULTS, "details", -80, 1366))
      .toEqual({ explorer: 266, details: 460 });
  });

  it("clamps extreme pointer movement to the configured limits", () => {
    expect(resizeWorkspacePanel(WORKSPACE_DEFAULTS, "explorer", -9999, 1366).explorer)
      .toBe(WORKSPACE_LIMITS.explorerMin);
    expect(resizeWorkspacePanel(WORKSPACE_DEFAULTS, "details", -9999, 1366).details)
      .toBe(WORKSPACE_LIMITS.detailsMax);
  });

  it("respects the minimum preview width when the viewport is narrow", () => {
    const resized = resizeWorkspacePanel(WORKSPACE_DEFAULTS, "explorer", 9999, 1000);
    expect(resized).toEqual({ explorer: 266, details: 378 });
    expect(resized.explorer + resized.details +
      WORKSPACE_LIMITS.previewMin + WORKSPACE_LIMITS.dividers).toBe(1000);
  });

  it("ignores invalid pointer deltas without producing NaN dimensions", () => {
    expect(resizeWorkspacePanel(WORKSPACE_DEFAULTS, "details", Number.NaN, 1366))
      .toEqual(WORKSPACE_DEFAULTS);
  });
});
