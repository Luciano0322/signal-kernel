import type { ResourceContext } from "@signal-kernel/async-runtime";
import { getCommitFixture } from "./commits";
import type { CiStatus, CommitId, OpsEvent } from "./types";

export function fakeCiApi(
  commitId: CommitId,
  recordEvent: (event: Omit<OpsEvent, "id" | "at">) => void,
  ctx: ResourceContext,
): Promise<CiStatus> {
  const fixture = getCommitFixture(commitId);

  recordEvent({
    source: "ci",
    phase: "start",
    commitId,
    delay: fixture.ciDelay,
    message: `CI checks started for ${fixture.label}`,
  });

  return new Promise((resolve) => {
    globalThis.setTimeout(() => {
      const ignored = ctx.signal.aborted;

      recordEvent({
        source: "ci",
        phase: ignored ? "resolve-ignored" : "resolve",
        commitId,
        delay: fixture.ciDelay,
        message: `CI checks ${fixture.ciState} for ${fixture.label}`,
      });

      resolve({
        commitId,
        state: fixture.ciState,
        checks: ["typecheck", "unit tests", "package build"],
      });
    }, fixture.ciDelay);
  });
}
