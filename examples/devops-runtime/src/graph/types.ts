import type { AsyncMeta, StreamAsyncMeta } from "@signal-kernel/async-runtime";

export type CommitId = "commit-a" | "commit-b" | "commit-c";
export type Environment = "staging" | "production";
export type RolloutIntent = "idle" | "deploy" | "cancelled";

export type CiState = "success" | "failed";
export type ArtifactState = "ready" | "missing";
export type DeploymentState =
  | "idle"
  | "blocked"
  | "success"
  | "failed"
  | "cancelled";
export type HealthState = "unknown" | "healthy" | "degraded";
export type RiskLevel = "unknown" | "low" | "high";
export type PipelinePhase =
  | "checking"
  | "ready-to-deploy"
  | "deploying"
  | "awaiting-health"
  | "awaiting-approval"
  | "ready-to-promote"
  | "blocked"
  | "cancelled";

export interface CommitFixture {
  id: CommitId;
  label: string;
  message: string;
  ciDelay: number;
  ciState: CiState;
  artifactDelay: number;
  artifactState: ArtifactState;
  deploymentDelay: number;
  deploymentState: Exclude<DeploymentState, "idle" | "blocked" | "cancelled">;
  healthEvents: HealthEventFixture[];
}

export interface HealthEventFixture {
  delay: number;
  state: Exclude<HealthState, "unknown">;
  latencyMs: number;
  errorRate: number;
  message: string;
}

export interface CiStatus {
  commitId: CommitId;
  state: CiState;
  checks: string[];
}

export interface ArtifactStatus {
  commitId: CommitId;
  state: ArtifactState;
  image: string;
  digest: string;
}

export interface DeploymentRequest {
  commitId: CommitId;
  environment: Environment;
  intent: RolloutIntent;
  canDeploy: boolean;
}

export interface DeploymentStatus {
  commitId: CommitId;
  environment: Environment;
  state: DeploymentState;
  version: string;
  message: string;
}

export interface HealthEvent {
  commitId: CommitId;
  state: Exclude<HealthState, "unknown">;
  latencyMs: number;
  errorRate: number;
  message: string;
}

export interface HealthSummary {
  state: HealthState;
  latest?: HealthEvent;
}

export interface DecisionSnapshot {
  phase: PipelinePhase;
  canDeploy: boolean;
  canPromote: boolean;
  blockedReason: string | null;
  riskLevel: RiskLevel;
  health: HealthSummary;
}

export type OpsEventSource =
  | "graph"
  | "ci"
  | "artifact"
  | "deployment"
  | "health";

export type OpsEventPhase =
  | "action"
  | "start"
  | "resolve"
  | "resolve-ignored"
  | "emit"
  | "cancel";

export interface OpsEvent {
  id: number;
  source: OpsEventSource;
  phase: OpsEventPhase;
  commitId?: CommitId;
  message: string;
  delay?: number;
  at: number;
}

export type ResourceTuple<T, E = unknown> = [
  value: () => T | undefined,
  meta: AsyncMeta<E, T>,
];

export type StreamTuple<TValue, E = unknown> = [
  value: () => TValue | undefined,
  meta: StreamAsyncMeta<E, TValue>,
];
