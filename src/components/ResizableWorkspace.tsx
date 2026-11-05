import {
  Children, useEffect, useRef, useState,
  type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode
} from "react";
import {
  fitWorkspaceWidths, resizeWorkspacePanel,
  WORKSPACE_DEFAULTS, WORKSPACE_LIMITS,
  type WorkspacePanel, type WorkspaceWidths
} from "../core/layout/workspaceSizing";

interface Props {
  children: ReactNode;
}

interface DragState {
  panel: WorkspacePanel;
  pointerId: number;
  startX: number;
  startWidths: WorkspaceWidths;
}

export function ResizableWorkspace({ children }: Props) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [widths, setWidths] = useState<WorkspaceWidths>(WORKSPACE_DEFAULTS);
  const [active, setActive] = useState<WorkspacePanel | null>(null);
  const panels = Children.toArray(children);

  function containerWidth(): number {
    return workspaceRef.current?.clientWidth ?? 1366;
  }

  useEffect(() => {
    const element = workspaceRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? element.clientWidth;
      // Below this breakpoint, the panels stack and the handles are hidden.
      if (width <= 980) return;
      setWidths(current => {
        const next = fitWorkspaceWidths(current, width);
        return next.explorer === current.explorer && next.details === current.details
          ? current : next;
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function startDrag(panel: WorkspacePanel, event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || containerWidth() <= 980) return;
    event.preventDefault();
    dragRef.current = {
      panel, pointerId: event.pointerId, startX: event.clientX, startWidths: widths
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setActive(panel);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setWidths(resizeWorkspacePanel(
      drag.startWidths, drag.panel, event.clientX - drag.startX, containerWidth()
    ));
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setActive(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeys(panel: WorkspacePanel, event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 40 : 16;
    const delta = event.key === "ArrowLeft" ? -step :
      event.key === "ArrowRight" ? step :
      event.key === "Home" ? -10000 :
      event.key === "End" ? 10000 : null;
    if (delta === null) return;
    event.preventDefault();
    setWidths(current => resizeWorkspacePanel(current, panel, delta, containerWidth()));
  }

  function resetDivider(panel: WorkspacePanel) {
    setWidths(current => fitWorkspaceWidths({
      ...current, [panel]: WORKSPACE_DEFAULTS[panel]
    }, containerWidth()));
  }

  function divider(panel: WorkspacePanel) {
    const left = panel === "explorer";
    const minimum = left ? WORKSPACE_LIMITS.explorerMin : WORKSPACE_LIMITS.detailsMin;
    const maximum = Math.max(minimum, Math.min(
      left ? WORKSPACE_LIMITS.explorerMax : WORKSPACE_LIMITS.detailsMax,
      containerWidth() - WORKSPACE_LIMITS.dividers - WORKSPACE_LIMITS.previewMin -
        (left ? widths.details : widths.explorer)
    ));
    return (
      <div
        className={"workspace-divider" + (active === panel ? " active" : "")}
        role="separator"
        aria-label={left ? "Resize App explorer" : "Resize Properties and Diagnostics"}
        aria-orientation="vertical"
        aria-valuemin={minimum}
        aria-valuemax={maximum}
        aria-valuenow={widths[panel]}
        tabIndex={0}
        title="Drag to resize, use arrow keys, or double-click to reset"
        onPointerDown={event => startDrag(panel, event)}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onLostPointerCapture={() => {
          dragRef.current = null;
          setActive(null);
        }}
        onKeyDown={event => handleKeys(panel, event)}
        onDoubleClick={() => resetDivider(panel)}
      />
    );
  }

  const style = {
    "--explorer-width": widths.explorer + "px",
    "--details-width": widths.details + "px"
  } as CSSProperties;

  return (
    <div ref={workspaceRef}
      className={"workspace resizable-workspace" + (active ? " is-resizing" : "")}
      style={style}>
      {panels[0]}
      {divider("explorer")}
      {panels[1]}
      {divider("details")}
      {panels[2]}
    </div>
  );
}
