import { useMemo, useState } from "react";
import type { CanvasAppModel, CanvasControl } from "../types/canvas";
import { Icon } from "./Icon";

interface Props {
  app: CanvasAppModel;
  selectedId?: string;
  onSelectScreen: (screenId: string) => void;
  onSelectControl: (control: CanvasControl) => void;
}

function filterControls(controls: CanvasControl[], query: string): CanvasControl[] {
  if (!query) return controls;

  return controls.flatMap(control => {
    const children = filterControls(control.children, query);
    const matches =
      control.name.toLowerCase().includes(query) ||
      control.controlType.toLowerCase().includes(query);

    if (!matches && children.length === 0) return [];

    return [{ ...control, children }];
  });
}

function ControlTree({
  controls,
  selectedId,
  onSelect
}: {
  controls: CanvasControl[];
  selectedId?: string;
  onSelect: (control: CanvasControl) => void;
}) {
  return (
    <ul className="tree-list nested">
      {controls.map(control => (
        <li key={control.id}>
          <button
            className={"tree-item" + (selectedId === control.id ? " selected" : "")}
            onClick={() => onSelect(control)}
            title={control.controlType}
          >
            <span className="tree-glyph control-glyph" aria-hidden="true" />
            <span className="tree-name">{control.name}</span>
            <span className="tree-type">{control.controlType}</span>
          </button>
          {control.children.length > 0 && (
            <ControlTree
              controls={control.children}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

export function AppTree({
  app,
  selectedId,
  onSelectScreen,
  onSelectControl
}: Props) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();

  const screens = useMemo(
    () =>
      app.screens
        .map(screen => ({
          ...screen,
          children: filterControls(screen.children, query)
        }))
        .filter(
          screen =>
            !query ||
            screen.name.toLowerCase().includes(query) ||
            screen.children.length > 0
        ),
    [app.screens, query]
  );

  return (
    <aside className="panel app-tree">
      <div className="panel-heading explorer-heading">
        <div>
          <span className="panel-kicker">NAVIGATION</span>
          <strong>App explorer</strong>
        </div>
        <span>{app.screens.length} screens</span>
      </div>

      <label className="tree-search">
        <Icon name="search" size={15} />
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search screens or controls"
          aria-label="Search screens or controls"
        />
      </label>

      {screens.length === 0 ? (
        <div className="panel-empty">No matching screens or controls.</div>
      ) : (
        <ul className="tree-list root-tree">
          {screens.map(screen => (
            <li key={screen.id}>
              <button
                className={"tree-item screen" + (selectedId === screen.id ? " selected" : "")}
                onClick={() => onSelectScreen(screen.id)}
              >
                <span className="tree-glyph">
                  <Icon name="screen" size={15} />
                </span>
                <span className="tree-name">{screen.name}</span>
                <span className="tree-type">Screen</span>
              </button>
              <ControlTree
                controls={screen.children}
                selectedId={selectedId}
                onSelect={onSelectControl}
              />
            </li>
          ))}
        </ul>
      )}

      {app.components.length > 0 && !query && (
        <>
          <div className="tree-section-label">
            <Icon name="component" size={14} />
            Components
          </div>
          <ul className="tree-list">
            {app.components.map(component => (
              <li key={component.id}>
                <div className="tree-item static">
                  <span className="tree-glyph">
                    <Icon name="component" size={14} />
                  </span>
                  <span className="tree-name">{component.name}</span>
                  <span className="tree-type">Component</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
