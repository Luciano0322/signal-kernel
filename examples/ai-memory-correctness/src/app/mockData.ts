import type {
  CandidateFact,
  MemoryFact,
  MemoryRuntimeEvent,
  RuntimeSnapshot,
  TurnState,
} from "../memory/types";
import type { ChatMessage, ScenarioSummary } from "../model/types";

const now = 1_735_000_000_000;

export const scenarios: ScenarioSummary[] = [
  {
    id: "stale-recall-race",
    label: "Stale recall race",
    claim: "Only the latest recall result may update the active memory context.",
    status: "static",
  },
  {
    id: "derived-prompt-drift",
    label: "Derived prompt drift",
    claim: "The memory prompt must be derived from current recalled facts.",
    status: "static",
  },
  {
    id: "partial-retain-failure",
    label: "Partial retain failure",
    claim: "Candidate facts must commit atomically or rollback together.",
    status: "static",
  },
  {
    id: "snapshot-timeline",
    label: "Snapshot timeline",
    claim: "Lifecycle checkpoints should be inspectable before durable replay exists.",
    status: "static",
  },
];

export const chatMessages: ChatMessage[] = [
  {
    id: "msg-1",
    role: "user",
    content: "Can you help me shape the DEV.to launch plan?",
    status: "done",
  },
  {
    id: "msg-2",
    role: "assistant",
    content:
      "I found memory that you prefer precise technical explanations and publish engineering notes on DEV.to.",
    status: "done",
  },
];

export const activeTurn: TurnState = {
  id: "turn-2",
  status: "retaining",
  userMessage: chatMessages[0].content,
  assistantMessage: chatMessages[1].content,
  recalledFactIds: ["fact-devto", "fact-style"],
  candidateFacts: [],
  createdAt: now,
  updatedAt: now + 1_500,
};

export const memoryFacts: MemoryFact[] = [
  {
    id: "fact-devto",
    content: "User publishes technical articles on DEV.to.",
    status: "active",
    confidence: 0.92,
    createdAt: now - 80_000,
    updatedAt: now - 80_000,
    sourceTurnIds: ["turn-1"],
  },
  {
    id: "fact-style",
    content: "User prefers precise architecture explanations with concrete boundaries.",
    status: "active",
    confidence: 0.88,
    createdAt: now - 60_000,
    updatedAt: now - 10_000,
    sourceTurnIds: ["turn-1"],
  },
  {
    id: "fact-old",
    content: "User wanted broad AI-runtime exploration before narrowing the scope.",
    status: "superseded",
    confidence: 0.61,
    createdAt: now - 120_000,
    updatedAt: now - 20_000,
    supersedes: [],
    sourceTurnIds: ["turn-0"],
  },
];

export const candidateFacts: CandidateFact[] = [
  {
    id: "candidate-1",
    content:
      "User wants to validate AI memory correctness before building a full AI runtime.",
    confidence: 0.94,
    sourceTurnId: activeTurn.id,
    status: "candidate",
  },
  {
    id: "candidate-2",
    content:
      "User treats snapshots as lifecycle inspection artifacts before durable replay.",
    confidence: 0.83,
    sourceTurnId: activeTurn.id,
    status: "candidate",
  },
];

export const renderedMemoryPrompt = [
  "Relevant memory:",
  "- User publishes technical articles on DEV.to.",
  "- User prefers precise architecture explanations with concrete boundaries.",
  "",
  "Use these facts as context. Do not treat candidate facts as committed memory.",
].join("\n");

export const runtimeEvents: MemoryRuntimeEvent[] = [
  {
    type: "turn.created",
    turnId: activeTurn.id,
    message: activeTurn.userMessage,
    timestamp: now,
  },
  {
    type: "recall.started",
    turnId: activeTurn.id,
    query: "DEV.to launch plan",
    timestamp: now + 100,
  },
  {
    type: "recall.resolved",
    turnId: activeTurn.id,
    factIds: ["fact-devto", "fact-style"],
    timestamp: now + 550,
  },
  {
    type: "prompt.rendered",
    turnId: activeTurn.id,
    prompt: renderedMemoryPrompt,
    timestamp: now + 580,
  },
  {
    type: "stream.completed",
    turnId: activeTurn.id,
    value: chatMessages[1].content,
    timestamp: now + 1_200,
  },
  {
    type: "extract.resolved",
    turnId: activeTurn.id,
    candidates: candidateFacts,
    timestamp: now + 1_420,
  },
  {
    type: "snapshot.created",
    label: "after-extraction",
    snapshot: {
      scope: { userId: "luciano", threadId: "memory-poc" },
      facts: memoryFacts,
      version: 2,
      createdAt: now + 1_500,
    },
    timestamp: now + 1_500,
  },
];

export const snapshots: RuntimeSnapshot[] = [
  {
    id: "snapshot-before-recall",
    label: "before-recall",
    turnId: activeTurn.id,
    memory: {
      scope: { userId: "luciano", threadId: "memory-poc" },
      facts: memoryFacts.slice(0, 1),
      version: 1,
      createdAt: now,
    },
    events: runtimeEvents.slice(0, 1),
    createdAt: now,
  },
  {
    id: "snapshot-after-extraction",
    label: "after-extraction",
    turnId: activeTurn.id,
    memory: {
      scope: { userId: "luciano", threadId: "memory-poc" },
      facts: memoryFacts,
      version: 2,
      createdAt: now + 1_500,
    },
    renderedPrompt: renderedMemoryPrompt,
    streamStatus: "success",
    retainStatus: "pending",
    events: runtimeEvents,
    createdAt: now + 1_500,
  },
];
