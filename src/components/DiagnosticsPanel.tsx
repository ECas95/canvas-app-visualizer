import type { Finding } from "../types/canvas";

interface Props {
  findings: Finding[];
}

export function DiagnosticsPanel({ findings }: Props) {
  const counts = {
    error: findings.filter(item => item.severity === "error").length,
    warning: findings.filter(item => item.severity === "warning").length,
    info: findings.filter(item => item.severity === "info").length
  };

  return (
    <div className="diagnostics">
      <div className="diagnostic-summary">
        <span className="pill error">{counts.error} errors</span>
        <span className="pill warning">{counts.warning} warnings</span>
        <span className="pill info">{counts.info} suggestions</span>
      </div>

      {findings.length === 0 ? (
        <p className="muted">
          No static findings. This does not guarantee runtime correctness.
        </p>
      ) : (
        <div className="finding-list">
          {findings.map(item => (
            <article className={"finding " + item.severity} key={item.id}>
              <div className="finding-heading">
                <span>{item.category}</span>
                <strong>{item.title}</strong>
              </div>
              <p>{item.message}</p>
              {item.suggestion && <p className="suggestion">{item.suggestion}</p>}
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
