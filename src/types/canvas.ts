export type SourceKind = "msapp" | "yaml";
export type CanvasSourceFormat =
  | "pa-yaml-v3"
  | "fx-yaml-legacy"
  | "unknown-yaml";

export type AppSourceFormat = CanvasSourceFormat | "mixed";

export interface SourceFile {
  path: string;
  name: string;
  content: string;
  origin: SourceKind;
  format: CanvasSourceFormat;
}

export interface ParseProblem {
  file: string;
  message: string;
  line?: number;
  column?: number;
  path?: string;
  severity: "error" | "warning";
  source?: "yaml" | "schema" | "format";
}

export interface CanvasControl {
  id: string;
  name: string;
  controlType: string;
  version?: string;
  variant?: string;
  layout?: string;
  group?: string;
  componentName?: string;
  componentLibraryUniqueName?: string;
  metadataKey?: string;
  isLocked?: boolean;
  properties: Record<string, unknown>;
  children: CanvasControl[];
  sourceFile: string;
  sourcePath: string;
  zIndex: number;
  sourceFormat: CanvasSourceFormat;
}

export interface CanvasScreen {
  id: string;
  name: string;
  properties: Record<string, unknown>;
  children: CanvasControl[];
  sourceFile: string;
  sourceFormat: CanvasSourceFormat;
}

export interface CanvasComponent {
  id: string;
  name: string;
  definitionType?: string;
  properties: Record<string, unknown>;
  children: CanvasControl[];
  sourceFile: string;
  sourceFormat: CanvasSourceFormat;
}

export interface CanvasEditorState {
  screensOrder: string[];
  componentDefinitionsOrder: string[];
}

export interface CanvasAppModel {
  name: string;
  sourceKind: SourceKind;
  sourceFormat: AppSourceFormat;
  files: SourceFile[];
  appProperties: Record<string, unknown>;
  screens: CanvasScreen[];
  components: CanvasComponent[];
  dataSources: string[];
  editorState?: CanvasEditorState;
  problems: ParseProblem[];
}

export type FindingSeverity = "error" | "warning" | "info";
export type FindingCategory =
  | "syntax"
  | "delegation"
  | "performance"
  | "maintainability"
  | "accessibility"
  | "structure";

export interface Finding {
  id: string;
  ruleId: string;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  message: string;
  suggestion?: string;
  confidence: "high" | "medium" | "low";
  sourceFile?: string;
  controlPath?: string;
  property?: string;
  formula?: string;
}

export interface FormulaRef {
  formula: string;
  property: string;
  ownerName: string;
  ownerType: "app" | "screen" | "control" | "component";
  controlPath: string;
  sourceFile?: string;
  sourceFormat?: CanvasSourceFormat;
}

export interface ImportResult {
  files: SourceFile[];
  sourceKind: SourceKind;
  sourceFormat: AppSourceFormat;
  warnings: string[];
}
