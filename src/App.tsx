import { useMemo, useState } from "react";
import { FileDrop } from "./components/FileDrop";
import { AppTree } from "./components/AppTree";
import { CanvasPreview } from "./components/CanvasPreview";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { Inspector } from "./components/Inspector";
import { Icon } from "./components/Icon";
import { analyzeCanvasApp } from "./core/analyzer/analyzer";
import { importCanvasFiles } from "./core/importers/source";
import { collectFormulaRefs, countControls } from "./core/model/formulas";
import { buildCanvasModel } from "./core/model/normalize";
import { DEMO_FILES } from "./sample/demo";
import type {
  CanvasAppModel,
  CanvasControl,
  CanvasScreen
} from "./types/canvas";

type Selection =
  | { kind: "screen"; value: CanvasScreen }
  | { kind: "control"; value: CanvasControl };

function appNameFromFiles(files: File[]): string {
  if (files.length === 1) {
    return files[0].name
      .replace(/\.msapp$/i, "")
      .replace(/\.(?:pa|fx)\.yaml$/i, "");
  }
  return "Canvas App";
}

function sourceFormatLabel(app: CanvasAppModel): string {
  switch (app.sourceFormat) {
    case "pa-yaml-v3":
      return "Canvas v3";
    case "fx-yaml-legacy":
      return "Legacy FX YAML";
    case "mixed":
      return "Mixed source";
    default:
      return "Unknown YAML";
  }
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
    installModel(
      buildCanvasModel(DEMO_FILES, "yaml", "Synthetic Inventory Demo"),
      []
    );
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
        <header className="landing-topbar">
          <div className="landing-brand">
            <div className="product-mark small" aria-hidden="true">
              <span />
              <span />
            </div>
            <div>
              <strong>Canvas App Visualizer</strong>
              <span>Open-source developer tooling</span>
            </div>
          </div>
          <a
            className="repo-link"
            href="https://github.com/ECas95/canvas-app-visualizer"
            target="_blank"
            rel="noreferrer"
          >
            View source
          </a>
        </header>

        <main className="landing-main">
          <div className="landing-intro">
            <span className="eyebrow">POWER APPS SOURCE INSPECTION</span>
            <h2>Understand a Canvas app before opening the editor.</h2>
            <p>
              Visualize screens and controls, inspect serialized Power Fx, and surface
              technical review findings from modern Canvas source.
            </p>
          </div>

          <FileDrop busy={busy} onFiles={handleFiles} onDemo={loadDemo} />
          {error && <div className="landing-error">{error}</div>}

          <div className="landing-details">
            <div>
              <Icon name="local" size={20} />
              <div>
                <strong>Runs locally</strong>
                <span>Selected files stay in your browser session.</span>
              </div>
            </div>
            <div>
              <Icon name="code" size={20} />
              <div>
                <strong>Source-aware</strong>
                <span>Inspects current .pa.yaml and historical .fx.yaml Canvas source.</span>
              </div>
            </div>
            <div>
              <Icon name="diagnostics" size={20} />
              <div>
                <strong>Engineering review</strong>
                <span>Flags potential issues with explicit confidence levels.</span>
              </div>
            </div>
          </div>
        </main>

        <footer className="landing-footer">
          <span>Independent open-source project · not affiliated with Microsoft</span>
          <span>MIT licensed</span>
        </footer>
      </div>
    );
  }

  return (
    <div className="workbench">
      <header className="topbar">
        <div className="brand">
          <div className="product-mark tiny" aria-hidden="true">
            <span />
            <span />
          </div>
          <div>
            <strong>Canvas App Visualizer</strong>
            <span>{app.name}</span>
          </div>
        </div>

        <div className="command-area">
          <span className="local-chip">
            <Icon name="shield" size={14} />
            Local processing
          </span>
          <button className="command-button" onClick={reset}>
            <Icon name="open" size={15} />
            Open another
          </button>
        </div>
      </header>

      <div className="contextbar">
        <div className="context-file">
          <span className="source-badge">
            {app.sourceKind === "msapp" ? "MSAPP" : "YAML"}
          </span>
          <span>{app.files.length} source files</span>
          <span className="format-label">{sourceFormatLabel(app)}</span>
        </div>

        <div className="stats">
          <span><strong>{app.screens.length}</strong> Screens</span>
          <span><strong>{controlCount}</strong> Controls</span>
          <span><strong>{formulaCount}</strong> Formulas</span>
          <span className={findings.length > 0 ? "has-findings" : ""}>
            <strong>{findings.length}</strong> Findings
          </span>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="warning-strip">
          <span className="warning-dot" />
          {warnings.join(" ")}
        </div>
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
          <div className="tabs" role="tablist" aria-label="Details">
            <button
              role="tab"
              aria-selected={rightTab === "inspect"}
              className={rightTab === "inspect" ? "active" : ""}
              onClick={() => setRightTab("inspect")}
            >
              <Icon name="properties" size={15} />
              Properties
            </button>
            <button
              role="tab"
              aria-selected={rightTab === "diagnostics"}
              className={rightTab === "diagnostics" ? "active" : ""}
              onClick={() => setRightTab("diagnostics")}
            >
              <Icon name="diagnostics" size={15} />
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
        <div>
          <span className="status-ready">Ready</span>
          <span>
            {app.sourceKind === "msapp" ? ".msapp package" : "Canvas YAML source"} · {sourceFormatLabel(app)}
          </span>
        </div>
        <span>
          Preview is approximate · runtime formulas and defaults are not executed
        </span>
      </footer>
    </div>
  );
}
