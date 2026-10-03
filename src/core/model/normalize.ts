import { parseDocument } from "yaml";
import type {
  CanvasAppModel,
  CanvasComponent,
  CanvasControl,
  CanvasScreen,
  ParseProblem,
  SourceFile,
  SourceKind
} from "../../types/canvas";

type AnyRecord = Record<string, unknown>;

function record(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : {};
}

function parseControlType(value: unknown): { type: string; version?: string } {
  if (typeof value !== "string" || value.length === 0) {
    return { type: "Unknown" };
  }
  const at = value.lastIndexOf("@");
  if (at > 0) {
    return { type: value.slice(0, at), version: value.slice(at + 1) };
  }
  return { type: value };
}

function normalizeChildren(
  value: unknown,
  sourceFile: string,
  parentPath: string
): CanvasControl[] {
  if (!Array.isArray(value)) return [];

  const controls: CanvasControl[] = [];

  value.forEach((entry, index) => {
    const map = record(entry);
    const names = Object.keys(map);

    if (names.length !== 1) return;

    const name = names[0];
    const body = record(map[name]);
    const parsedType = parseControlType(body.Control);
    const path = parentPath + "/" + name;

    controls.push({
      id: sourceFile + ":" + path,
      name,
      controlType: parsedType.type,
      version: parsedType.version,
      variant: typeof body.Variant === "string" ? body.Variant : undefined,
      group: typeof body.Group === "string" ? body.Group : undefined,
      properties: record(body.Properties),
      children: normalizeChildren(body.Children, sourceFile, path),
      sourceFile,
      sourcePath: path,
      zIndex: index + 1
    });
  });

  return controls;
}

function problemFromYaml(file: SourceFile, error: unknown): ParseProblem {
  const err = error as {
    message?: string;
    linePos?: Array<{ line?: number; col?: number }>;
  };
  const pos = err.linePos?.[0];
  return {
    file: file.path,
    message: err.message ?? String(error),
    line: pos?.line,
    column: pos?.col,
    severity: "error"
  };
}

export function buildCanvasModel(
  files: SourceFile[],
  sourceKind: SourceKind,
  appName = "Canvas App"
): CanvasAppModel {
  const problems: ParseProblem[] = [];
  const appProperties: Record<string, unknown> = {};
  const screens: CanvasScreen[] = [];
  const components: CanvasComponent[] = [];
  const dataSources = new Set<string>();

  for (const file of files) {
    const document = parseDocument(file.content, {
      prettyErrors: true,
      uniqueKeys: true
    });

    for (const error of document.errors) {
      problems.push(problemFromYaml(file, error));
    }
    for (const warning of document.warnings) {
      problems.push({
        ...problemFromYaml(file, warning),
        severity: "warning"
      });
    }

    if (document.errors.length > 0) continue;

    const root = record(document.toJS());

    Object.assign(appProperties, record(record(root.App).Properties));

    const screenMap = record(root.Screens);
    for (const [name, rawScreen] of Object.entries(screenMap)) {
      const body = record(rawScreen);
      screens.push({
        id: file.path + ":screen:" + name,
        name,
        properties: record(body.Properties),
        children: normalizeChildren(body.Children, file.path, "Screens/" + name),
        sourceFile: file.path
      });
    }

    const componentMap = record(root.ComponentDefinitions);
    for (const [name, rawComponent] of Object.entries(componentMap)) {
      const body = record(rawComponent);
      components.push({
        id: file.path + ":component:" + name,
        name,
        properties: record(body.Properties),
        children: normalizeChildren(body.Children, file.path, "ComponentDefinitions/" + name),
        sourceFile: file.path
      });
    }

    const sources = record(root.DataSources);
    Object.keys(sources).forEach(name => dataSources.add(name));
  }

  if (screens.length === 0 && problems.length === 0) {
    problems.push({
      file: files[0]?.path ?? "unknown",
      message: "No Screens node was found in the selected source.",
      severity: "warning"
    });
  }

  return {
    name: appName,
    sourceKind,
    files,
    appProperties,
    screens,
    components,
    dataSources: [...dataSources].sort(),
    problems
  };
}
