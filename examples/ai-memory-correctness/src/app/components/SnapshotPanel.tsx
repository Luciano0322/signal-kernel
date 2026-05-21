import { useMemo, useState } from "react";
import type { RuntimeSnapshot } from "../../memory/types";

type SnapshotPanelProps = {
  snapshots: RuntimeSnapshot[];
};

function formatStatus(value: string | undefined) {
  return value ?? "n/a";
}

export function SnapshotPanel({ snapshots }: SnapshotPanelProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const latest = snapshots[snapshots.length - 1];
  const selected = useMemo(() => {
    if (snapshots.length === 0) return undefined;

    return (
      snapshots.find((snapshot) => snapshot.id === selectedId) ??
      snapshots[snapshots.length - 1]
    );
  }, [selectedId, snapshots]);
  const recentEvents = selected?.events.slice(-5) ?? [];

  return (
    <section className="panel snapshot-panel" aria-label="Snapshot inspection">
      <div className="panel-heading">
        <p className="eyebrow">Snapshots</p>
        <h2>Inspection artifacts</h2>
      </div>
      <div className="snapshot-list">
        {snapshots.map((snapshot) => (
          <button
            className={
              selected?.id === snapshot.id
                ? "snapshot-item active"
                : "snapshot-item"
            }
            key={snapshot.id}
            onClick={() => setSelectedId(snapshot.id)}
            type="button"
          >
            <span>{snapshot.label}</span>
            <small>memory v{snapshot.memory.version}</small>
          </button>
        ))}
      </div>
      {selected ? (
        <div className="snapshot-detail">
          <div className="status-grid">
            <div>
              <span>Stream</span>
              <strong>{formatStatus(selected.streamStatus)}</strong>
            </div>
            <div>
              <span>Retain</span>
              <strong>{formatStatus(selected.retainStatus)}</strong>
            </div>
            <div>
              <span>Events</span>
              <strong>{selected.events.length}</strong>
            </div>
          </div>

          {selected.renderedPrompt ? (
            <pre>{selected.renderedPrompt}</pre>
          ) : (
            <p className="empty-state">No rendered prompt captured.</p>
          )}

          <div className="snapshot-facts">
            <h3>Captured memory facts</h3>
            <ul>
              {selected.memory.facts.map((fact) => (
                <li key={fact.id}>{fact.content}</li>
              ))}
            </ul>
          </div>

          <div className="snapshot-facts">
            <h3>Recent events before snapshot</h3>
            <ul>
              {recentEvents.map((event) => (
                <li key={`${event.type}-${event.timestamp}`}>{event.type}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {latest ? (
        <p className="panel-note">
          Latest snapshot captures {latest.memory.facts.length} memory facts and{" "}
          {latest.events.length} lifecycle events.
        </p>
      ) : null}
    </section>
  );
}
