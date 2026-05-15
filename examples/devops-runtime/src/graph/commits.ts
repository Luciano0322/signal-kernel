import type { CommitFixture, CommitId } from "./types";

export const commitOrder: CommitId[] = ["commit-a", "commit-b", "commit-c"];

export const commitFixtures: Record<CommitId, CommitFixture> = {
  "commit-a": {
    id: "commit-a",
    label: "Commit A",
    message: "Slow but healthy rollout",
    ciDelay: 3000,
    ciState: "success",
    artifactDelay: 2400,
    artifactState: "ready",
    deploymentDelay: 1400,
    deploymentState: "success",
    healthEvents: [
      {
        delay: 700,
        state: "healthy",
        latencyMs: 96,
        errorRate: 0.002,
        message: "baseline health is stable",
      },
      {
        delay: 700,
        state: "healthy",
        latencyMs: 104,
        errorRate: 0.003,
        message: "canary health remains stable",
      },
    ],
  },
  "commit-b": {
    id: "commit-b",
    label: "Commit B",
    message: "Fast checks, degraded health",
    ciDelay: 800,
    ciState: "success",
    artifactDelay: 1000,
    artifactState: "ready",
    deploymentDelay: 900,
    deploymentState: "success",
    healthEvents: [
      {
        delay: 400,
        state: "healthy",
        latencyMs: 120,
        errorRate: 0.006,
        message: "initial canary looks acceptable",
      },
      {
        delay: 500,
        state: "degraded",
        latencyMs: 480,
        errorRate: 0.087,
        message: "error budget is burning too quickly",
      },
    ],
  },
  "commit-c": {
    id: "commit-c",
    label: "Commit C",
    message: "Medium checks with healthy rollout",
    ciDelay: 1500,
    ciState: "success",
    artifactDelay: 1700,
    artifactState: "ready",
    deploymentDelay: 1100,
    deploymentState: "success",
    healthEvents: [
      {
        delay: 500,
        state: "healthy",
        latencyMs: 88,
        errorRate: 0.001,
        message: "new version is stable",
      },
      {
        delay: 500,
        state: "healthy",
        latencyMs: 91,
        errorRate: 0.001,
        message: "promotion gate remains green",
      },
    ],
  },
};

export function getCommitFixture(commitId: CommitId) {
  return commitFixtures[commitId];
}
