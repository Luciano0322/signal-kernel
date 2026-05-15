import type { ResourceContext } from "@signal-kernel/async-runtime";
import { getCommitFixture } from "./commits";
import type { ArtifactStatus, CommitId, OpsEvent } from "./types";

export function fakeArtifactApi(
  commitId: CommitId,
  recordEvent: (event: Omit<OpsEvent, "id" | "at">) => void,
  ctx: ResourceContext,
): Promise<ArtifactStatus> {
  const fixture = getCommitFixture(commitId);

  recordEvent({
    source: "artifact",
    phase: "start",
    commitId,
    delay: fixture.artifactDelay,
    message: `Artifact build started for ${fixture.label}`,
  });

  return new Promise((resolve) => {
    globalThis.setTimeout(() => {
      const ignored = ctx.signal.aborted;

      recordEvent({
        source: "artifact",
        phase: ignored ? "resolve-ignored" : "resolve",
        commitId,
        delay: fixture.artifactDelay,
        message: `Artifact is ${fixture.artifactState} for ${fixture.label}`,
      });

      resolve({
        commitId,
        state: fixture.artifactState,
        image: `registry.example.com/app:${commitId}`,
        digest: `sha256:${commitId.replace("-", "")}`,
      });
    }, fixture.artifactDelay);
  });
}
