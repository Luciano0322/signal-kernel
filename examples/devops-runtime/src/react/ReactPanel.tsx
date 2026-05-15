import {
  useComputedValue,
  useResource,
  useSignalValue,
  useStreamResource,
} from "@signal-kernel/react";
import { devopsGraph } from "../graph/devopsGraph";

function StatusLine(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-800 py-2 last:border-b-0">
      <span className="text-zinc-400">{props.label}</span>
      <span className="font-mono text-sm text-white">{props.value}</span>
    </div>
  );
}

export function ReactPanel() {
  const selectedCommit = useSignalValue(devopsGraph.signals.selectedCommit);
  const approved = useSignalValue(devopsGraph.signals.manualApproval);
  const [ciStatus, ciMeta] = useResource(devopsGraph.resources.ciStatus);
  const [artifactStatus, artifactMeta] = useResource(
    devopsGraph.resources.artifactStatus,
  );
  const [deploymentStatus, deploymentMeta] = useResource(
    devopsGraph.resources.deploymentStatus,
  );
  const [healthEvents, healthMeta] = useStreamResource(
    devopsGraph.resources.healthEvents,
  );
  const decisions = useComputedValue(devopsGraph.computed.decisions);
  const health = decisions.health.latest;

  return (
    <article className="h-full rounded-lg border border-cyan-900/70 bg-cyan-950/20 p-4">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          React + signal-kernel
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          Operational snapshot
        </h2>
        <p className="mt-2 text-sm leading-5 text-cyan-100/80">
          React renders graph decisions. It does not own rollout logic.
        </p>
      </div>

      <div className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 text-sm">
        <StatusLine label="Commit" value={selectedCommit} />
        <StatusLine label="Phase" value={decisions.phase} />
        <StatusLine label="Can deploy" value={String(decisions.canDeploy)} />
        <StatusLine label="Can promote" value={String(decisions.canPromote)} />
        <StatusLine label="Risk" value={decisions.riskLevel} />
        <StatusLine label="Approval" value={approved ? "granted" : "missing"} />
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <StatusLine label="CI" value={ciStatus?.state ?? ciMeta.status()} />
        <StatusLine
          label="Artifact"
          value={artifactStatus?.state ?? artifactMeta.status()}
        />
        <StatusLine
          label="Deployment"
          value={deploymentStatus?.state ?? deploymentMeta.status()}
        />
        <StatusLine label="Health" value={decisions.health.state} />
      </div>

      <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
        <p className="text-xs font-medium text-zinc-400">Blocked reason</p>
        <p className="mt-1 text-sm text-white">
          {decisions.blockedReason ?? "No active block"}
        </p>
      </div>

      <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
        <p className="text-xs font-medium text-zinc-400">
          Health stream ({healthMeta.status()})
        </p>
        <p className="mt-1 text-sm text-white">
          {health
            ? `${health.message} (${health.latencyMs}ms, ${(health.errorRate * 100).toFixed(1)}% errors)`
            : `${healthEvents?.length ?? 0} events observed`}
        </p>
      </div>
    </article>
  );
}
