import { useRef, useState } from "react";

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
      <div className="drop-mark">CA</div>
      <h1>Canvas App Visualizer</h1>
      <p>
        Inspect a <strong>.msapp</strong> package or active <strong>.pa.yaml</strong>
        source locally in your browser.
      </p>
      <div className="drop-actions">
        <button disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Opening…" : "Open Canvas source"}
        </button>
        <button className="secondary" disabled={busy} onClick={onDemo}>
          Load demo
        </button>
      </div>
      <input
        ref={inputRef}
        hidden
        multiple
        type="file"
        accept=".msapp,.pa.yaml,.yaml,.yml"
        onChange={event => onFiles(Array.from(event.target.files ?? []))}
      />
      <small>
        Files are processed locally. No upload API is used by the application.
      </small>
    </section>
  );
}
