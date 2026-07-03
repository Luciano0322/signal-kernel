import { defineComponent, h } from "vue";
import {
  useKernelValue,
  useResource,
} from "@signal-kernel/vue";
import { devopsGraph } from "../graph/devopsGraph";

function statusLine(label: string, value: string) {
  return h(
    "div",
    {
      class:
        "flex items-center justify-between gap-3 border-b border-zinc-800 py-2 last:border-b-0",
    },
    [
      h("span", { class: "text-zinc-400" }, label),
      h("span", { class: "font-mono text-sm text-white" }, value),
    ],
  );
}

export const VuePanel = defineComponent({
  name: "VuePanel",
  setup() {
    const selectedCommit = useKernelValue(devopsGraph.signals.selectedCommit);
    const approved = useKernelValue(devopsGraph.signals.manualApproval);
    const ci = useResource(devopsGraph.resources.ciStatus);
    const artifact = useResource(devopsGraph.resources.artifactStatus);
    const deployment = useResource(devopsGraph.resources.deploymentStatus);
    const decisions = useKernelValue(devopsGraph.computed.decisions);

    return () => {
      const snapshot = decisions.value;
      const latestHealth = snapshot.health.latest;

      return h(
        "article",
        {
          class:
            "h-full rounded-lg border border-emerald-900/70 bg-emerald-950/20 p-4",
        },
        [
          h("div", { class: "mb-4" }, [
            h(
              "p",
              {
                class:
                  "text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300",
              },
              "Vue + signal-kernel",
            ),
            h(
              "h2",
              { class: "mt-1 text-lg font-semibold text-white" },
              "Operational refs",
            ),
            h(
              "p",
              { class: "mt-2 text-sm leading-5 text-emerald-100/80" },
              "Vue renders readonly refs from the same operational graph.",
            ),
          ]),
          h(
            "div",
            { class: "rounded-md border border-zinc-800 bg-zinc-950/60 px-3 text-sm" },
            [
              statusLine("Commit", selectedCommit.value),
              statusLine("Phase", snapshot.phase),
              statusLine("Can deploy", String(snapshot.canDeploy)),
              statusLine("Can promote", String(snapshot.canPromote)),
              statusLine("Risk", snapshot.riskLevel),
              statusLine("Approval", approved.value ? "granted" : "missing"),
            ],
          ),
          h("div", { class: "mt-4 grid gap-3 text-sm md:grid-cols-2" }, [
            statusLine("CI", ci.value.value?.state ?? ci.status.value),
            statusLine(
              "Artifact",
              artifact.value.value?.state ?? artifact.status.value,
            ),
            statusLine(
              "Deployment",
              deployment.value.value?.state ?? deployment.status.value,
            ),
            statusLine("Health", snapshot.health.state),
          ]),
          h(
            "div",
            { class: "mt-4 rounded-md border border-zinc-800 bg-zinc-950/60 p-3" },
            [
              h("p", { class: "text-xs font-medium text-zinc-400" }, "Blocked reason"),
              h(
                "p",
                { class: "mt-1 text-sm text-white" },
                snapshot.blockedReason ?? "No active block",
              ),
            ],
          ),
          h(
            "div",
            { class: "mt-4 rounded-md border border-zinc-800 bg-zinc-950/60 p-3" },
            [
              h("p", { class: "text-xs font-medium text-zinc-400" }, "Health stream"),
              h(
                "p",
                { class: "mt-1 text-sm text-white" },
                latestHealth
                  ? `${latestHealth.message} (${latestHealth.latencyMs}ms, ${(latestHealth.errorRate * 100).toFixed(1)}% errors)`
                  : "No health events yet",
              ),
            ],
          ),
        ],
      );
    };
  },
});
