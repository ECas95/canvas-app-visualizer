import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { importCanvasFiles } from "./source";

async function msapp(
  entries: Record<string, string>
): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) {
    zip.file(path, content);
  }

  const bytes = await zip.generateAsync({ type: "uint8array" });
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  return new File([buffer], "sample.msapp", {
    type: "application/octet-stream"
  });
}

describe("Canvas source importer", () => {
  it("prefers current pa.yaml when a package contains current and retired source", async () => {
    const file = await msapp({
      "Src/App.pa.yaml": "App:\n  Properties:\n    StartScreen: =Home\n",
      "Src/Home.pa.yaml": "Screens:\n  Home:\n    Children: []\n",
      "Src/App.fx.yaml": "App As appinfo:\n    BackEnabled: =false\n",
      "Resources/PublishInfo.json": "{}"
    });

    const result = await importCanvasFiles([file]);

    expect(result.sourceFormat).toBe("pa-yaml-v3");
    expect(result.files).toHaveLength(2);
    expect(result.files.every(item => item.path.endsWith(".pa.yaml"))).toBe(true);
    expect(result.warnings.join(" ")).toContain("Both current .pa.yaml");
  });

  it("opens public-era retired fx.yaml package shapes in compatibility mode", async () => {
    const file = await msapp({
      "Src/App.fx.yaml": "App As appinfo:\n    BackEnabled: =false\n",
      "Src/Screen1.fx.yaml": [
        "Screen1 As screen:",
        "    Label1 As label:",
        '        Text: ="Hello"',
        "        ZIndex: =1"
      ].join("\n")
    });

    const result = await importCanvasFiles([file]);

    expect(result.sourceFormat).toBe("fx-yaml-legacy");
    expect(result.files).toHaveLength(2);
    expect(result.warnings.join(" ")).toContain("legacy read-only compatibility");
  });

  it("rejects packages with no Canvas source under Src", async () => {
    const file = await msapp({
      "Resources/PublishInfo.json": "{}"
    });

    await expect(importCanvasFiles([file])).rejects.toThrow(
      "No Canvas source was found"
    );
  });
});
