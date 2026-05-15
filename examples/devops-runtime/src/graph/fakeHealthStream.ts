import type { StreamContext } from "@signal-kernel/async-runtime";
import { getCommitFixture } from "./commits";
import { wait } from "./timers";
import type { CommitId, HealthEvent, OpsEvent } from "./types";

export async function fakeHealthStream(
  commitId: CommitId,
  ctx: StreamContext<HealthEvent, HealthEvent[]>,
  recordEvent: (event: Omit<OpsEvent, "id" | "at">) => void,
) {
  const fixture = getCommitFixture(commitId);

  recordEvent({
    source: "health",
    phase: "start",
    commitId,
    message: `Health stream opened for ${fixture.label}`,
  });

  for (const event of fixture.healthEvents) {
    await wait(event.delay);

    if (ctx.isCancelled()) {
      recordEvent({
        source: "health",
        phase: "resolve-ignored",
        commitId,
        delay: event.delay,
        message: `Ignored stale health event for ${fixture.label}`,
      });
      return;
    }

    const healthEvent: HealthEvent = {
      commitId,
      state: event.state,
      latencyMs: event.latencyMs,
      errorRate: event.errorRate,
      message: event.message,
    };

    recordEvent({
      source: "health",
      phase: "emit",
      commitId,
      delay: event.delay,
      message: event.message,
    });

    ctx.emit(healthEvent);
  }

  ctx.done();
}
