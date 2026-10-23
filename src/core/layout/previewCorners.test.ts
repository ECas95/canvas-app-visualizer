import { describe, expect, it } from "vitest";
import { previewCornerRadii, previewRoundedRectPath } from "./previewCorners";

describe("Canvas corner radius preview", () => {
  it("preserves independent serialized corners instead of copying top-left to all corners", () => {
    const radii = previewCornerRadii({
      RadiusTopLeft: "=20",
      RadiusTopRight: "=0",
      RadiusBottomRight: "=8",
      RadiusBottomLeft: "=12"
    }, 200, 80);
    expect(radii).toEqual({
      topLeft: 20, topRight: 0, bottomRight: 8, bottomLeft: 12
    });
    const path = previewRoundedRectPath(10, 15, 200, 80, radii);
    expect(path).toContain("M 30 15");
    expect(path).toContain("H 210 Q 210 15 210 15");
    expect(path).toContain("Q 210 95 202 95");
    expect(path).toContain("H 22 Q 10 95 10 83");
  });

  it("clamps negative and oversized radii to finite geometry", () => {
    expect(previewCornerRadii({
      RadiusTopLeft: "=-10",
      RadiusTopRight: "=900",
      RadiusBottomRight: "=900",
      RadiusBottomLeft: "=0"
    }, 120, 40)).toEqual({
      topLeft: 0, topRight: 20, bottomRight: 20, bottomLeft: 0
    });
  });

  it("does not evaluate runtime formulas or invent resolved radius values", () => {
    const radii = previewCornerRadii({
      RadiusTopLeft: "=If(varReady, 20, 0)",
      RadiusBottomRight: "=Parent.Width / 10"
    }, 200, 80);
    expect(radii.topLeft).toBe(4);
    expect(radii.bottomRight).toBe(4);
  });

  it("retains the previous approximate default when radius is omitted", () => {
    expect(previewCornerRadii({}, 100, 50)).toEqual({
      topLeft: 4, topRight: 4, bottomRight: 4, bottomLeft: 4
    });
  });

  it("bounds clipping paths to the inset box and handles degenerate dimensions", () => {
    const radii = previewCornerRadii({ RadiusTopLeft: "=50" }, 30, 20);
    const clip = previewRoundedRectPath(1, 1, 28, 18, radii);
    expect(clip).toContain("M 10 1");
    expect(clip).toContain("Q 29 1 29 5");
    const zero = previewRoundedRectPath(0, 0, 0, 0, radii);
    expect(zero).not.toContain("NaN");
    expect(zero).not.toContain("Infinity");
  });
});
