import { describe, expect, it } from "vitest";
import {
  previewOverflowMode, previewScrollRanges, previewScrollOverlayAnchors, previewClampScroll,
  previewScrolledPosition, previewWheelScroll, type PreviewScrollItem
} from "./previewOverflow";

function item(id: string, ancestors: string[], x: number, y: number,
  width: number, height: number, extras: Partial<PreviewScrollItem> = {}): PreviewScrollItem {
  return {
    id, ancestors, x, y, width, height, dynamic: false,
    visibilityUnknown: false, ...extras
  };
}

describe("Canvas overflow semantics", () => {
  it("accepts only explicit LayoutOverflow enums, not unknown formulas", () => {
    expect(previewOverflowMode("=LayoutOverflow.Scroll")).toBe("scroll");
    expect(previewOverflowMode("LayoutOverflow.Hide")).toBe("hide");
    expect(previewOverflowMode("=If(varCanScroll, LayoutOverflow.Scroll, LayoutOverflow.Hide)")).toBe("unknown");
    expect(previewOverflowMode("=SQL.Scroll")).toBe("unknown");
    expect(previewOverflowMode(undefined)).toBe("hide");
    expect(previewOverflowMode(null)).toBe("unknown");
  });

  it.each([390, 768, 1366])(
    "keeps explicit null overflow unknown while preserving verified scroll at %i px",
    viewport => {
      const host = item("Host", [], 0, 0, 100, 100, {
        overflowX: null,
        overflowY: "=LayoutOverflow.Scroll",
        symbols: { "App.Width": viewport }
      });
      const child = item("Child", ["Host"], 0, 0, 180, 180);
      expect(previewOverflowMode(host.overflowX, host.symbols)).toBe("unknown");
      expect(previewScrollRanges([host, child]))
        .toEqual({ Host: { x: 0, y: 80 } });
    }
  );

  it("recognizes Canvas overflow enum tokens despite valid Power Fx comments", () => {
    expect(previewOverflowMode("=LayoutOverflow /* layout */ . Scroll // trailing"))
      .toBe("scroll");
    expect(previewOverflowMode("= LayoutOverflow. /* note */ Hide"))
      .toBe("hide");
    expect(previewOverflowMode(
      "=If(App.Width < 720, LayoutOverflow /* note */ . Scroll, LayoutOverflow.Hide)",
      { "App.Width": 390 }
    )).toBe("scroll");
    expect(previewOverflowMode(
      "=If(App.Width < 720, LayoutOverflow.Scroll, LayoutOverflow /* note */ . Hide)",
      { "App.Width": 1366 }
    )).toBe("hide");
  });

  it("rejects text and malformed overflow expressions even with comments", () => {
    expect(previewOverflowMode('="LayoutOverflow.Scroll" /* not an enum */'))
      .toBe("unknown");
    expect(previewOverflowMode("=LayoutOverflow.Scroll /* note */ & other"))
      .toBe("unknown");
    expect(previewOverflowMode("=LayoutOverflow /* note */ . Unknown"))
      .toBe("unknown");
    expect(previewOverflowMode("=LayoutOverflow.Scroll /* unterminated"))
      .toBe("unknown");
    expect(previewOverflowMode(
      '=If(true, "LayoutOverflow.Scroll" /* text */, LayoutOverflow.Hide)'
    )).toBe("unknown");
  });

  it("resolves viewport-dependent overflow enums without running behaviors", () => {
    const formula = "=If(App.Width < 720, LayoutOverflow.Scroll, LayoutOverflow.Hide)";
    expect(previewOverflowMode(formula, { "App.Width": 390 })).toBe("scroll");
    expect(previewOverflowMode(formula, { "App.Width": 1366 })).toBe("hide");
    expect(previewOverflowMode(formula)).toBe("unknown");
    expect(previewOverflowMode('="LayoutOverflow.Scroll"')).toBe("unknown");
    expect(previewOverflowMode('=If(App.Width < 720, "LayoutOverflow.Scroll", LayoutOverflow.Hide)',
      { "App.Width": 390 })).toBe("unknown");
    expect(previewOverflowMode("=If(varCanScroll, LayoutOverflow.Scroll, LayoutOverflow.Hide)",
      { "App.Width": 390 })).toBe("unknown");
  });

  it("resolves selected enum branches without mistaking text for enums", () => {
    const source = '=If(App.Width < 720, LayoutOverflow.Scroll, "LayoutOverflow.Hide")';
    expect(previewOverflowMode(source, { "App.Width": 390 })).toBe("scroll");
    expect(previewOverflowMode(source, { "App.Width": 1366 })).toBe("unknown");
    expect(previewOverflowMode('=If(true, LayoutOverflow.Hide, "LayoutOverflow.Scroll")'))
      .toBe("hide");
    expect(previewOverflowMode('=If(true, "LayoutOverflow.Scroll", LayoutOverflow.Hide)'))
      .toBe("unknown");
  });

  it("keeps local strings, text concatenation and connector values unknown", () => {
    const symbols = { localOverflow: "LayoutOverflow.Scroll" };
    expect(previewOverflowMode("=localOverflow", symbols)).toBe("unknown");
    expect(previewOverflowMode("=If(true, localOverflow, LayoutOverflow.Hide)", symbols))
      .toBe("unknown");
    expect(previewOverflowMode('="LayoutOverflow." & "Scroll"')).toBe("unknown");
    expect(previewOverflowMode("=If(true, SQL.Overflow, LayoutOverflow.Hide)"))
      .toBe("unknown");
  });

  it("supports nested and multi-condition If with verified viewports", () => {
    const formula = "=If(App.Width < 600, LayoutOverflow.Scroll, " +
      "App.Width < 1000, If(App.Height > 800, LayoutOverflow.Hide, LayoutOverflow.Scroll), " +
      "LayoutOverflow.Hide)";
    expect(previewOverflowMode(formula, { "App.Width": 390, "App.Height": 844 }))
      .toBe("scroll");
    expect(previewOverflowMode(formula, { "App.Width": 768, "App.Height": 1024 }))
      .toBe("hide");
    expect(previewOverflowMode(formula, { "App.Width": 768, "App.Height": 600 }))
      .toBe("scroll");
    expect(previewOverflowMode(formula, { "App.Width": 1366, "App.Height": 768 }))
      .toBe("hide");
    expect(previewOverflowMode(formula, { "App.Width": 768 }))
      .toBe("unknown");
  });

  it("does not enable scrolling from unresolved or malformed branches", () => {
    expect(previewOverflowMode("=If(varAuthorized, LayoutOverflow.Scroll, LayoutOverflow.Hide)"))
      .toBe("unknown");
    expect(previewOverflowMode("=If(true, LayoutOverflow.Scroll, )")).toBe("unknown");
    expect(previewOverflowMode("=If(true, LayoutOverflow.Scroll")).toBe("unknown");
    expect(previewOverflowMode("=If(false, LayoutOverflow.Scroll)")).toBe("unknown");
  });

  it("computes scroll extents only at viewports with proven Scroll", () => {
    const host = item("Host", [], 0, 0, 100, 100, {
      overflowY: "=If(App.Width < 720, LayoutOverflow.Scroll, LayoutOverflow.Hide)"
    });
    const child = item("Child", ["Host"], 0, 0, 100, 180);
    expect(previewScrollRanges([{ ...host, symbols: { "App.Width": 390 } }, child]))
      .toEqual({ Host: { x: 0, y: 80 } });
    expect(previewScrollRanges([{ ...host, symbols: { "App.Width": 1366 } }, child]))
      .not.toHaveProperty("Host");
    expect(previewScrollRanges([host, child])).not.toHaveProperty("Host");
  });

  it.each([
    [390, "scroll", 80],
    [768, "hide", 0],
    [1366, "scroll", 80]
  ] as const)("resolves typed Switch overflow at %i px without runtime data",
    (viewport, expected, range) => {
      const formula = "=Switch(true, App.Width < 600, LayoutOverflow.Scroll, " +
        "App.Width < 1024, LayoutOverflow.Hide, LayoutOverflow.Scroll)";
      const symbols = { "App.Width": viewport };
      expect(previewOverflowMode(formula, symbols)).toBe(expected);
      const host = item("Host", [], 0, 0, 100, 100, {
        overflowY: formula, symbols
      });
      const child = item("Child", ["Host"], 0, 0, 100, 180);
      const ranges = previewScrollRanges([host, child]);
      if (range > 0) expect(ranges).toEqual({ Host: { x: 0, y: range } });
      else expect(ranges).not.toHaveProperty("Host");
    });

  it("keeps Switch overflow unknown for SQL, text impostors and missing matches", () => {
    expect(previewOverflowMode(
      "=Switch(true, SQL.CanScroll, LayoutOverflow.Scroll, LayoutOverflow.Hide)"
    )).toBe("unknown");
    expect(previewOverflowMode(
      "=Switch(varPermission, true, LayoutOverflow.Scroll, LayoutOverflow.Hide)"
    )).toBe("unknown");
    expect(previewOverflowMode(
      '=Switch(true, true, "LayoutOverflow.Scroll", LayoutOverflow.Hide)'
    )).toBe("unknown");
    expect(previewOverflowMode(
      '=Switch("scroll", "scroll", LayoutOverflow.Scroll, LayoutOverflow.Hide)'
    )).toBe("unknown");
    expect(previewOverflowMode(
      "=Switch(true, false, LayoutOverflow.Scroll)"
    )).toBe("unknown");
    expect(previewOverflowMode(
      "=Switch(true, false, LayoutOverflow.Scroll, LayoutOverflow.Hide)"
    )).toBe("hide");
    expect(previewOverflowMode(
      "=Switch(true, false, LayoutOverflow.Scroll, If(true, LayoutOverflow.Hide, LayoutOverflow.Scroll))"
    )).toBe("hide");
  });

  it("calculates a vertical scroll range from known child geometry", () => {
    const nodes = [
      item("Host", [], 10, 20, 200, 100, { overflowY: "=LayoutOverflow.Scroll" }),
      item("First", ["Host"], 10, 20, 200, 80),
      item("Second", ["Host"], 10, 100, 200, 100)
    ];
    expect(previewScrollRanges(nodes).Host).toEqual({ x: 0, y: 80 });
  });

  it("scrolls horizontal-only hosts using a vertical wheel delta", () => {
    const range = { x: 140, y: 0 };
    expect(previewWheelScroll({ x: 0, y: 0 }, range, 0, 65)).toEqual({ x: 65, y: 0 });
    expect(previewWheelScroll({ x: 65, y: 0 }, range, 0, 200)).toEqual({ x: 140, y: 0 });
    expect(previewWheelScroll({ x: 140, y: 0 }, range, 0, -300)).toEqual({ x: 0, y: 0 });
  });

  it("never scrolls a hidden or unresolved axis", () => {
    const nodes = [
      item("Host", [], 0, 0, 100, 100, {
        overflowX: "=If(flag, LayoutOverflow.Scroll, LayoutOverflow.Hide)",
        overflowY: "=LayoutOverflow.Hide"
      }),
      item("Child", ["Host"], 0, 0, 500, 500)
    ];
    expect(previewScrollRanges(nodes)).not.toHaveProperty("Host");
  });

  it("rejects unknown geometry rather than inventing an extent", () => {
    const nodes = [
      item("Host", [], 0, 0, 100, 100, { overflowY: "=LayoutOverflow.Scroll" }),
      item("Dynamic", ["Host"], 0, 0, 100, 300, { dynamic: true })
    ];
    expect(previewScrollRanges(nodes)).not.toHaveProperty("Host");
  });

  it("rejects non-finite host origins and negative child dimensions", () => {
    const host = item("Host", [], 0, 0, 100, 100, {
      overflowY: "=LayoutOverflow.Scroll"
    });
    const child = item("Child", ["Host"], 0, 120, 100, 50);
    expect(previewScrollRanges([host, child])).toEqual({
      Host: { x: 0, y: 70 }
    });
    expect(previewScrollRanges([{ ...host, x: NaN }, child]))
      .not.toHaveProperty("Host");
    expect(previewScrollRanges([host, { ...child, height: -50 }]))
      .not.toHaveProperty("Host");
    expect(previewScrollRanges([host, { ...child, width: -10 }]))
      .not.toHaveProperty("Host");
  });

  it("never creates infinite scroll offsets from finite but overflowing extents", () => {
    const host = item("Host", [], 0, 0, 100, 100, {
      overflowX: "=LayoutOverflow.Scroll"
    });
    const enormous = item("Huge", ["Host"], Number.MAX_VALUE, 0,
      Number.MAX_VALUE, 20);
    expect(previewScrollRanges([host, enormous])).not.toHaveProperty("Host");
    const normal = item("Normal", ["Host"], 0, 0, 180, 20);
    expect(previewScrollRanges([host, normal])).toEqual({
      Host: { x: 80, y: 0 }
    });
  });

  it("applies nested offsets to descendants but never to the host itself", () => {
    const outer = item("Outer", [], 10, 20, 200, 200);
    const inner = item("Inner", ["Outer"], 20, 80, 100, 100);
    const leaf = item("Leaf", ["Outer", "Inner"], 40, 130, 20, 20);
    const offsets = { Outer: { x: 0, y: 30 }, Inner: { x: 5, y: 15 } };
    expect(previewScrolledPosition(outer, offsets)).toEqual({ x: 10, y: 20 });
    expect(previewScrolledPosition(inner, offsets)).toEqual({ x: 20, y: 50 });
    expect(previewScrolledPosition(leaf, offsets)).toEqual({ x: 35, y: 85 });
  });

  it("clamps stale viewport offsets and invalid deltas", () => {
    expect(previewClampScroll({ x: 400, y: -5 }, { x: 20, y: 40 }))
      .toEqual({ x: 20, y: 0 });
    expect(previewWheelScroll(undefined, { x: 0, y: 40 }, Infinity, NaN))
      .toEqual({ x: 0, y: 0 });
  });

  it("saturates finite wheel deltas instead of resetting after numeric overflow", () => {
    const horizontalOnly = { x: 140, y: 0 };
    expect(previewWheelScroll({ x: 20, y: 0 }, horizontalOnly,
      Number.MAX_VALUE, Number.MAX_VALUE)).toEqual({ x: 140, y: 0 });
    expect(previewWheelScroll({ x: 120, y: 0 }, horizontalOnly,
      -Number.MAX_VALUE, -Number.MAX_VALUE)).toEqual({ x: 0, y: 0 });
    // Opposite finite deltas cancel; neither may be silently discarded.
    expect(previewWheelScroll({ x: 20, y: 0 }, horizontalOnly,
      Number.MAX_VALUE, -Number.MAX_VALUE)).toEqual({ x: 20, y: 0 });
  });

  it("clamps finite wheel addition overflow on each scroll axis", () => {
    const huge = { x: Number.MAX_VALUE, y: Number.MAX_VALUE };
    expect(previewWheelScroll({ x: Number.MAX_VALUE, y: Number.MAX_VALUE },
      huge, Number.MAX_VALUE, Number.MAX_VALUE)).toEqual(huge);
    expect(previewWheelScroll({ x: 40, y: 50 }, { x: 100, y: 100 },
      Infinity, NaN)).toEqual({ x: 40, y: 50 });
  });

  it("keeps independent nested host scroll ranges", () => {
    const nodes = [
      item("Outer", [], 0, 0, 300, 200, { overflowY: "=LayoutOverflow.Scroll" }),
      item("Inner", ["Outer"], 0, 20, 300, 240, { overflowY: "=LayoutOverflow.Scroll" }),
      item("Leaf", ["Outer", "Inner"], 0, 20, 300, 320)
    ];
    expect(previewScrollRanges(nodes)).toEqual({
      Outer: { x: 0, y: 60 }, Inner: { x: 0, y: 80 }
    });
  });

  it("includes verified trailing auto-layout padding in both scroll axes", () => {
    const host = item("Host", [], 10, 20, 100, 100, {
      overflowX: "=LayoutOverflow.Scroll", overflowY: "=LayoutOverflow.Scroll",
      paddingRight: "=16", paddingBottom: "=24"
    });
    const child = item("Child", ["Host"], 10, 20, 100, 90);
    expect(previewScrollRanges([host, child])).toEqual({
      Host: { x: 16, y: 14 }
    });
    expect(previewScrollRanges([{ ...host, paddingRight: "=0", paddingBottom: "=0" }, child]))
      .not.toHaveProperty("Host");
  });

  it("evaluates viewport-dependent trailing padding without runtime assumptions", () => {
    const host = item("Host", [], 0, 0, 100, 100, {
      overflowY: "=LayoutOverflow.Scroll",
      paddingBottom: "=If(App.Width < 720, 25, 0)"
    });
    const child = item("Child", ["Host"], 0, 0, 100, 90);
    expect(previewScrollRanges([{ ...host, symbols: { "App.Width": 390 } }, child]))
      .toEqual({ Host: { x: 0, y: 15 } });
    expect(previewScrollRanges([{ ...host, symbols: { "App.Width": 1366 } }, child]))
      .not.toHaveProperty("Host");
    expect(previewScrollRanges([host, child])).not.toHaveProperty("Host");
  });

  it("rejects unknown trailing padding only on the scrollable axis", () => {
    const child = item("Child", ["Host"], 0, 0, 100, 180);
    const host = item("Host", [], 0, 0, 100, 100, {
      overflowY: "=LayoutOverflow.Scroll",
      paddingRight: "=unknownHorizontalPadding",
      paddingBottom: "=unknownVerticalPadding"
    });
    expect(previewScrollRanges([host, child])).not.toHaveProperty("Host");
    expect(previewScrollRanges([{ ...host, paddingBottom: "=0" }, child]))
      .toEqual({ Host: { x: 0, y: 80 } });
    expect(previewScrollRanges([{ ...host, paddingBottom: "=-10" }, child]))
      .not.toHaveProperty("Host");
  });
  it("does not invent overflow from an editor Group's serialized bounding box", () => {
    const nodes = [
      item("Host", [], 0, 0, 200, 100, { overflowY: "=LayoutOverflow.Scroll" }),
      item("EditorGroup", ["Host"], 0, 0, 600, 400, { editorGroup: true }),
      item("VisibleChild", ["Host", "EditorGroup"], 0, 0, 100, 90)
    ];
    expect(previewScrollRanges(nodes)).not.toHaveProperty("Host");
  });

  it("counts children through editor Groups using their real coordinates", () => {
    const nodes = [
      item("Host", [], 10, 20, 200, 100, { overflowY: "=LayoutOverflow.Scroll" }),
      item("EditorGroup", ["Host"], 0, 0, 600, 400, {
        editorGroup: true, dynamic: true, overflowY: "=LayoutOverflow.Scroll"
      }),
      item("VisibleChild", ["Host", "EditorGroup"], 10, 20, 100, 180)
    ];
    expect(previewScrollRanges(nodes)).toEqual({ Host: { x: 0, y: 80 } });
    expect(previewScrollRanges(nodes)).not.toHaveProperty("EditorGroup");
  });

  it("does not flatten a real nested container when an editor Group surrounds it", () => {
    const nodes = [
      item("Host", [], 0, 0, 200, 100, { overflowY: "=LayoutOverflow.Scroll" }),
      item("EditorGroup", ["Host"], 0, 0, 600, 400, { editorGroup: true }),
      item("Inner", ["Host", "EditorGroup"], 0, 0, 150, 80, {
        overflowY: "=LayoutOverflow.Scroll"
      }),
      item("Leaf", ["Host", "EditorGroup", "Inner"], 0, 0, 100, 200)
    ];
    expect(previewScrollRanges(nodes)).toEqual({ Inner: { x: 0, y: 120 } });
  });

  it("never treats descendants behind a non-Group ancestor as direct scroll content", () => {
    const nodes = [
      item("Host", [], 0, 0, 200, 100, { overflowY: "=LayoutOverflow.Scroll" }),
      item("Inner", ["Host"], 0, 0, 150, 80),
      item("EditorGroup", ["Host", "Inner"], 0, 0, 600, 400, { editorGroup: true }),
      item("Leaf", ["Host", "Inner", "EditorGroup"], 0, 0, 100, 240)
    ];
    expect(previewScrollRanges(nodes)).not.toHaveProperty("Host");
  });


  it("keeps a verified vertical range when only the hidden horizontal axis overflows", () => {
    const host = item("Host", [], 0, 0, 100, 100, {
      overflowX: "=LayoutOverflow.Hide", overflowY: "=LayoutOverflow.Scroll"
    });
    const child = item("Child", ["Host"], Number.MAX_VALUE, 0,
      Number.MAX_VALUE, 180);
    expect(previewScrollRanges([host, child])).toEqual({ Host: { x: 0, y: 80 } });
  });

  it("keeps a verified horizontal range when only the hidden vertical axis overflows", () => {
    const host = item("Host", [], 0, 0, 100, 100, {
      overflowX: "=LayoutOverflow.Scroll", overflowY: "=LayoutOverflow.Hide"
    });
    const child = item("Child", ["Host"], 0, Number.MAX_VALUE,
      180, Number.MAX_VALUE);
    expect(previewScrollRanges([host, child])).toEqual({ Host: { x: 80, y: 0 } });
  });

  it("indexes many independent scroll hosts without mixing their children", () => {
    // Synthetic Canvas geometry only: no gallery Items, SQL data or identity.
    const count = 2_000;
    const hosts = Array.from({ length: count }, (_, index) =>
      item(`Host${index}`, [], 0, 0, 100, 100, {
        overflowY: "=LayoutOverflow.Scroll"
      }));
    const children = Array.from({ length: count }, (_, index) =>
      item(`Child${index}`, [`Host${index}`], 0, 0, 100, 101 + index));
    const ranges = previewScrollRanges([...hosts, ...children]);
    expect(Object.keys(ranges)).toHaveLength(count);
    expect(ranges.Host0).toEqual({ x: 0, y: 1 });
    expect(ranges.Host999).toEqual({ x: 0, y: 1000 });
    expect(ranges.Host1999).toEqual({ x: 0, y: 2000 });
  });

  it("keeps unknown child geometry local to its own scroll host", () => {
    const nodes = [
      item("Left", [], 0, 0, 100, 100, { overflowY: "=LayoutOverflow.Scroll" }),
      item("Right", [], 200, 0, 100, 100, { overflowY: "=LayoutOverflow.Scroll" }),
      item("Unknown", ["Left"], 0, 0, 100, 250, { dynamic: true }),
      item("Known", ["Right"], 200, 0, 100, 160)
    ];
    expect(previewScrollRanges(nodes)).toEqual({ Right: { x: 0, y: 60 } });
  });

  it("does not count children behind a missing or real intermediate ancestor", () => {
    const host = item("Host", [], 0, 0, 100, 100, {
      overflowY: "=LayoutOverflow.Scroll"
    });
    const hiddenBehindUnknown = item("MissingParentChild",
      ["Host", "MissingParent"], 0, 0, 100, 500);
    const realContainer = item("Nested", ["Host"], 0, 0, 100, 80);
    const nestedChild = item("NestedChild", ["Host", "Nested"], 0, 0, 100, 600);
    expect(previewScrollRanges([host, hiddenBehindUnknown, realContainer, nestedChild]))
      .not.toHaveProperty("Host");
  });

  it("computes scroll ranges for many valid siblings without a Math.max argument overflow", () => {
    const host = item("Host", [], 0, 0, 100, 100, {
      overflowY: "=LayoutOverflow.Scroll"
    });
    // Larger than the engine's safe function-argument count. No SQL rows are
    // generated; these are synthetic layout nodes exercising the extent reducer.
    const children = Array.from({ length: 140_000 }, (_, index) =>
      item(`Child${index}`, ["Host"], 0, index, 100, 10));
    expect(previewScrollRanges([host, ...children]))
      .toEqual({ Host: { x: 0, y: 139_909 } });
  });

});


describe("scroll overlay paint order", () => {
  it("anchors nested scrollbars after their last descendant and before later siblings", () => {
    const nodes = [
      { id: "Outer", ancestors: [] },
      { id: "First", ancestors: ["Outer"] },
      { id: "Inner", ancestors: ["Outer"] },
      { id: "Leaf", ancestors: ["Outer", "Inner"] },
      { id: "LaterSibling", ancestors: [] }
    ];
    const overlays = previewScrollOverlayAnchors(nodes, new Set(["Outer", "Inner"]));
    expect([...overlays.entries()]).toEqual([["Leaf", ["Outer", "Inner"]]]);
    expect(overlays.has("LaterSibling")).toBe(false);
  });

  it("respects filtered visibility and editor groups without inventing descendants", () => {
    const focused = [
      { id: "Host", ancestors: [] },
      { id: "EditorGroup", ancestors: ["Host"] },
      { id: "Child", ancestors: ["Host", "EditorGroup"] },
      { id: "Unrelated", ancestors: [] }
    ];
    expect([...previewScrollOverlayAnchors(focused, new Set(["Host"])).entries()])
      .toEqual([["Child", ["Host"]]]);
    // When focus mode hides descendants, the visible host is its own anchor.
    expect([...previewScrollOverlayAnchors(focused.slice(0, 1), new Set(["Host"])).entries()])
      .toEqual([["Host", ["Host"]]]);
    expect(previewScrollOverlayAnchors(focused, new Set(["Missing"])).size).toBe(0);
  });

  it("indexes thousands of independent hosts without cross-host overlays", () => {
    const count = 2_000;
    const nodes = Array.from({ length: count }, (_, index) => [
      { id: `Host${index}`, ancestors: [] },
      { id: `Leaf${index}`, ancestors: [`Host${index}`] }
    ]).flat();
    const hosts = new Set(Array.from({ length: count }, (_, index) => `Host${index}`));
    const overlays = previewScrollOverlayAnchors(nodes, hosts);
    expect(overlays.size).toBe(count);
    expect(overlays.get("Leaf0")).toEqual(["Host0"]);
    expect(overlays.get("Leaf1999")).toEqual(["Host1999"]);
  });
});
