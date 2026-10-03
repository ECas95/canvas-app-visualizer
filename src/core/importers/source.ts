import JSZip from "jszip";
import type { ImportResult, SourceFile } from "../../types/canvas";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_SOURCE_FILES = 250;
const MAX_TOTAL_SOURCE_TEXT = 25 * 1024 * 1024;
const MAX_SINGLE_SOURCE_TEXT = 5 * 1024 * 1024;

function isYamlFile(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".pa.yaml") || lower.endsWith(".yaml") || lower.endsWith(".yml");
}

function isCanvasSourcePath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  return /(^|\/)src\/.+\.pa\.yaml$/i.test(normalized);
}

async function readYamlFiles(files: File[]): Promise<ImportResult> {
  const sourceFiles: SourceFile[] = [];
  let total = 0;

  for (const file of files) {
    const content = await file.text();
    if (content.length > MAX_SINGLE_SOURCE_TEXT) {
      throw new Error("Source file is too large: " + file.name);
    }
    total += content.length;
    if (total > MAX_TOTAL_SOURCE_TEXT) {
      throw new Error("Combined YAML source exceeds the safe local inspection limit.");
    }
    sourceFiles.push({
      path: file.name,
      name: file.name.split("/").pop() ?? file.name,
      content,
      origin: "yaml"
    });
  }

  return {
    files: sourceFiles,
    sourceKind: "yaml",
    warnings: []
  };
}

async function readMsapp(file: File): Promise<ImportResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("The .msapp package exceeds the 100 MB local inspection limit.");
  }

  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter(
    entry => !entry.dir && isCanvasSourcePath(entry.name)
  );

  if (entries.length === 0) {
    throw new Error(
      "No active .pa.yaml source was found under Src/. Older packages may need to be resaved in Power Apps Studio."
    );
  }

  if (entries.length > MAX_SOURCE_FILES) {
    throw new Error("The package contains too many Canvas source files for safe browser inspection.");
  }

  const warnings: string[] = [];
  const sourceFiles: SourceFile[] = [];
  let total = 0;

  for (const entry of entries) {
    const internal = entry as typeof entry & {
      _data?: { uncompressedSize?: number };
    };
    const declaredSize = internal._data?.uncompressedSize;
    if (declaredSize && declaredSize > MAX_SINGLE_SOURCE_TEXT) {
      throw new Error("Source file is too large after extraction: " + entry.name);
    }

    const content = await entry.async("string");
    if (content.length > MAX_SINGLE_SOURCE_TEXT) {
      throw new Error("Source file is too large after extraction: " + entry.name);
    }

    total += content.length;
    if (total > MAX_TOTAL_SOURCE_TEXT) {
      throw new Error("Expanded Canvas source exceeds the safe local inspection limit.");
    }

    sourceFiles.push({
      path: entry.name,
      name: entry.name.split("/").pop() ?? entry.name,
      content,
      origin: "msapp"
    });
  }

  const unstableJsonCount = Object.values(zip.files).filter(
    entry => !entry.dir && entry.name.toLowerCase().endsWith(".json")
  ).length;
  if (unstableJsonCount > 0) {
    warnings.push(
      "Non-Src JSON package files were intentionally ignored because they are not treated as stable Canvas source."
    );
  }

  return {
    files: sourceFiles.sort((a, b) => a.path.localeCompare(b.path)),
    sourceKind: "msapp",
    warnings
  };
}

export async function importCanvasFiles(files: File[]): Promise<ImportResult> {
  if (files.length === 0) {
    throw new Error("Select a .msapp package or one or more .pa.yaml files.");
  }

  const msapps = files.filter(file => file.name.toLowerCase().endsWith(".msapp"));
  const yamls = files.filter(file => isYamlFile(file.name));

  if (msapps.length > 1 || (msapps.length === 1 && files.length > 1)) {
    throw new Error("Open one .msapp at a time. YAML source files can be selected together.");
  }

  if (msapps.length === 1) {
    return readMsapp(msapps[0]);
  }

  if (yamls.length !== files.length) {
    throw new Error("Unsupported file type. Use .msapp, .pa.yaml, .yaml, or .yml.");
  }

  return readYamlFiles(yamls);
}
