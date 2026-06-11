import { createSnapshotScope } from "@signal-kernel/snapshot";
import type { JobKernel } from "./createJobKernel";

export function createJobKernelSnapshotScope(kernel: JobKernel) {
  const scope = createSnapshotScope({
    graphId: "nuxt-job-monitor",
    graphVersion: "0.1.0",
  });

  scope.signal("jobs", kernel.state.jobs);
  scope.signal("logs", kernel.state.logs);
  scope.signal("selectedJobId", kernel.state.selectedJobId);
  scope.signal("statusFilter", kernel.state.statusFilter);
  scope.signal("lastEventAt", kernel.state.lastEventAt);

  scope.computed("jobSummary", kernel.computed.jobSummary);
  scope.computed("filteredJobListItems", kernel.computed.filteredJobListItems);
  scope.computed("runtimeHealth", kernel.computed.runtimeHealth);

  scope.resource("jobsResource", kernel.resources.jobsResource, {
    restore: "inspect-only",
    sourceKey: { method: "GET", path: "/api/jobs" },
  });

  scope.stream(
    "jobEvents",
    [
      () => ({
        connectionStatus: kernel.state.eventStreamStatus.peek(),
        lastEventAt: kernel.state.lastEventAt.peek(),
      }),
      {
        error: kernel.state.streamError.peek,
        stableValue: () => undefined,
        status: kernel.state.eventStreamStatus.get,
      },
    ],
    {
      restore: "inspect-only",
      sourceKey: { method: "GET", path: "/api/jobs/events", transport: "sse" },
    },
  );

  return scope;
}
