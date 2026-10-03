import { useMemo, useState } from "react";
import { FileDrop } from "./components/FileDrop";
import { AppTree } from "./components/AppTree";
import { CanvasPreview } from "./components/CanvasPreview";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { Inspector } from "./components/Inspector";
import { analyzeCanvasApp } from "./core/analyzer/analyzer";
import { importCanvasFiles } from "./core/importers/source";
import { collectFormulaRefs, countControls } from "./core/model/formulas";
import { buildCanvasModel } from "./core/model/normalize";
import { DEMO_SOURCE } from "./sample/demo";
import type {
  CanvasAppModel,
  CanvasControl,
  CanvasScreen,
  SourceFile
} from "./types/canvas";

type Selection =
  | { kind: "screen"; value: CanvasScreen }
  | { kind: "control"; value: CanvasControl };

function appNameFromFiles(files: File[]): string {
  if (files.length === 1) {
    return files[0].name.replace(/\.msapp$/i, "").replace(/\.pa\.yaml$/i, "");
  }
  return "Canvas App";
}

export default function App() {
  const [app, setApp] = useState<CanvasAppModel>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selectedScreenId, setSelectedScreenId] = useState<string>();
  const [selectedControl, setSelectedControl] = useState<CanvasControl>();
  const [rightTab, setRightTab] = useState<"inspect" | "diagnostics">("diagnostics");

  const findings = useMemo(() => (app ? analyzeCanvasApp(app) : []), [app]);
  const formulaCount = useMemo(
    () => (app ? collectFormulaRefs(app).length : 0),
    [app]
  );
  const controlCount = useMemo(() => (app ? countControls(app) : 0), [app]);

  const selectedScreen = app?.screens.find(screen => screen.id === selectedScreenId);
  const selection: Selection | undefined = selectedControl
    ? { kind: "control", value: selectedControl }
    : selectedScreen
      ? { kind: "screen", value: selectedScreen }
      : undefined;

  function installModel(model: CanvasAppModel, importWarnings: string[]) {
    setApp(model);
    setWarnings(importWarnings);
    setSelectedScreenId(model.screens[0]?.id);
    setSelectedControl(undefined);
    setError(undefined);
  }

  async function handleFiles(files: File[]) {
    setBusy(true);
    setError(undefined);
    try {
      const result = await importCanvasFiles(files);
      installModel(
        buildCanvasModel(result.files, result.sourceKind, appNameFromFiles(files)),
        result.warnings
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  function loadDemo() {
    const source: SourceFile = {
      path: "Src/Home.pa.yaml",
      name: "Home.pa.yaml",
      content: DEMO_SOURCE,
      origin: "yaml"
    };
    installModel(buildCanvasModel([source], "yaml", "Synthetic Inventory Demo"), []);
  }

  function reset() {
    setApp(undefined);
    setSelectedControl(undefined);
    setSelectedScreenId(undefined);
    setWarnings([]);
    setError(undefined);
  }

  if (!app) {
    return (
      <div className="landing">
        <FileDrop busy={busy} onFiles={handleFiles} onDemo={loadDemo} />
        {error && <div className="landing-error">{error}</div>}
        <div className="landing-details">
          <div>
            <strong>Local-first</strong>
            <span>No server upload path in the MVP.</span>
          </div>
          <div>
            <strong>Active Canvas source</strong>
            <span>Reads .pa.yaml under Src/ from modern .msapp packages.</span>
          </div>
          <div>
            <strong>Static analysis</strong>
            <span>Findings are review hints, not runtime guarantees.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="workbench">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">CA</span>
          <div>
            <strong>Canvas App Visualizer</strong>
            <span>{app.name}</span>
          </div>
        </div>

        <div className="stats">
          <span><strong>{app.screens.length}</strong> screens</span>
          <span><strong>{controlCount}</strong> controls</span>
          <span><strong>{formulaCount}</strong> formulas</span>
          <span><strong>{findings.length}</strong> findings</span>
        </div>

        <button className="secondary compact" onClick={reset}>Open another</button>
      </header>

      {warnings.length > 0 && (
        <div className="warning-strip">{warnings.join(" ")}</div>
      )}

      <div className="workspace">
        <AppTree
          app={app}
          selectedId={selectedControl?.id ?? selectedScreenId}
          onSelectScreen={id => {
            setSelectedScreenId(id);
            setSelectedControl(undefined);
            setRightTab("inspect");
          }}
          onSelectControl={control => {
            setSelectedControl(control);
            setRightTab("inspect");
          }}
        />

        <CanvasPreview
          screen={selectedScreen}
          selectedId={selectedControl?.id}
          onSelect={control => {
            setSelectedControl(control);
            setRightTab("inspect");
          }}
        />

        <aside className="panel right-panel">
          <div className="tabs">
            <button
              className={rightTab === "inspect" ? "active" : ""}
              onClick={() => setRightTab("inspect")}
            >
              Inspector
            </button>
            <button
              className={rightTab === "diagnostics" ? "active" : ""}
              onClick={() => setRightTab("diagnostics")}
            >
              Diagnostics
              {findings.length > 0 && <span className="tab-count">{findings.length}</span>}
            </button>
          </div>
          <div className="right-content">
            {rightTab === "inspect" ? (
              <Inspector selection={selection} />
            ) : (
              <DiagnosticsPanel findings={findings} />
            )}
          </div>
        </aside>
      </div>

      <footer className="statusbar">
        <span>{app.sourceKind === "msapp" ? ".msapp" : "YAML"} · {app.files.length} source files</span>
        <span>
          Preview is approximate · dynamic formulas and runtime defaults are not executed
        </span>
      </footer>
    </div>
  );
}
