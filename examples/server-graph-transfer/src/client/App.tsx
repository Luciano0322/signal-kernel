import { useComputedValue, useSignalValue } from "@signal-kernel/react";
import type { ProfileGraph } from "../shared/createProfileGraph";
import type { SnapshotDocument } from "@signal-kernel/snapshot";
import "./styles.css";

type AppProps = {
  graph: ProfileGraph;
  snapshot: SnapshotDocument | undefined;
};

export function App({ graph, snapshot }: AppProps) {
  const userId = useSignalValue(graph.signals.userId);
  const plan = useSignalValue(graph.signals.plan);
  const usage = useSignalValue(graph.signals.usage);
  const entitlement = useComputedValue(graph.computed.entitlement);
  const overLimit = useComputedValue(graph.computed.overLimit);
  const summary = useComputedValue(graph.computed.summary);
  const usageLimit = useComputedValue(graph.computed.usageLimit);

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Server graph transfer</p>
        <h1>Graph state crosses the server/client boundary as data.</h1>
        <p>
          The server encoded writable signal state into JSON. The client restored
          a compatible graph and recomputed derived values locally.
        </p>
      </section>

      <section className="workspace-grid">
        <article className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Restored Graph</p>
            <h2>Signals</h2>
          </div>
          <dl className="metric-grid">
            <div>
              <dt>User</dt>
              <dd>{userId}</dd>
            </div>
            <div>
              <dt>Plan</dt>
              <dd>{plan}</dd>
            </div>
            <div>
              <dt>Usage</dt>
              <dd>{usage}</dd>
            </div>
          </dl>
          <div className="action-row">
            <button onClick={() => graph.actions.incrementUsage(25)} type="button">
              +25 usage
            </button>
            <button onClick={() => graph.actions.setUsage(0)} type="button">
              Reset usage
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Client Runtime</p>
            <h2>Computed values</h2>
          </div>
          <dl className="metric-grid">
            <div>
              <dt>Entitlement</dt>
              <dd>{entitlement}</dd>
            </div>
            <div>
              <dt>Limit</dt>
              <dd>{Number.isFinite(usageLimit) ? usageLimit : "unlimited"}</dd>
            </div>
            <div>
              <dt>Over limit</dt>
              <dd>{overLimit ? "yes" : "no"}</dd>
            </div>
          </dl>
          <p className="panel-note">{summary}</p>
        </article>

        <article className="panel snapshot-panel">
          <div className="panel-heading">
            <p className="eyebrow">Snapshot Document</p>
            <h2>JSON-safe graph transfer</h2>
          </div>
          <pre>{JSON.stringify(snapshot, null, 2)}</pre>
          <p className="panel-note">
            This snapshot does not include components, DOM state, hook state,
            effects, promises, or server component data. Computed nodes are
            inspection data and recompute from restored signals.
          </p>
        </article>
      </section>
    </main>
  );
}
