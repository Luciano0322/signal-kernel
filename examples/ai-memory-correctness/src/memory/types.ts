export type MemoryScope = {
  userId: string;
  threadId: string;
};

export type FactStatus = "active" | "superseded" | "deleted";

export type MemoryFact = {
  id: string;
  content: string;
  status: FactStatus;
  confidence: number;
  createdAt: number;
  updatedAt: number;
  supersedes?: string[];
  sourceTurnIds?: string[];
};

export type RecallInput = {
  scope: MemoryScope;
  query: string;
  signal?: AbortSignal;
};

export type RecallResult = {
  facts: MemoryFact[];
};

export type CandidateFact = {
  id: string;
  content: string;
  confidence: number;
  sourceTurnId: string;
  status: "candidate" | "validated" | "rejected";
};

export type ConsolidationAction =
  | {
      type: "insert";
      fact: CandidateFact;
    }
  | {
      type: "merge";
      targetFactId: string;
      fact: CandidateFact;
    }
  | {
      type: "supersede";
      targetFactId: string;
      fact: CandidateFact;
    }
  | {
      type: "skip";
      reason: string;
      fact: CandidateFact;
    };

export type ConsolidationPlan = {
  actions: ConsolidationAction[];
};

export type ExtractInput = {
  assistantMessage: string;
  turnId: string;
  userMessage: string;
};

export type ConsolidateInput = {
  candidates: CandidateFact[];
  existingFacts: MemoryFact[];
};

export type RetainTurnInput = ExtractInput;

export type RetainStatus =
  | "idle"
  | "extracting"
  | "consolidating"
  | "retaining"
  | "committed"
  | "rolled_back"
  | "failed";

export type MemorySnapshot = {
  scope: MemoryScope;
  facts: MemoryFact[];
  version: number;
  createdAt: number;
};

export type RetainTransactionResult =
  | {
      status: "committed";
      before: MemorySnapshot;
      after: MemorySnapshot;
    }
  | {
      status: "rolled_back";
      before: MemorySnapshot;
      after: MemorySnapshot;
      error: unknown;
    };

export type RetainTurnResult = RetainTransactionResult & {
  candidates: CandidateFact[];
  plan: ConsolidationPlan;
};

export type RetainState = {
  status: RetainStatus;
  candidates: CandidateFact[];
  plan?: ConsolidationPlan;
  before?: MemorySnapshot;
  after?: MemorySnapshot;
  error?: unknown;
};

export interface MemoryDriver {
  recall(input: RecallInput): Promise<RecallResult>;
  inspect(scope: MemoryScope): Promise<MemorySnapshot>;
  applyPlan(
    scope: MemoryScope,
    plan: ConsolidationPlan,
  ): Promise<MemorySnapshot>;
}

export type TurnStatus =
  | "idle"
  | "recalling"
  | "generating"
  | "extracting"
  | "consolidating"
  | "retaining"
  | "completed"
  | "failed"
  | "cancelled";

export type TurnState = {
  id: string;
  status: TurnStatus;
  userMessage: string;
  assistantMessage?: string;
  recalledFactIds: string[];
  candidateFacts: CandidateFact[];
  consolidationPlan?: ConsolidationPlan;
  error?: string;
  createdAt: number;
  updatedAt: number;
};

export type MemoryRuntimeEvent =
  | {
      type: "turn.created";
      turnId: string;
      message: string;
      timestamp: number;
    }
  | {
      type: "recall.started";
      turnId: string;
      query: string;
      timestamp: number;
    }
  | {
      type: "recall.cancelled";
      turnId: string;
      reason: string;
      timestamp: number;
    }
  | {
      type: "recall.resolved";
      turnId: string;
      factIds: string[];
      timestamp: number;
    }
  | {
      type: "prompt.rendered";
      turnId: string;
      prompt: string;
      timestamp: number;
    }
  | {
      type: "stream.started";
      turnId: string;
      timestamp: number;
    }
  | {
      type: "stream.chunk";
      turnId: string;
      chunk: string;
      value: string;
      timestamp: number;
    }
  | {
      type: "stream.completed";
      turnId: string;
      value: string;
      timestamp: number;
    }
  | {
      type: "extract.started";
      turnId: string;
      timestamp: number;
    }
  | {
      type: "extract.resolved";
      turnId: string;
      candidates: CandidateFact[];
      timestamp: number;
    }
  | {
      type: "consolidation.planned";
      turnId: string;
      plan: ConsolidationPlan;
      timestamp: number;
    }
  | {
      type: "retain.started";
      turnId: string;
      plan: ConsolidationPlan;
      timestamp: number;
    }
  | {
      type: "retain.committed";
      turnId: string;
      snapshot: MemorySnapshot;
      timestamp: number;
    }
  | {
      type: "retain.rolled_back";
      turnId: string;
      error: string;
      timestamp: number;
    }
  | {
      type: "snapshot.created";
      label: string;
      snapshot: MemorySnapshot;
      timestamp: number;
    };

export type RuntimeSnapshot = {
  id: string;
  label: string;
  turnId?: string;
  memory: MemorySnapshot;
  renderedPrompt?: string;
  streamStatus?: string;
  retainStatus?: string;
  events: MemoryRuntimeEvent[];
  createdAt: number;
};
