import type { RuntimeSnapshot } from "../../memory/types";

type SnapshotPanelProps = {
  snapshots: RuntimeSnapshot[];
};

export function SnapshotPanel({ snapshots }: SnapshotPanelProps) {
  const latest = snapshots[snapshots.length - 1];

  return (
    <section className="panel snapshot-panel" aria-label="Snapshot inspection">
      <div className="panel-heading">
        <p className="eyebrow">Snapshots</p>
        <h2>Inspection artifacts</h2>
      </div>
      <div className="snapshot-list">
        {snapshots.map((snapshot) => (
          <div className="snapshot-item" key={snapshot.id}>
            <span>{snapshot.label}</span>
            <small>memory v{snapshot.memory.version}</small>
          </div>
        ))}
      </div>
      {latest ? (
        <p className="panel-note">
          Latest snapshot captures {latest.memory.facts.length} memory facts and{" "}
          {latest.events.length} lifecycle events.
        </p>
      ) : null}
    </section>
  );
}
