import { computed, signal } from "@signal-kernel/core";
import { createResource, createStreamResource } from "@signal-kernel/async-runtime";
import { fakeArtifactApi } from "./fakeArtifactApi";
import { fakeCiApi } from "./fakeCiApi";
import { fakeDeploymentApi } from "./fakeDeploymentApi";
import { fakeHealthStream } from "./fakeHealthStream";
import type {
  ArtifactStatus,
  CiStatus,
  CommitId,
  DecisionSnapshot,
  DeploymentRequest,
  DeploymentStatus,
  Environment,
  HealthEvent,
  HealthSummary,
  OpsEvent,
  PipelinePhase,
  ResourceTuple,
  RolloutIntent,
  StreamTuple,
} from "./types";

function summarizeHealth(events: HealthEvent[] | undefined): HealthSummary {
  const latest = events?.[events.length - 1];

  if (!latest) {
    return { state: "unknown" };
  }

  return {
    state: latest.state,
    latest,
  };
}

function getPipelinePhase(
  canDeploy: boolean,
  canPromote: boolean,
  rolloutIntent: RolloutIntent,
  deployment: DeploymentStatus | undefined,
  health: HealthSummary,
  approved: boolean,
  blockedReason: string | null,
): PipelinePhase {
  if (rolloutIntent === "cancelled" || deployment?.state === "cancelled") {
    return "cancelled";
  }

  if (blockedReason && !canDeploy) {
    return "checking";
  }

  if (deployment?.state === "failed" || deployment?.state === "blocked") {
    return "blocked";
  }

  if (rolloutIntent === "deploy" && deployment?.state !== "success") {
    return "deploying";
  }

  if (!canDeploy) {
    return "checking";
  }

  if (deployment?.state !== "success") {
    return "ready-to-deploy";
  }

  if (health.state === "unknown") {
    return "awaiting-health";
  }

  if (health.state === "degraded") {
    return "blocked";
  }

  if (!approved) {
    return "awaiting-approval";
  }

  return canPromote ? "ready-to-promote" : "blocked";
}

export function createDevopsGraph() {
  const selectedCommit = signal<CommitId>("commit-a");
  const targetEnvironment = signal<Environment>("staging");
  const manualApproval = signal(false);
  const rolloutIntent = signal<RolloutIntent>("idle");
  const eventLog = signal<OpsEvent[]>([]);

  let nextEventId = 0;

  function recordEvent(event: Omit<OpsEvent, "id" | "at">) {
    eventLog.set([
      ...eventLog.peek(),
      {
        id: ++nextEventId,
        at: Date.now(),
        ...event,
      },
    ]);
  }

  const ciStatus = createResource<CommitId, CiStatus>(
    selectedCommit.get,
    (commitId, ctx) => fakeCiApi(commitId, recordEvent, ctx),
    { keepPreviousValueOnPending: true },
  ) satisfies ResourceTuple<CiStatus>;

  const artifactStatus = createResource<CommitId, ArtifactStatus>(
    selectedCommit.get,
    (commitId, ctx) => fakeArtifactApi(commitId, recordEvent, ctx),
    { keepPreviousValueOnPending: true },
  ) satisfies ResourceTuple<ArtifactStatus>;

  const canDeploy = computed(() => {
    const ci = ciStatus[0]();
    const artifact = artifactStatus[0]();

    return ci?.state === "success" && artifact?.state === "ready";
  });

  const deploymentRequest = computed<DeploymentRequest>(() => ({
    commitId: selectedCommit.get(),
    environment: targetEnvironment.get(),
    intent: rolloutIntent.get(),
    canDeploy: canDeploy.get(),
  }));

  const deploymentStatus = createResource<DeploymentRequest, DeploymentStatus>(
    deploymentRequest.get,
    (request, ctx) => fakeDeploymentApi(request, recordEvent, ctx),
    { keepPreviousValueOnPending: true },
  ) satisfies ResourceTuple<DeploymentStatus>;

  const healthEvents = createStreamResource<CommitId, HealthEvent, HealthEvent[]>(
    selectedCommit.get,
    (commitId, ctx) => fakeHealthStream(commitId, ctx, recordEvent),
    {
      initialValue: [],
      reduce: (current, event) => [...(current ?? []), event],
      onCancel: "clear",
      onError: "clear",
    },
  ) satisfies StreamTuple<HealthEvent[]>;

  const healthSummary = computed(() => summarizeHealth(healthEvents[0]()));

  const decisions = computed<DecisionSnapshot>(() => {
    const ci = ciStatus[0]();
    const artifact = artifactStatus[0]();
    const deployment = deploymentStatus[0]();
    const health = healthSummary.get();
    const approved = manualApproval.get();
    const deployable = canDeploy.get();

    let blockedReason: string | null = null;

    if (ci?.state === "failed") {
      blockedReason = "CI checks failed";
    } else if (artifact?.state === "missing") {
      blockedReason = "Artifact is missing";
    } else if (deployment?.state === "failed") {
      blockedReason = "Staging rollout failed";
    } else if (deployment?.state === "success" && health.state === "degraded") {
      blockedReason = "Health stream is degraded";
    } else if (deployment?.state === "success" && !approved) {
      blockedReason = "Manual approval is required";
    }

    const promotable =
      deployable &&
      deployment?.state === "success" &&
      health.state === "healthy" &&
      approved;

    return {
      phase: getPipelinePhase(
        deployable,
        promotable,
        rolloutIntent.get(),
        deployment,
        health,
        approved,
        blockedReason,
      ),
      canDeploy: deployable,
      canPromote: promotable,
      blockedReason,
      riskLevel:
        health.state === "degraded"
          ? "high"
          : health.state === "healthy"
            ? "low"
            : "unknown",
      health,
    };
  });

  function selectCommit(commitId: CommitId) {
    manualApproval.set(false);
    rolloutIntent.set("idle");
    selectedCommit.set(commitId);
    recordEvent({
      source: "graph",
      phase: "action",
      commitId,
      message: `Selected ${commitId}`,
    });
  }

  function startDeployment() {
    rolloutIntent.set("deploy");
    manualApproval.set(false);
    recordEvent({
      source: "graph",
      phase: "action",
      commitId: selectedCommit.peek(),
      message: "Requested staging rollout",
    });
  }

  function approvePromotion() {
    manualApproval.set(true);
    recordEvent({
      source: "graph",
      phase: "action",
      commitId: selectedCommit.peek(),
      message: "Manual approval granted",
    });
  }

  function cancelDeployment() {
    deploymentStatus[1].cancel("user-cancelled");
    rolloutIntent.set("cancelled");
    recordEvent({
      source: "graph",
      phase: "cancel",
      commitId: selectedCommit.peek(),
      message: "Cancelled active rollout",
    });
  }

  return {
    signals: {
      selectedCommit,
      targetEnvironment,
      manualApproval,
      rolloutIntent,
      eventLog,
    },
    resources: {
      ciStatus,
      artifactStatus,
      deploymentStatus,
      healthEvents,
    },
    computed: {
      canDeploy,
      healthSummary,
      decisions,
    },
    actions: {
      selectCommit,
      startDeployment,
      approvePromotion,
      cancelDeployment,
    },
  };
}

export const devopsGraph = createDevopsGraph();
