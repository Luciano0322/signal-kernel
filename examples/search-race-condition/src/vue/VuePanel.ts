import { defineComponent, h } from "vue";
import { useResource, useSignalValue } from "@signal-kernel/vue";
import { searchRaceGraph } from "../graph/searchGraph";

export const VuePanel = defineComponent({
  name: "VuePanel",
  setup() {
    const query = useSignalValue(searchRaceGraph.query);
    const resource = useResource(searchRaceGraph.searchResource);

    return () => {
      const result = resource.value.value;
      const status = resource.status.value;
      const isStale = Boolean(result?.query && query.value && result.query !== query.value);

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
            h("h2", { class: "mt-1 text-lg font-semibold text-white" }, "Thin Vue adapter"),
            h(
              "p",
              { class: "mt-2 text-sm leading-5 text-emerald-100/80" },
              "Vue renders readonly refs from the shared graph.",
            ),
          ]),
          h("dl", { class: "grid grid-cols-2 gap-3 text-sm" }, [
            h("div", [
              h("dt", { class: "text-zinc-400" }, "Query"),
              h("dd", { class: "font-mono text-white" }, query.value || "-"),
            ]),
            h("div", [
              h("dt", { class: "text-zinc-400" }, "Status"),
              h("dd", { class: "font-mono text-white" }, status),
            ]),
          ]),
          h(
            "div",
            {
              class: `mt-4 rounded-md border p-3 ${
                isStale
                  ? "border-rose-400 bg-rose-500/10"
                  : "border-zinc-800 bg-zinc-950/60"
              }`,
            },
            [
              h(
                "p",
                {
                  class: `text-xs font-medium ${
                    isStale ? "text-rose-200" : "text-zinc-400"
                  }`,
                },
                "Latest-wins result",
              ),
              h(
                "p",
                { class: "mt-1 font-mono text-sm text-white" },
                result?.query ? `results for "${result.query}"` : "No result yet",
              ),
            ],
          ),
          h(
            "ul",
            { class: "mt-4 space-y-2 text-sm text-zinc-300" },
            (result?.items ?? []).map((item) => h("li", { key: item }, item)),
          ),
        ],
      );
    };
  },
});
