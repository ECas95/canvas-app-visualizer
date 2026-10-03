export type SourceKind = "msapp" | "yaml";

export interface SourceFile {
  path: string;
  name: string;
  content: string;
  origin: SourceKind;
}

export interface ParseProblem {
  file: string;
  message: string;
  line?: number;
  column?: number;
  severity: "error" | "warning";
}

export interface CanvasControl {
  id: string;
  name: string;
  controlType: string;
  version?: string;
  variant?: string;
  group?: string;
  properties: Record<string, unknown>;
  children: CanvasControl[];
  sourceFile: string;
  sourcePath: string;
  zIndex: number;
}

export interface CanvasScreen {
  id: string;
  name: string;
  properties: Record<string, unknown>;
  children: CanvasControl[];
  sourceFile: string;
}

export interface CanvasComponent {
  id: string;
  name: string;
  properties: Record<string, unknown>;
  children: CanvasControl[];
  sourceFile: string;
}

export interface CanvasAppModel {
  name: string;
  sourceKind: SourceKind;
  files: SourceFile[];
  appProperties: Record<string, unknown>;
  screens: CanvasScreen[];
  components: CanvasComponent[];
  dataSources: string[];
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
}

export interface ImportResult {
  files: SourceFile[];
  sourceKind: SourceKind;
  warnings: string[];
}
