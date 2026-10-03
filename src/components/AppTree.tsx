import type { CanvasAppModel, CanvasControl } from "../types/canvas";

interface Props {
  app: CanvasAppModel;
  selectedId?: string;
  onSelectScreen: (screenId: string) => void;
  onSelectControl: (control: CanvasControl) => void;
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
            <span className="tree-type">{control.controlType}</span>
            <span>{control.name}</span>
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
  return (
    <aside className="panel app-tree">
      <div className="panel-heading">
        <strong>App structure</strong>
        <span>{app.screens.length} screens</span>
      </div>
      <ul className="tree-list">
        {app.screens.map(screen => (
          <li key={screen.id}>
            <button
              className={"tree-item screen" + (selectedId === screen.id ? " selected" : "")}
              onClick={() => onSelectScreen(screen.id)}
            >
              <span className="tree-type">Screen</span>
              <span>{screen.name}</span>
            </button>
            <ControlTree
              controls={screen.children}
              selectedId={selectedId}
              onSelect={onSelectControl}
            />
          </li>
        ))}
      </ul>
      {app.components.length > 0 && (
        <>
          <div className="tree-section-label">Components</div>
          <ul className="tree-list">
            {app.components.map(component => (
              <li key={component.id}>
                <div className="tree-item static">
                  <span className="tree-type">Component</span>
                  <span>{component.name}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
