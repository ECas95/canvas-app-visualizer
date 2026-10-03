import type { CanvasControl, CanvasScreen } from "../types/canvas";
import { Icon } from "./Icon";

type Selection =
  | { kind: "screen"; value: CanvasScreen }
  | { kind: "control"; value: CanvasControl };

interface Props {
  selection?: Selection;
}

function valueText(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function isFormula(value: unknown): boolean {
  return typeof value === "string" && value.trimStart().startsWith("=");
}

export function Inspector({ selection }: Props) {
  if (!selection) {
    return (
      <div className="inspector-empty">
        <Icon name="properties" size={22} />
        <strong>Nothing selected</strong>
        <span>Select a screen or control to inspect its serialized properties.</span>
      </div>
    );
  }

  const properties = selection.value.properties;
  const propertyEntries = Object.entries(properties).sort(([a], [b]) => a.localeCompare(b));
  const formulaCount = propertyEntries.filter(([, value]) => isFormula(value)).length;
  const type =
    selection.kind === "screen" ? "Screen" : selection.value.controlType;

  return (
    <div className="inspector">
      <div className="inspector-title">
        <span className="panel-kicker">{type}</span>
        <strong>{selection.value.name}</strong>
        <span className="inspector-subtitle">
          {propertyEntries.length} serialized properties · {formulaCount} formulas
        </span>
      </div>

      {selection.kind === "control" && (
        <dl className="meta-grid">
          <dt>Path</dt>
          <dd>{selection.value.sourcePath}</dd>
          <dt>Source</dt>
          <dd>{selection.value.sourceFile}</dd>
          <dt>Version</dt>
          <dd>{selection.value.version ?? "Not serialized"}</dd>
          <dt>Variant</dt>
          <dd>{selection.value.variant ?? "—"}</dd>
          <dt>Layout</dt>
          <dd>{selection.value.layout ?? "—"}</dd>
          <dt>Component</dt>
          <dd>{selection.value.componentName ?? "—"}</dd>
          <dt>Format</dt>
          <dd>{selection.value.sourceFormat}</dd>
        </dl>
      )}

      <div className="property-list">
        {propertyEntries.length === 0 && (
          <p className="muted">No serialized properties.</p>
        )}
        {propertyEntries.map(([name, value]) => (
          <div className={"property-row" + (isFormula(value) ? " formula" : "")} key={name}>
            <div className="property-name-row">
              <strong>{name}</strong>
              {isFormula(value) && <span>Power Fx</span>}
            </div>
            <code>{valueText(value)}</code>
          </div>
        ))}
      </div>
    </div>
  );
}
