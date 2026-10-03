import { useMemo, useState } from "react";
import type { Finding, FindingSeverity } from "../types/canvas";
import { Icon } from "./Icon";

interface Props {
  findings: Finding[];
  powerFxStatus: "idle" | "loading" | "ready" | "unavailable";
}

type Filter = "all" | FindingSeverity;

function engineStatusLabel(
  status: Props["powerFxStatus"]
): string {
  switch (status) {
    case "loading":
      return "Power Fx engine · loading";
    case "ready":
      return "Official Power Fx · ready";
    case "unavailable":
      return "Power Fx engine · fallback";
    default:
      return "Power Fx engine · idle";
  }
}

export function DiagnosticsPanel({ findings, powerFxStatus }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = {
    error: findings.filter(item => item.severity === "error").length,
    warning: findings.filter(item => item.severity === "warning").length,
    info: findings.filter(item => item.severity === "info").length
  };

  const visible = useMemo(
    () => (filter === "all" ? findings : findings.filter(item => item.severity === filter)),
    [findings, filter]
  );

  return (
    <div className="diagnostics">
      <div className="diagnostic-overview">
        <div>
          <span className="panel-kicker">STATIC ANALYSIS</span>
          <strong>{findings.length === 0 ? "No findings" : findings.length + " findings"}</strong>
        </div>
        <div className="analysis-status">
          <span
            className={
              "engine-note " +
              (powerFxStatus === "ready"
                ? "ready"
                : powerFxStatus === "unavailable"
                  ? "fallback"
                  : "")
            }
          >
            {engineStatusLabel(powerFxStatus)}
          </span>
          <span className="analysis-note">Advisory</span>
        </div>
      </div>

      <div className="diagnostic-filters" role="group" aria-label="Filter diagnostics">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          All <span>{findings.length}</span>
        </button>
        <button
          className={filter === "error" ? "active" : ""}
          onClick={() => setFilter("error")}
        >
          Errors <span>{counts.error}</span>
        </button>
        <button
          className={filter === "warning" ? "active" : ""}
          onClick={() => setFilter("warning")}
        >
          Warnings <span>{counts.warning}</span>
        </button>
        <button
          className={filter === "info" ? "active" : ""}
          onClick={() => setFilter("info")}
        >
          Suggestions <span>{counts.info}</span>
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="diagnostic-empty">
          <Icon name="diagnostics" size={22} />
          <strong>No findings in this view</strong>
          <span>
            Static analysis cannot guarantee runtime correctness or connector behavior.
          </span>
        </div>
      ) : (
        <div className="finding-list">
          {visible.map(item => (
            <article className={"finding " + item.severity} key={item.id}>
              <div className="finding-heading">
                <div className={"severity-dot " + item.severity} aria-hidden="true" />
                <div>
                  <span>{item.category}</span>
                  <strong>{item.title}</strong>
                </div>
              </div>
              <p>{item.message}</p>
              {item.suggestion && (
                <div className="recommendation">
                  <span>Recommendation</span>
                  <p>{item.suggestion}</p>
                </div>
              )}
              <div className="finding-meta">
                <code>{item.ruleId}</code>
                <span>{item.confidence} confidence</span>
              </div>
              {(item.controlPath || item.property) && (
                <div className="finding-location">
                  {item.controlPath}
                  {item.property ? " · " + item.property : ""}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
