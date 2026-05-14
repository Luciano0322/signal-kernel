import type { ResourceContext } from "@signal-kernel/async-runtime";
import { getCommitFixture } from "./commits";
import type { DeploymentRequest, DeploymentStatus, OpsEvent } from "./types";

export function fakeDeploymentApi(
  request: DeploymentRequest,
  recordEvent: (event: Omit<OpsEvent, "id" | "at">) => void,
  ctx: ResourceContext,
): Promise<DeploymentStatus> {
  const fixture = getCommitFixture(request.commitId);

  if (request.intent === "idle") {
    return Promise.resolve({
      commitId: request.commitId,
      environment: request.environment,
      state: "idle",
      version: request.commitId,
      message: "No rollout requested",
    });
  }

  if (request.intent === "cancelled") {
    return Promise.resolve({
      commitId: request.commitId,
      environment: request.environment,
      state: "cancelled",
      version: request.commitId,
      message: "Rollout was cancelled",
    });
  }

  if (!request.canDeploy) {
    return Promise.resolve({
      commitId: request.commitId,
      environment: request.environment,
      state: "blocked",
      version: request.commitId,
      message: "Rollout is blocked until CI and artifact gates pass",
    });
  }

  recordEvent({
    source: "deployment",
    phase: "start",
    commitId: request.commitId,
    delay: fixture.deploymentDelay,
    message: `Staging rollout started for ${fixture.label}`,
  });

  return new Promise((resolve) => {
    globalThis.setTimeout(() => {
      const ignored = ctx.signal.aborted;

      recordEvent({
        source: "deployment",
        phase: ignored ? "resolve-ignored" : "resolve",
        commitId: request.commitId,
        delay: fixture.deploymentDelay,
        message: `Staging rollout ${fixture.deploymentState} for ${fixture.label}`,
      });

      resolve({
        commitId: request.commitId,
        environment: request.environment,
        state: fixture.deploymentState,
        version: request.commitId,
        message: `Staging rollout ${fixture.deploymentState}`,
      });
    }, fixture.deploymentDelay);
  });
}
