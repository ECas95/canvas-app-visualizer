import JSZip from "jszip";
import type {
  AppSourceFormat,
  CanvasSourceFormat,
  ImportResult,
  SourceFile
} from "../../types/canvas";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_SOURCE_FILES = 250;
const MAX_TOTAL_SOURCE_TEXT = 25 * 1024 * 1024;
const MAX_SINGLE_SOURCE_TEXT = 5 * 1024 * 1024;

function normalizedPath(name: string): string {
  return name.replaceAll("\\", "/");
}

export function detectCanvasSourceFormat(name: string): CanvasSourceFormat {
  const lower = normalizedPath(name).toLowerCase();

  if (lower.endsWith(".pa.yaml")) return "pa-yaml-v3";
  if (lower.endsWith(".fx.yaml")) return "fx-yaml-legacy";
  return "unknown-yaml";
}

function isYamlFile(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".pa.yaml") ||
    lower.endsWith(".fx.yaml") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".yml")
  );
}

function isCurrentCanvasSourcePath(path: string): boolean {
  return /(^|\/)src\/.+\.pa\.yaml$/i.test(normalizedPath(path));
}

function isLegacyCanvasSourcePath(path: string): boolean {
  return /(^|\/)src\/.+\.fx\.yaml$/i.test(normalizedPath(path));
}

function aggregateFormat(files: SourceFile[]): AppSourceFormat {
  const formats = new Set(files.map(file => file.format));
  if (formats.size === 1) return files[0]?.format ?? "unknown-yaml";
  return "mixed";
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
      origin: "yaml",
      format: detectCanvasSourceFormat(file.name)
    });
  }

  const sourceFormat = aggregateFormat(sourceFiles);
  const warnings: string[] = [];

  if (
    sourceFormat === "fx-yaml-legacy" ||
    sourceFiles.some(file => file.format === "fx-yaml-legacy")
  ) {
    warnings.push(
      "Legacy .fx.yaml source detected. This retired format is supported for read-only inspection and migration research."
    );
  }

  if (
    sourceFormat === "unknown-yaml" ||
    sourceFiles.some(file => file.format === "unknown-yaml")
  ) {
    warnings.push(
      "Generic YAML file detected. Canvas format will be inferred from its structure where possible."
    );
  }

  return {
    files: sourceFiles,
    sourceKind: "yaml",
    sourceFormat,
    warnings
  };
}

async function readMsapp(file: File): Promise<ImportResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("The .msapp package exceeds the 100 MB local inspection limit.");
  }

  const zip = await JSZip.loadAsync(file);
  const allFiles = Object.values(zip.files).filter(entry => !entry.dir);
  const currentEntries = allFiles.filter(entry => isCurrentCanvasSourcePath(entry.name));
  const legacyEntries = allFiles.filter(entry => isLegacyCanvasSourcePath(entry.name));

  const entries = currentEntries.length > 0 ? currentEntries : legacyEntries;
  const format: CanvasSourceFormat =
    currentEntries.length > 0
      ? "pa-yaml-v3"
      : legacyEntries.length > 0
        ? "fx-yaml-legacy"
        : "unknown-yaml";

  if (entries.length === 0) {
    throw new Error(
      "No Canvas source was found under Src/. Current packages use .pa.yaml. Very old packages may need to be resaved in Power Apps Studio."
    );
  }

  if (entries.length > MAX_SOURCE_FILES) {
    throw new Error(
      "The package contains too many Canvas source files for safe browser inspection."
    );
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
      origin: "msapp",
      format
    });
  }

  if (legacyEntries.length > 0 && currentEntries.length > 0) {
    warnings.push(
      "Both current .pa.yaml and retired .fx.yaml files were found. The visualizer uses current .pa.yaml source and ignores the legacy copy."
    );
  } else if (format === "fx-yaml-legacy") {
    warnings.push(
      "This .msapp contains retired .fx.yaml source. Canvas App Visualizer opened it in legacy read-only compatibility mode."
    );
  }

  const ignoredJsonCount = allFiles.filter(entry =>
    entry.name.toLowerCase().endsWith(".json")
  ).length;

  if (ignoredJsonCount > 0) {
    warnings.push(
      "Package JSON outside the selected Canvas source was ignored because Microsoft does not treat it as stable source code."
    );
  }

  return {
    files: sourceFiles.sort((a, b) => a.path.localeCompare(b.path)),
    sourceKind: "msapp",
    sourceFormat: format,
    warnings
  };
}

export async function importCanvasFiles(files: File[]): Promise<ImportResult> {
  if (files.length === 0) {
    throw new Error(
      "Select a .msapp package or one or more .pa.yaml/.fx.yaml files."
    );
  }

  const msapps = files.filter(file => file.name.toLowerCase().endsWith(".msapp"));
  const yamls = files.filter(file => isYamlFile(file.name));

  if (msapps.length > 1 || (msapps.length === 1 && files.length > 1)) {
    throw new Error(
      "Open one .msapp at a time. YAML source files can be selected together."
    );
  }

  if (msapps.length === 1) {
    return readMsapp(msapps[0]);
  }

  if (yamls.length !== files.length) {
    throw new Error(
      "Unsupported file type. Use .msapp, .pa.yaml, .fx.yaml, .yaml, or .yml."
    );
  }

  return readYamlFiles(yamls);
}
