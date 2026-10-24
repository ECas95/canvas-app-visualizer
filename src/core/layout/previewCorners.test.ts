import { describe, expect, it } from "vitest";
import { previewChildClipPath, previewCornerRadii, previewRoundedRectPath } from "./previewCorners";

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

  it("preserves large source radii for proportional edge normalization", () => {
    expect(previewCornerRadii({
      RadiusTopLeft: "=-10",
      RadiusTopRight: "=900",
      RadiusBottomRight: "=900",
      RadiusBottomLeft: "=0"
    }, 120, 40)).toEqual({
      topLeft: 0, topRight: 900, bottomRight: 900, bottomLeft: 0
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
    const radii = previewCornerRadii({
      RadiusTopLeft: "=50", RadiusTopRight: "=0",
      RadiusBottomRight: "=0", RadiusBottomLeft: "=0"
    }, 30, 20);
    const clip = previewRoundedRectPath(1, 1, 28, 18, radii);
    expect(clip).toContain("M 19 1");
    expect(clip).toContain("Q 1 1 19 1");
    const zero = previewRoundedRectPath(0, 0, 0, 0, radii);
    expect(zero).not.toContain("NaN");
    expect(zero).not.toContain("Infinity");
  });
  it("clips children to explicitly serialized independent corners", () => {
    const path = previewChildClipPath({
      RadiusTopLeft: "=12", RadiusTopRight: "=0",
      RadiusBottomRight: "=6", RadiusBottomLeft: "=2"
    }, 10, 20, 100, 40);
    expect(path).toContain("M 22 20");
    expect(path).toContain("H 110 Q 110 20 110 20");
    expect(path).toContain("Q 110 60 104 60");
    expect(path).toContain("H 12 Q 10 60 10 58");
  });

  it("never invents rounded clipping for absent or runtime-dependent corners", () => {
    const unknown = previewChildClipPath({
      RadiusTopLeft: "=If(varAccess, 30, 0)",
      RadiusBottomRight: "=Parent.Width / 10"
    }, 0, 0, 80, 40);
    expect(unknown).toBe(previewChildClipPath({}, 0, 0, 80, 40));
    expect(unknown).toContain("M 0 0 H 80");
  });

  it("resolves responsive per-corner radii only from known viewport and parent symbols", () => {
    const props = {
      RadiusTopLeft: "=If(App.Width < 720, 12, 4)",
      RadiusTopRight: "=Parent.Height / 4",
      RadiusBottomRight: "=varUnknownRadius",
      RadiusBottomLeft: "=0"
    };
    const phone = previewCornerRadii(props, 100, 40, {
      "App.Width": 390, "Parent.Height": 40
    });
    const desktop = previewCornerRadii(props, 100, 40, {
      "App.Width": 1366, "Parent.Height": 40
    });
    expect(phone).toEqual({ topLeft: 12, topRight: 10, bottomRight: 4, bottomLeft: 0 });
    expect(desktop).toEqual({ topLeft: 4, topRight: 10, bottomRight: 4, bottomLeft: 0 });
    expect(previewCornerRadii(props, 100, 40).topLeft).toBe(4);
  });

  it("clips known responsive radii but never rounds for unresolved runtime state", () => {
    const props = {
      RadiusTopLeft: "=If(App.Width < 720, 12, 4)",
      RadiusBottomRight: "=Parent.Width / 20",
      RadiusTopRight: "=varUnknownRadius"
    };
    const phone = previewChildClipPath(props, 10, 20, 100, 40, {
      "App.Width": 390, "Parent.Width": 100
    });
    const desktop = previewChildClipPath(props, 10, 20, 100, 40, {
      "App.Width": 1366, "Parent.Width": 100
    });
    expect(phone).toContain("M 22 20");
    expect(phone).toContain("Q 110 60 105 60");
    expect(desktop).toContain("M 14 20");
    expect(phone).toContain("H 110 Q 110 20 110 20");
    expect(previewChildClipPath(props, 10, 20, 100, 40))
      .toContain("M 10 20");
  });

  it("bounds pathological radii and zero-size clip regions", () => {
    const path = previewChildClipPath({
      RadiusTopLeft: "=10000", RadiusBottomRight: "=-5"
    }, 0, 0, 100, 20);
    expect(path).toContain("M 20 0");
    expect(path).not.toContain("NaN");
    expect(previewChildClipPath({}, 0, 0, 0, 0)).not.toContain("Infinity");
  });

  it("preserves Microsoft's 300px opposite-corner leaf on a 300px button", () => {
    const props = {
      RadiusTopLeft: "=300", RadiusTopRight: "=0",
      RadiusBottomRight: "=300", RadiusBottomLeft: "=0"
    };
    const radii = previewCornerRadii(props, 300, 300);
    expect(radii).toEqual({
      topLeft: 300, topRight: 0, bottomRight: 300, bottomLeft: 0
    });
    const outline = previewRoundedRectPath(0, 0, 300, 300, radii);
    expect(outline).toContain("M 300 0 H 300");
    expect(outline).toContain("Q 300 300 0 300");
    expect(previewChildClipPath(props, 0, 0, 300, 300)).toBe(outline);
  });

  it("proportionally scales overlapping adjacent corners, not each to half the height", () => {
    const props = {
      RadiusTopLeft: "=80", RadiusTopRight: "=80",
      RadiusBottomRight: "=0", RadiusBottomLeft: "=0"
    };
    const radii = previewCornerRadii(props, 100, 60);
    const outline = previewRoundedRectPath(0, 0, 100, 60, radii);
    expect(outline).toContain("M 50 0 H 50");
    expect(outline).toContain("Q 100 0 100 50");
    expect(previewChildClipPath(props, 0, 0, 100, 60)).toBe(outline);
  });

  it("uses viewport-specific known radii consistently for outline and clipping", () => {
    const props = {
      RadiusTopLeft: "=If(App.Width < 720, 80, 12)",
      RadiusTopRight: "=If(App.Width < 720, 80, 12)",
      RadiusBottomRight: "=0", RadiusBottomLeft: "=0"
    };
    for (const viewport of [390, 1366]) {
      const symbols = { "App.Width": viewport };
      const outline = previewRoundedRectPath(0, 0, 100, 60,
        previewCornerRadii(props, 100, 60, symbols));
      expect(previewChildClipPath(props, 0, 0, 100, 60, symbols)).toBe(outline);
      expect(outline).toContain(viewport === 390 ? "M 50 0" : "M 12 0");
    }
  });
});
