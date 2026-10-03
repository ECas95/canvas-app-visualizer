import type {
  CanvasAppModel,
  CanvasControl,
  CanvasSourceFormat,
  FormulaRef
} from "../../types/canvas";

function isFormula(value: unknown): value is string {
  return typeof value === "string" && value.trimStart().startsWith("=");
}

function collectProperties(
  properties: Record<string, unknown>,
  ownerName: string,
  ownerType: FormulaRef["ownerType"],
  controlPath: string,
  sourceFile?: string,
  sourceFormat?: CanvasSourceFormat
): FormulaRef[] {
  return Object.entries(properties)
    .filter(([, value]) => isFormula(value))
    .map(([property, value]) => ({
      formula: value as string,
      property,
      ownerName,
      ownerType,
      controlPath,
      sourceFile,
      sourceFormat
    }));
}

function walkControls(controls: CanvasControl[]): FormulaRef[] {
  const refs: FormulaRef[] = [];

  for (const control of controls) {
    refs.push(
      ...collectProperties(
        control.properties,
        control.name,
        "control",
        control.sourcePath,
        control.sourceFile,
        control.sourceFormat
      )
    );
    refs.push(...walkControls(control.children));
  }

  return refs;
}

function appSource(app: CanvasAppModel): {
  file?: string;
  format?: CanvasSourceFormat;
} {
  const current = app.files.find(file =>
    file.name.toLowerCase().endsWith("app.pa.yaml")
  );
  if (current) return { file: current.path, format: current.format };

  const legacy = app.files.find(file =>
    /(^|\/)app\.fx\.yaml$/i.test(file.path.replaceAll("\\", "/"))
  );
  if (legacy) return { file: legacy.path, format: legacy.format };

  return {
    file: app.files[0]?.path,
    format: app.files[0]?.format
  };
}

export function collectFormulaRefs(app: CanvasAppModel): FormulaRef[] {
  const refs: FormulaRef[] = [];
  const appFile = appSource(app);

  refs.push(
    ...collectProperties(
      app.appProperties,
      "App",
      "app",
      "App",
      appFile.file,
      appFile.format
    )
  );

  for (const screen of app.screens) {
    refs.push(
      ...collectProperties(
        screen.properties,
        screen.name,
        "screen",
        "Screens/" + screen.name,
        screen.sourceFile,
        screen.sourceFormat
      )
    );
    refs.push(...walkControls(screen.children));
  }

  for (const component of app.components) {
    refs.push(
      ...collectProperties(
        component.properties,
        component.name,
        "component",
        "ComponentDefinitions/" + component.name,
        component.sourceFile,
        component.sourceFormat
      )
    );
    refs.push(...walkControls(component.children));
  }

  return refs;
}

export function countControls(app: CanvasAppModel): number {
  const count = (controls: CanvasControl[]): number =>
    controls.reduce(
      (sum, control) => sum + 1 + count(control.children),
      0
    );

  return (
    app.screens.reduce(
      (sum, screen) => sum + count(screen.children),
      0
    ) +
    app.components.reduce(
      (sum, component) => sum + count(component.children),
      0
    )
  );
}
