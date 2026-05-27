import type { StreamContext } from "@signal-kernel/async-runtime";

export type JobStatus =
  | "idle"
  | "pending"
  | "running"
  | "success"
  | "error"
  | "cancelled";

export type JobStep =
  | "parse_document"
  | "extract_keywords"
  | "summarize_sections"
  | "generate_report";

export type JobRunSource = {
  attempt: number;
  content: string;
};

export type JobExecutionState = {
  progress: number;
  currentStep: JobStep | null;
  partialResult: string;
  stableResult: string | null;
};

export type JobExecutionChunk = Partial<JobExecutionState>;

export type JobStreamContext = StreamContext<
  JobExecutionChunk,
  JobExecutionState
>;

export type JobAnalyzeStream = (
  source: JobRunSource,
  ctx: JobStreamContext,
) => Promise<void> | void;

export type JobStateView = {
  id: string;
  status: JobStatus;
  progress: number;
  currentStep: JobStep | null;
  partialResult: string;
  stableResult: string | null;
  visibleResult: string | null;
  error: string | null;
  canCancel: boolean;
  canRetry: boolean;
  isTerminal: boolean;
};

export type JobRuntimeOptions = {
  id?: string;
  content: string;
  analyze?: JobAnalyzeStream;
};

export type JobRuntime = {
  id: string;
  start(): void;
  cancel(): void;
  retry(): void;
  getState(): JobStateView;
  dispose(): void;
};
