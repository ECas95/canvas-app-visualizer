import { useRef, useState } from "react";
import { Icon } from "./Icon";

interface Props {
  busy: boolean;
  onFiles: (files: File[]) => void;
  onDemo: () => void;
}

export function FileDrop({ busy, onFiles, onDemo }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <section
      className={"drop-zone" + (dragging ? " is-dragging" : "")}
      onDragEnter={event => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={event => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={event => {
        event.preventDefault();
        setDragging(false);
        onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <div className="drop-zone-header">
        <div className="product-mark" aria-hidden="true">
          <span />
          <span />
        </div>
        <div>
          <span className="eyebrow">OPEN-SOURCE CANVAS TOOLING</span>
          <h1>Canvas App Visualizer</h1>
        </div>
      </div>

      <p className="hero-copy">
        Open a Canvas app package, inspect its source, and review the app structure
        without starting Power Apps Studio.
      </p>

      <div className="drop-surface">
        <div className="drop-surface-icon">
          <Icon name="open" size={26} />
        </div>
        <div className="drop-surface-copy">
          <strong>Drop a .msapp or .pa.yaml file here</strong>
          <span>Modern Canvas source is parsed locally in this browser.</span>
        </div>
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Icon name="open" />
          {busy ? "Opening…" : "Choose file"}
        </button>
      </div>

      <div className="landing-command-row">
        <button className="text-button" disabled={busy} onClick={onDemo}>
          <Icon name="screen" />
          Explore with sample app
        </button>
        <span className="privacy-inline">
          <Icon name="shield" />
          Local processing · no upload API
        </span>
      </div>

      <input
        ref={inputRef}
        hidden
        multiple
        type="file"
        accept=".msapp,.pa.yaml,.yaml,.yml"
        onChange={event => onFiles(Array.from(event.target.files ?? []))}
      />
    </section>
  );
}
