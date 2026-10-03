import { parseDocument } from "yaml";
import type {
  AppSourceFormat,
  CanvasAppModel,
  CanvasComponent,
  CanvasControl,
  CanvasEditorState,
  CanvasScreen,
  CanvasSourceFormat,
  ParseProblem,
  SourceFile,
  SourceKind
} from "../../types/canvas";
import { validatePaYamlObject } from "../schema/validatePaYaml";

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

function formulaInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^=\s*(-?\d+)\s*$/);
  return match ? Number(match[1]) : null;
}

function normalizeModernChildren(
  value: unknown,
  sourceFile: string,
  parentPath: string,
  sourceFormat: CanvasSourceFormat
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
      layout: typeof body.Layout === "string" ? body.Layout : undefined,
      group: typeof body.Group === "string" ? body.Group : undefined,
      componentName:
        typeof body.ComponentName === "string" ? body.ComponentName : undefined,
      componentLibraryUniqueName:
        typeof body.ComponentLibraryUniqueName === "string"
          ? body.ComponentLibraryUniqueName
          : undefined,
      metadataKey:
        typeof body.MetadataKey === "string" ? body.MetadataKey : undefined,
      isLocked: typeof body.IsLocked === "boolean" ? body.IsLocked : undefined,
      properties: record(body.Properties),
      children: normalizeModernChildren(
        body.Children,
        sourceFile,
        path,
        sourceFormat
      ),
      sourceFile,
      sourcePath: path,
      zIndex: index + 1,
      sourceFormat
    });
  });

  return controls;
}

function stripLegacyQuotedName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  return trimmed;
}

export function splitLegacyDeclaration(
  key: string
): { name: string; type: string } | null {
  let parenDepth = 0;
  let singleQuoted = false;

  for (let index = 0; index <= key.length - 4; index += 1) {
    const char = key[index];

    if (char === "'") {
      if (singleQuoted && key[index + 1] === "'") {
        index += 1;
        continue;
      }
      singleQuoted = !singleQuoted;
      continue;
    }

    if (singleQuoted) continue;

    if (char === "(") {
      parenDepth += 1;
      continue;
    }
    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }

    if (parenDepth === 0 && key.slice(index, index + 4) === " As ") {
      const name = stripLegacyQuotedName(key.slice(0, index));
      const type = stripLegacyQuotedName(key.slice(index + 4));
      if (!name || !type) return null;
      return { name, type };
    }
  }

  return null;
}

function legacyBodyParts(body: AnyRecord): {
  properties: Record<string, unknown>;
  children: Array<[string, AnyRecord, { name: string; type: string }]>;
} {
  const properties: Record<string, unknown> = {};
  const children: Array<
    [string, AnyRecord, { name: string; type: string }]
  > = [];

  for (const [key, value] of Object.entries(body)) {
    const declaration = splitLegacyDeclaration(key);
    if (declaration && value && typeof value === "object" && !Array.isArray(value)) {
      children.push([key, record(value), declaration]);
    } else {
      properties[key] = value;
    }
  }

  return { properties, children };
}

function flattenLegacyFormulaProperties(
  value: unknown,
  prefix = "",
  output: Record<string, unknown> = {}
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (prefix) output[prefix] = value;
    return output;
  }

  for (const [key, child] of Object.entries(value as AnyRecord)) {
    const path = prefix ? prefix + "." + key : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flattenLegacyFormulaProperties(child, path, output);
    } else {
      output[path] = child;
    }
  }

  return output;
}

function normalizeLegacyChildren(
  body: AnyRecord,
  sourceFile: string,
  parentPath: string
): CanvasControl[] {
  const { children } = legacyBodyParts(body);

  return children
    .map(([, childBody, declaration], index) => {
      const { properties } = legacyBodyParts(childBody);
      const path = parentPath + "/" + declaration.name;
      const explicitZ = formulaInteger(properties.ZIndex);

      return {
        id: sourceFile + ":" + path,
        name: declaration.name,
        controlType: declaration.type,
        properties,
        children: normalizeLegacyChildren(childBody, sourceFile, path),
        sourceFile,
        sourcePath: path,
        zIndex: explicitZ ?? index + 1,
        sourceFormat: "fx-yaml-legacy" as const
      };
    })
    .sort((a, b) => a.zIndex - b.zIndex);
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
    severity: "error",
    source: "yaml"
  };
}

function inferFormat(
  file: SourceFile,
  root: AnyRecord
): CanvasSourceFormat {
  if (file.format !== "unknown-yaml") return file.format;

  const modernKeys = [
    "App",
    "Screens",
    "ComponentDefinitions",
    "DataSources",
    "EditorState"
  ];
  if (Object.keys(root).some(key => modernKeys.includes(key))) {
    return "pa-yaml-v3";
  }

  if (Object.keys(root).some(key => splitLegacyDeclaration(key))) {
    return "fx-yaml-legacy";
  }

  return "unknown-yaml";
}

function combineFormats(files: SourceFile[]): AppSourceFormat {
  const formats = new Set(files.map(file => file.format));
  if (formats.size === 1) return files[0]?.format ?? "unknown-yaml";
  return "mixed";
}

function mergeEditorState(
  current: CanvasEditorState | undefined,
  raw: unknown
): CanvasEditorState {
  const state = record(raw);

  return {
    screensOrder: [
      ...(current?.screensOrder ?? []),
      ...(Array.isArray(state.ScreensOrder)
        ? state.ScreensOrder.filter(
            (value): value is string => typeof value === "string"
          )
        : [])
    ],
    componentDefinitionsOrder: [
      ...(current?.componentDefinitionsOrder ?? []),
      ...(Array.isArray(state.ComponentDefinitionsOrder)
        ? state.ComponentDefinitionsOrder.filter(
            (value): value is string => typeof value === "string"
          )
        : [])
    ]
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
  const resolvedFiles: SourceFile[] = [];
  let editorState: CanvasEditorState | undefined;

  for (const originalFile of files) {
    const document = parseDocument(originalFile.content, {
      prettyErrors: true,
      uniqueKeys: true
    });

    for (const error of document.errors) {
      problems.push(problemFromYaml(originalFile, error));
    }
    for (const warning of document.warnings) {
      problems.push({
        ...problemFromYaml(originalFile, warning),
        severity: "warning"
      });
    }

    if (document.errors.length > 0) {
      resolvedFiles.push(originalFile);
      continue;
    }

    const root = record(document.toJS());
    const format = inferFormat(originalFile, root);
    const file: SourceFile = { ...originalFile, format };
    resolvedFiles.push(file);

    if (format === "pa-yaml-v3") {
      problems.push(...validatePaYamlObject(root, file));

      Object.assign(appProperties, record(record(root.App).Properties));

      const screenMap = record(root.Screens);
      for (const [name, rawScreen] of Object.entries(screenMap)) {
        const body = record(rawScreen);
        screens.push({
          id: file.path + ":screen:" + name,
          name,
          properties: record(body.Properties),
          children: normalizeModernChildren(
            body.Children,
            file.path,
            "Screens/" + name,
            format
          ),
          sourceFile: file.path,
          sourceFormat: format
        });
      }

      const componentMap = record(root.ComponentDefinitions);
      for (const [name, rawComponent] of Object.entries(componentMap)) {
        const body = record(rawComponent);
        components.push({
          id: file.path + ":component:" + name,
          name,
          definitionType:
            typeof body.DefinitionType === "string"
              ? body.DefinitionType
              : undefined,
          properties: record(body.Properties),
          children: normalizeModernChildren(
            body.Children,
            file.path,
            "ComponentDefinitions/" + name,
            format
          ),
          sourceFile: file.path,
          sourceFormat: format
        });
      }

      const sources = record(root.DataSources);
      Object.keys(sources).forEach(name => dataSources.add(name));

      if (root.EditorState) {
        editorState = mergeEditorState(editorState, root.EditorState);
      }

      continue;
    }

    if (format === "fx-yaml-legacy") {
      for (const [rawKey, rawBody] of Object.entries(root)) {
        const declaration = splitLegacyDeclaration(rawKey);
        if (!declaration) continue;

        const body = record(rawBody);
        const type = declaration.type.toLowerCase();

        if (type === "appinfo") {
          Object.assign(
            appProperties,
            flattenLegacyFormulaProperties(body)
          );
          continue;
        }

        if (type === "screen") {
          const { properties } = legacyBodyParts(body);
          screens.push({
            id: file.path + ":screen:" + declaration.name,
            name: declaration.name,
            properties,
            children: normalizeLegacyChildren(
              body,
              file.path,
              "Screens/" + declaration.name
            ),
            sourceFile: file.path,
            sourceFormat: format
          });
          continue;
        }

        if (type === "canvascomponent") {
          const { properties } = legacyBodyParts(body);
          components.push({
            id: file.path + ":component:" + declaration.name,
            name: declaration.name,
            definitionType: "CanvasComponent",
            properties: flattenLegacyFormulaProperties(properties),
            children: normalizeLegacyChildren(
              body,
              file.path,
              "ComponentDefinitions/" + declaration.name
            ),
            sourceFile: file.path,
            sourceFormat: format
          });
        }
      }

      continue;
    }

    problems.push({
      file: file.path,
      message:
        "The YAML parsed successfully, but its Canvas source format could not be identified.",
      severity: "warning",
      source: "format"
    });
  }

  if (screens.length === 0 && problems.length === 0) {
    problems.push({
      file: resolvedFiles[0]?.path ?? "unknown",
      message: "No Canvas screen definition was found in the selected source.",
      severity: "warning",
      source: "format"
    });
  }

  if (editorState?.screensOrder.length) {
    const order = new Map(
      editorState.screensOrder.map((name, index) => [name, index])
    );
    screens.sort(
      (a, b) =>
        (order.get(a.name) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.name) ?? Number.MAX_SAFE_INTEGER)
    );
  }

  return {
    name: appName,
    sourceKind,
    sourceFormat: combineFormats(resolvedFiles),
    files: resolvedFiles,
    appProperties,
    screens,
    components,
    dataSources: [...dataSources].sort(),
    editorState,
    problems
  };
}
