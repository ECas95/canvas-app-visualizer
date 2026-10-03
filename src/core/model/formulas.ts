import type {
  CanvasAppModel,
  CanvasControl,
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
  sourceFile?: string
): FormulaRef[] {
  return Object.entries(properties)
    .filter(([, value]) => isFormula(value))
    .map(([property, value]) => ({
      formula: value as string,
      property,
      ownerName,
      ownerType,
      controlPath,
      sourceFile
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
        control.sourceFile
      )
    );
    refs.push(...walkControls(control.children));
  }
  return refs;
}

export function collectFormulaRefs(app: CanvasAppModel): FormulaRef[] {
  const refs: FormulaRef[] = [];

  refs.push(
    ...collectProperties(app.appProperties, "App", "app", "App", "App.pa.yaml")
  );

  for (const screen of app.screens) {
    refs.push(
      ...collectProperties(
        screen.properties,
        screen.name,
        "screen",
        "Screens/" + screen.name,
        screen.sourceFile
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
        component.sourceFile
      )
    );
    refs.push(...walkControls(component.children));
  }

  return refs;
}

export function countControls(app: CanvasAppModel): number {
  const count = (controls: CanvasControl[]): number =>
    controls.reduce((sum, control) => sum + 1 + count(control.children), 0);

  return app.screens.reduce((sum, screen) => sum + count(screen.children), 0) +
    app.components.reduce((sum, component) => sum + count(component.children), 0);
}
