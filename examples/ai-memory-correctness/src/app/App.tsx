import { useMemo, useState } from "react";
import {
  useComputedValue,
  useResource,
  useSignalValue,
  useStreamResource,
} from "@signal-kernel/react";
import { ChatPanel } from "./components/ChatPanel";
import { GraphInspector } from "./components/GraphInspector";
import { MemoryPanel } from "./components/MemoryPanel";
import { PromptPanel } from "./components/PromptPanel";
import { ScenarioControls } from "./components/ScenarioControls";
import { SnapshotPanel } from "./components/SnapshotPanel";
import { TimelinePanel } from "./components/TimelinePanel";
import { createMemoryGraph } from "../kernel/createMemoryGraph";
import { createLocalMemoryDriver } from "../memory/localMemoryDriver";
import type { TurnState } from "../memory/types";
import type { ChatMessage, ScenarioId } from "../model/types";
import {
  memoryFacts,
  scenarios,
} from "./mockData";

const scope = {
  userId: "luciano",
  threadId: "memory-poc",
};

const initialMessage = "Can you help me shape the DEV.to launch plan?";

function turnStatus(
  recallStatus: string,
  streamStatus: string,
  retainStatus: string,
): TurnState["status"] {
  if (retainStatus === "extracting") return "extracting";
  if (retainStatus === "consolidating") return "consolidating";
  if (retainStatus === "retaining") return "retaining";
  if (retainStatus === "rolled_back" || streamStatus === "error") return "failed";
  if (streamStatus === "cancelled") return "cancelled";
  if (streamStatus === "pending" || streamStatus === "streaming") {
    return "generating";
  }
  if (recallStatus === "pending") return "recalling";
  if (streamStatus === "success") return "completed";
  return "idle";
}

export function App() {
  const graph = useMemo(() => {
    let clock = 1_735_000_000_000;
    const now = () => {
      clock += 100;
      return clock;
    };
    const driver = createLocalMemoryDriver({
      initialFacts: [{ scope, facts: memoryFacts }],
      now,
    });

    return createMemoryGraph({
      driver,
      initialMessage,
      now,
      scope: () => scope,
      streamDelayMs: 80,
    });
  }, []);
  const [draft, setDraft] = useState(initialMessage);
  const [activeScenarioId, setActiveScenarioId] =
    useState<ScenarioId>("snapshot-timeline");
  const activeTurnId = useSignalValue(graph.signals.activeTurnId);
  const currentUserMessage = useSignalValue(graph.signals.currentUserMessage);
  const events = useSignalValue(graph.signals.events);
  const snapshots = useSignalValue(graph.signals.snapshots);
  const retainState = useSignalValue(graph.signals.retainState);
  const prompt = useComputedValue(graph.computed.renderedPrompt);
  const recallStatus = useComputedValue(graph.computed.status);
  const [recalledFacts = []] = useResource(graph.resources.recalledFacts);
  const [assistantText = "", streamMeta] = useStreamResource(
    graph.resources.modelStream,
  );
  const streamStatus = streamMeta.status();
  const assistantMessage = assistantText || streamMeta.stableValue() || "";
  const latestSnapshot = snapshots[snapshots.length - 1];
  const committedFacts = latestSnapshot?.memory.facts ?? recalledFacts;
  const messages: ChatMessage[] = [
    {
      id: `${activeTurnId}-user`,
      role: "user",
      content: currentUserMessage || "No active turn yet.",
      status: "done",
    },
    {
      id: `${activeTurnId}-assistant`,
      role: "assistant",
      content:
        assistantMessage ||
        "Waiting for recalled memory before opening the model stream.",
      status:
        streamStatus === "streaming" || streamStatus === "pending"
          ? "streaming"
          : streamStatus === "cancelled"
            ? "aborted"
            : streamStatus === "error"
              ? "error"
              : "done",
    },
  ];
  const activeTurn: TurnState = {
    id: activeTurnId,
    status: turnStatus(recallStatus, streamStatus, retainState.status),
    userMessage: currentUserMessage,
    assistantMessage,
    recalledFactIds: recalledFacts.map((fact) => fact.id),
    candidateFacts: retainState.candidates,
    consolidationPlan: retainState.plan,
    error:
      retainState.error instanceof Error
        ? retainState.error.message
        : retainState.error
          ? String(retainState.error)
          : undefined,
    createdAt: events[0]?.timestamp ?? Date.now(),
    updatedAt: events[events.length - 1]?.timestamp ?? Date.now(),
  };
  const canSubmit = draft.trim().length > 0;
  const canRetain =
    Boolean(currentUserMessage.trim()) &&
    Boolean(assistantMessage.trim()) &&
    streamStatus === "success" &&
    retainState.status !== "extracting" &&
    retainState.status !== "consolidating" &&
    retainState.status !== "retaining";

  function handleSubmit() {
    graph.actions.setCurrentUserMessage(draft);
  }

  function handleRetain() {
    void graph.actions.retainTurn({
      assistantMessage,
      turnId: activeTurnId,
      userMessage: currentUserMessage,
    });
  }

  function handleSnapshot() {
    void graph.actions.recordSnapshot("manual-inspection", activeTurnId);
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">AI memory correctness</p>
        <h1>Model memory as a lifecycle, not a background side effect.</h1>
        <p>
          The workbench is now driven by the memory graph: recall, prompt
          derivation, streaming, retention, and inspection snapshots are graph
          state. React only renders the current graph view.
        </p>
      </header>

      <div className="workspace-grid">
        <div className="left-column">
          <ScenarioControls
            activeScenarioId={activeScenarioId}
            onSelect={setActiveScenarioId}
            scenarios={scenarios}
          />
          <ChatPanel
            canRetain={canRetain}
            canSubmit={canSubmit}
            inputValue={draft}
            isStreaming={streamStatus === "pending" || streamStatus === "streaming"}
            messages={messages}
            onInputChange={setDraft}
            onRetain={handleRetain}
            onSnapshot={handleSnapshot}
            onStop={() => graph.actions.cancelModelStream("user-stop")}
            onSubmit={handleSubmit}
          />
        </div>

        <div className="center-column">
          <MemoryPanel
            candidateFacts={retainState.candidates}
            facts={committedFacts}
            turn={activeTurn}
          />
          <PromptPanel prompt={prompt} />
        </div>

        <div className="right-column">
          <TimelinePanel events={events} />
          <SnapshotPanel snapshots={snapshots} />
          <GraphInspector />
        </div>
      </div>
    </main>
  );
}
