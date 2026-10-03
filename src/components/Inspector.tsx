import type { CanvasControl, CanvasScreen } from "../types/canvas";

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

export function Inspector({ selection }: Props) {
  if (!selection) {
    return (
      <div className="inspector-empty">
        Select a screen or control to inspect its serialized properties.
      </div>
    );
  }

  const properties = selection.value.properties;
  const type =
    selection.kind === "screen" ? "Screen" : selection.value.controlType;

  return (
    <div className="inspector">
      <div className="inspector-title">
        <span>{type}</span>
        <strong>{selection.value.name}</strong>
      </div>

      {selection.kind === "control" && (
        <dl className="meta-grid">
          <dt>Path</dt>
          <dd>{selection.value.sourcePath}</dd>
          <dt>Source</dt>
          <dd>{selection.value.sourceFile}</dd>
          <dt>Version</dt>
          <dd>{selection.value.version ?? "not serialized"}</dd>
          <dt>Variant</dt>
          <dd>{selection.value.variant ?? "—"}</dd>
        </dl>
      )}

      <div className="property-list">
        {Object.keys(properties).length === 0 && (
          <p className="muted">No serialized properties.</p>
        )}
        {Object.entries(properties)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, value]) => (
            <div className="property-row" key={name}>
              <strong>{name}</strong>
              <code>{valueText(value)}</code>
            </div>
          ))}
      </div>
    </div>
  );
}
