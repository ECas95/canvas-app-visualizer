import { describe, expect, it } from "vitest";
import { previewSvgTextWindow } from "./previewSvgTextWindow";

describe("source-only SVG line breaks", () => {
  it("preserves LF, CRLF and standalone CR as separate Canvas text lines", () => {
    const result = previewSvgTextWindow("First\rSecond\r\nThird\nFourth", 200, 20, "top");
    expect(result).toEqual({
      lines: ["First", "Second", "Third", "Fourth"],
      firstIndex: 0,
      totalLines: 4
    });
  });

  it("keeps trailing and consecutive source line breaks instead of merging text", () => {
    const result = previewSvgTextWindow("One\r\r\nTwo\r", 200, 20, "top");
    expect(result.lines).toEqual(["One", "", "Two", ""]);
    expect(result.totalLines).toBe(4);
  });

  it.each(["top", "middle", "bottom"] as const)(
    "selects the correct %s window for CR-only multiline labels",
    align => {
      const text = Array.from({ length: 9 }, (_, index) => `Line ${index + 1}`).join("\r");
      const result = previewSvgTextWindow(text, 24, 12, align);
      expect(result.totalLines).toBe(9);
      expect(result.lines).toHaveLength(5);
      const expectedStart = align === "top" ? 0 : align === "middle" ? 2 : 4;
      expect(result.firstIndex).toBe(expectedStart);
      expect(result.lines[0]).toBe(`Line ${expectedStart + 1}`);
      expect(result.lines.at(-1)).toBe(`Line ${expectedStart + 5}`);
    }
  );
});
