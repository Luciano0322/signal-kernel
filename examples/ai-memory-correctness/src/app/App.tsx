import { ChatPanel } from "./components/ChatPanel";
import { GraphInspector } from "./components/GraphInspector";
import { MemoryPanel } from "./components/MemoryPanel";
import { PromptPanel } from "./components/PromptPanel";
import { ScenarioControls } from "./components/ScenarioControls";
import { SnapshotPanel } from "./components/SnapshotPanel";
import { TimelinePanel } from "./components/TimelinePanel";
import {
  activeTurn,
  candidateFacts,
  chatMessages,
  memoryFacts,
  renderedMemoryPrompt,
  runtimeEvents,
  scenarios,
  snapshots,
} from "./mockData";

export function App() {
  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">AI memory correctness</p>
        <h1>Model memory as a lifecycle, not a background side effect.</h1>
        <p>
          Task 1 defines the domain shell: chat state, committed memory,
          candidate facts, rendered prompt, timeline events, and inspection
          snapshots. The graph wiring comes next.
        </p>
      </header>

      <div className="workspace-grid">
        <div className="left-column">
          <ScenarioControls
            activeScenarioId="stale-recall-race"
            scenarios={scenarios}
          />
          <ChatPanel messages={chatMessages} />
        </div>

        <div className="center-column">
          <MemoryPanel
            candidateFacts={candidateFacts}
            facts={memoryFacts}
            turn={activeTurn}
          />
          <PromptPanel prompt={renderedMemoryPrompt} />
        </div>

        <div className="right-column">
          <TimelinePanel events={runtimeEvents} />
          <SnapshotPanel snapshots={snapshots} />
          <GraphInspector />
        </div>
      </div>
    </main>
  );
}
