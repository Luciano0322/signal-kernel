export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "done" | "streaming" | "error" | "aborted";
};

export type ScenarioId =
  | "stale-recall-race"
  | "derived-prompt-drift"
  | "partial-retain-failure"
  | "snapshot-timeline";

export type ScenarioSummary = {
  id: ScenarioId;
  label: string;
  claim: string;
  status: "static" | "ready";
};
