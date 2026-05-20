const nodes = [
  "currentUserMessage",
  "recallQuery",
  "recalledFacts",
  "renderedMemoryPrompt",
  "modelStream",
  "completedTurn",
  "candidateFacts",
  "consolidationPlan",
  "retainTransaction",
  "memoryStore",
  "runtimeSnapshots",
];

export function GraphInspector() {
  return (
    <section className="panel graph-panel" aria-label="Graph inspector">
      <div className="panel-heading">
        <p className="eyebrow">Graph</p>
        <h2>Runtime shape</h2>
      </div>
      <ol className="graph-list">
        {nodes.map((node, index) => (
          <li key={node}>
            <span>{node}</span>
            {index < nodes.length - 1 ? <small>feeds next node</small> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
