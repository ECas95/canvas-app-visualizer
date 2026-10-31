import { describe, expect, it } from "vitest";
import { staticBoolean, staticString } from "../powerfx/staticEval";
import { parseGallerySnapshotJson, localGalleryRowSymbols, MAX_GALLERY_JSON_BYTES } from "./galleryLocalSnapshot";
import { previewColorWithSymbols, previewDisplayMode } from "./previewAppearance";

describe("local-only gallery JSON", () => {
  it("reads a bounded array of typed record values without mutating sources", () => {
    const data = [
      { Name: "Example module", IsEnabled: true, HasAccess: false,
        AccentColor: "#006064", Count: 3 },
      { Name: "Other module", IsEnabled: false, HasAccess: false,
        AccentColor: "#ccc", Count: 0 }
    ];
    const result = parseGallerySnapshotJson(JSON.stringify(data));
    expect(result.error).toBeNull();
    expect(result.rows?.length).toBe(2);
    const symbols = localGalleryRowSymbols(result.rows![0]);
    expect(staticString("=ThisItem.Name", symbols)).toBe("Example module");
    expect(staticString("=Upper(ThisRecord.Name)", symbols)).toBe("EXAMPLE MODULE");
    expect(staticString('=If(ThisItem.IsEnabled, "AVAILABLE", "UNAVAILABLE")', symbols))
      .toBe("AVAILABLE");
    expect(staticBoolean("=ThisItem.IsEnabled && ThisItem.HasAccess", symbols)).toBe(false);
    expect(previewDisplayMode("=If(ThisItem.HasAccess, DisplayMode.Edit, DisplayMode.Disabled)",
      symbols)).toBe("disabled");
    expect(previewColorWithSymbols("=ThisItem.AccentColor", symbols)).toBe("#006064");
    expect(staticString("=ThisItem.MissingField", symbols)).toBeNull();
  });

  it("never treats a record fixture as access grant or implicit gallery state", () => {
    const parsed = parseGallerySnapshotJson('[{"Name":"Local Example", "HasAccess":true}]');
    expect(parsed.rows).toHaveLength(1);
    expect(Object.prototype.hasOwnProperty.call(parsed.rows![0], "HasAccess")).toBe(true);
    expect(localGalleryRowSymbols(parsed.rows![0])["ThisItem.HasAccess"]).toBe(true);
    // This is only a scalar for source formula inspection; SQL and identity
    // authorization decisions are neither queried nor certified by this module.
  });

  it("rejects nested values, nulls and more than six rows", () => {
    for (const invalid of [
      '{"Name":"single object"}',
      '[]', JSON.stringify(Array.from({ length: 7 }, (_, i) => ({ id: i }))),
      '[{"Name":null}]', '[{"Address":{"Street":"x"}}]',
      '[{"Names":["a", "b"]}]',
      '[true]', '[[]]'
    ]) {
      expect(parseGallerySnapshotJson(invalid).rows).toBeNull();
    }
  });

  it("rejects hostile keys, duplicate case-insensitive fields and oversize data", () => {
    for (const invalid of [
      '[{"__proto__":"yes"}]', '[{"constructor":1}]',
      '[{"ThisItem.Name":1}]', '[{"Name":"A","name":"B"}]',
      '[{"Name":"'+ "x".repeat(513) +'"}]',
      "x".repeat(MAX_GALLERY_JSON_BYTES + 1),
      "not json"
    ]) {
      const parsed = parseGallerySnapshotJson(invalid);
      expect(parsed.rows).toBeNull();
      expect(parsed.error).toBeTruthy();
    }
  });

  it("supports quoted field identifiers without interpreting HTML or CSS", () => {
    const parsed = parseGallerySnapshotJson('[{"Long Detail":"<script>hello</script>"}]');
    expect(parsed.error).toBeNull();
    const symbols = localGalleryRowSymbols(parsed.rows![0]);
    expect(staticString("=ThisItem.'Long Detail'", symbols)).toBe("<script>hello</script>");
    expect(previewColorWithSymbols("=ThisItem.'Long Detail'", symbols)).toBeNull();
  });
});
