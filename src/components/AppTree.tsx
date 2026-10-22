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
  controls, selectedId, onSelect, collapsed, toggle, searching
}: {
  controls: CanvasControl[];
  selectedId?: string;
  onSelect: (control: CanvasControl) => void;
  collapsed: Set<string>;
  toggle: (id: string) => void;
  searching: boolean;
}) {
  return (
    <ul className="tree-list nested">
      {controls.map(control => {
        const hasChildren = control.children.length > 0;
        const expanded = searching || !collapsed.has(control.id);
        return (
          <li key={control.id}>
            <div className="tree-entry">
              {hasChildren ? (
                <button
                  type="button"
                  className="tree-expander"
                  aria-label={(expanded ? "Collapse " : "Expand ") + control.name}
                  aria-expanded={expanded}
                  onClick={() => toggle(control.id)}
                >
                  <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
                </button>
              ) : <span className="tree-expander-placeholder" />}
              <button
                type="button"
                className={"tree-item" + (selectedId === control.id ? " selected" : "")}
                onClick={() => onSelect(control)}
                title={control.controlType}
                aria-current={selectedId === control.id ? "true" : undefined}
              >
                <span className="tree-glyph control-glyph" aria-hidden="true" />
                <span className="tree-name">{control.name}</span>
                <span className="tree-type">{control.controlType}</span>
              </button>
            </div>
            {hasChildren && expanded && (
              <ControlTree
                controls={control.children}
                selectedId={selectedId}
                onSelect={onSelect}
                collapsed={collapsed}
                toggle={toggle}
                searching={searching}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function AppTree({ app, selectedId, onSelectScreen, onSelectControl }: Props) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const query = search.trim().toLowerCase();
  const searching = query.length > 0;

  const screens = useMemo(
    () => app.screens
      .map(screen => ({ ...screen, children: filterControls(screen.children, query) }))
      .filter(screen =>
        !query || screen.name.toLowerCase().includes(query) || screen.children.length > 0
      ),
    [app.screens, query]
  );

  function toggle(id: string) {
    setCollapsed(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
      <div className="tree-actions">
        <button type="button" onClick={() => setCollapsed(new Set())}>Expand all</button>
        <button type="button" onClick={() => {
          const ids = new Set<string>();
          const visit = (controls: CanvasControl[]) => {
            for (const control of controls) {
              if (control.children.length) ids.add(control.id);
              visit(control.children);
            }
          };
          for (const screen of app.screens) {
            ids.add(screen.id);
            visit(screen.children);
          }
          setCollapsed(ids);
        }}>Collapse all</button>
      </div>
      {screens.length === 0 ? (
        <div className="panel-empty">No matching screens or controls.</div>
      ) : (
        <ul className="tree-list root-tree">
          {screens.map(screen => {
            const expanded = searching || !collapsed.has(screen.id);
            return (
              <li key={screen.id}>
                <div className="tree-entry">
                  <button
                    type="button"
                    className="tree-expander"
                    aria-label={(expanded ? "Collapse " : "Expand ") + screen.name}
                    aria-expanded={expanded}
                    onClick={() => toggle(screen.id)}
                  >
                    <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
                  </button>
                  <button
                    type="button"
                    className={"tree-item screen" + (selectedId === screen.id ? " selected" : "")}
                    onClick={() => onSelectScreen(screen.id)}
                    aria-current={selectedId === screen.id ? "true" : undefined}
                  >
                    <span className="tree-glyph"><Icon name="screen" size={15} /></span>
                    <span className="tree-name">{screen.name}</span>
                    <span className="tree-type">Screen</span>
                  </button>
                </div>
                {expanded && (
                  <ControlTree controls={screen.children} selectedId={selectedId}
                    onSelect={onSelectControl} collapsed={collapsed} toggle={toggle}
                    searching={searching} />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {app.components.length > 0 && !query && (
        <>
          <div className="tree-section-label">
            <Icon name="component" size={14} />Components
          </div>
          <ul className="tree-list">
            {app.components.map(component => (
              <li key={component.id}>
                <div className="tree-item static">
                  <span className="tree-glyph"><Icon name="component" size={14} /></span>
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
