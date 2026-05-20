import type { CandidateFact, MemoryFact, TurnState } from "../../memory/types";

type MemoryPanelProps = {
  candidateFacts: CandidateFact[];
  facts: MemoryFact[];
  turn: TurnState;
};

function confidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function MemoryPanel({ candidateFacts, facts, turn }: MemoryPanelProps) {
  return (
    <section className="panel memory-panel" aria-label="Memory state">
      <div className="panel-heading">
        <p className="eyebrow">Memory</p>
        <h2>Committed vs candidate</h2>
      </div>

      <div className="status-grid">
        <div>
          <span>Turn</span>
          <strong>{turn.id}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{turn.status}</strong>
        </div>
        <div>
          <span>Recalled</span>
          <strong>{turn.recalledFactIds.length}</strong>
        </div>
      </div>

      <div className="fact-section">
        <h3>Committed facts</h3>
        <ul className="fact-list">
          {facts.map((fact) => (
            <li className={`fact-item ${fact.status}`} key={fact.id}>
              <div>
                <span>{fact.id}</span>
                <strong>{fact.status}</strong>
              </div>
              <p>{fact.content}</p>
              <small>confidence {confidence(fact.confidence)}</small>
            </li>
          ))}
        </ul>
      </div>

      <div className="fact-section">
        <h3>Candidate facts</h3>
        <ul className="fact-list">
          {candidateFacts.map((fact) => (
            <li className="fact-item candidate" key={fact.id}>
              <div>
                <span>{fact.id}</span>
                <strong>{fact.status}</strong>
              </div>
              <p>{fact.content}</p>
              <small>source {fact.sourceTurnId}</small>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
