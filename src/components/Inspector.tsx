import { useState } from "react";
import type { CanvasControl, CanvasScreen } from "../types/canvas";
import { Icon } from "./Icon";

type Selection =
  | { kind: "screen"; value: CanvasScreen }
  | { kind: "control"; value: CanvasControl };

interface Props {
  selection?: Selection;
}

export interface InspectorProperty {
  name: string;
  value: unknown;
  formula: boolean;
}

export function formatSerializedValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    // An imported YAML alias may be cyclic; the inspector must never crash.
    return "[Value cannot be serialized]";
  }
}

export function inspectProperties(properties: Record<string, unknown>): InspectorProperty[] {
  return Object.entries(properties)
    .map(([name, value]) => ({
      name, value,
      formula: typeof value === "string" && value.trimStart().startsWith("=")
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Searches only local serialized source. No Power Fx formula is evaluated. */
export function filterInspectorProperties(
  entries: InspectorProperty[], query: string, formulasOnly: boolean
): InspectorProperty[] {
  const term = query.trim().toLowerCase();
  return entries.filter(entry =>
    (!formulasOnly || entry.formula) &&
    (!term || entry.name.toLowerCase().includes(term) ||
      formatSerializedValue(entry.value).toLowerCase().includes(term))
  );
}

const GEOMETRY_NAMES = ["X", "Y", "Width", "Height"] as const;

/** Only show properties actually present in the source, never inferred defaults. */
export function serializedGeometry(entries: InspectorProperty[]): InspectorProperty[] {
  return GEOMETRY_NAMES.flatMap(name => entries.filter(entry => entry.name === name));
}

export function Inspector({ selection }: Props) {
  const [query, setQuery] = useState("");
  const [formulasOnly, setFormulasOnly] = useState(false);

  if (!selection) {
    return (
      <div className="inspector-empty">
        <Icon name="properties" size={22} />
        <strong>Nothing selected</strong>
        <span>Select a screen or control to inspect its serialized properties.</span>
      </div>
    );
  }

  const entries = inspectProperties(selection.value.properties);
  const formulaCount = entries.filter(entry => entry.formula).length;
  const filtered = filterInspectorProperties(entries, query, formulasOnly);
  const geometry = serializedGeometry(entries);
  const type = selection.kind === "screen" ? "Screen" : selection.value.controlType;

  return (
    <div className="inspector">
      <div className="inspector-title">
        <span className="panel-kicker">{type}</span>
        <strong>{selection.value.name}</strong>
        <span className="inspector-subtitle">
          {entries.length} serialized properties · {formulaCount} formulas
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

      {geometry.length > 0 && (
        <section className="inspector-geometry" aria-label="Serialized geometry">
          <div className="inspector-section-heading">
            <strong>Serialized geometry</strong>
            <span>Source values · not evaluated</span>
          </div>
          <dl className="inspector-geometry-grid">
            {geometry.map(entry => (
              <div className="inspector-geometry-item" key={entry.name}>
                <dt>{entry.name}{entry.formula && <span title="Power Fx formula">ƒx</span>}</dt>
                <dd><code>{formatSerializedValue(entry.value)}</code></dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="inspector-section-heading">
        <strong>Properties</strong>
        <span>{filtered.length} of {entries.length} shown</span>
      </div>
      <div className="inspector-property-toolbar">
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          aria-label="Search serialized properties"
          placeholder="Search names or source values"
        />
        <button
          type="button"
          className={formulasOnly ? "active" : ""}
          aria-pressed={formulasOnly}
          onClick={() => setFormulasOnly(current => !current)}
        >
          Formulas only <span>{formulaCount}</span>
        </button>
      </div>
      <div className="property-list">
        {entries.length === 0 && <p className="muted">No serialized properties.</p>}
        {entries.length > 0 && filtered.length === 0 && (
          <div className="inspector-no-results">
            <p>No properties match these filters.</p>
            <button type="button" onClick={() => {
              setQuery("");
              setFormulasOnly(false);
            }}>Clear filters</button>
          </div>
        )}
        {filtered.map(entry => (
          <div className={"property-row" + (entry.formula ? " formula" : "")} key={entry.name}>
            <div className="property-name-row">
              <strong>{entry.name}</strong>
              {entry.formula && <span>Power Fx</span>}
            </div>
            <code>{formatSerializedValue(entry.value)}</code>
          </div>
        ))}
      </div>
    </div>
  );
}
