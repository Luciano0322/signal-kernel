import { runFakeSearch } from "../graph/fakeSearchApi";
import type { SearchEvent, SearchResult } from "../graph/types";
import { escapeHtml } from "../dom/escapeHtml";

type NaiveState = {
  query: string;
  status: "idle" | "pending" | "success" | "error";
  result: SearchResult | undefined;
  error: unknown;
};

const emptyState: NaiveState = {
  query: "",
  status: "idle",
  result: undefined,
  error: undefined,
};

export function mountNaivePanel(
  root: HTMLElement,
  recordEvent: (event: SearchEvent) => void,
) {
  let state = { ...emptyState };

  function render() {
    const stale =
      state.result && state.query && state.result.query !== state.query;
    const query = escapeHtml(state.query || "-");
    const resultLabel = state.result?.query
      ? `results for "${escapeHtml(state.result.query)}"`
      : "No result yet";
    const resultItems = (state.result?.items ?? [])
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");

    root.innerHTML = `
      <article class="h-full rounded-lg border border-rose-900/70 bg-rose-950/20 p-4">
        <div class="mb-4">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-rose-300">Naive Promise</p>
          <h2 class="mt-1 text-lg font-semibold text-white">Broken comparison</h2>
          <p class="mt-2 text-sm leading-5 text-rose-100/80">No cancellation, request identity, or stale guard.</p>
        </div>
        <dl class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt class="text-zinc-400">Query</dt>
            <dd class="font-mono text-white">${query}</dd>
          </div>
          <div>
            <dt class="text-zinc-400">Status</dt>
            <dd class="font-mono text-white">${state.status}</dd>
          </div>
        </dl>
        <div class="mt-4 rounded-md border ${stale ? "border-rose-400 bg-rose-500/10" : "border-zinc-800 bg-zinc-950/60"} p-3">
          <p class="text-xs font-medium ${stale ? "text-rose-200" : "text-zinc-400"}">${stale ? "Stale overwrite bug" : "Visible result"}</p>
          <p class="mt-1 font-mono text-sm text-white">${resultLabel}</p>
        </div>
        <ul class="mt-4 space-y-2 text-sm text-zinc-300">
          ${resultItems}
        </ul>
      </article>
    `;
  }

  function reset() {
    state = { ...emptyState };
    render();
  }

  function search(query: string) {
    state = {
      ...state,
      query,
      status: query.trim() ? "pending" : "idle",
      error: undefined,
      result: query.trim() ? state.result : undefined,
    };
    render();

    if (!query.trim()) return;

    runFakeSearch(query, "naive", recordEvent)
      .then((result) => {
        state = {
          query: state.query,
          status: "success",
          result,
          error: undefined,
        };
        recordEvent({
          id: -1,
          mode: "naive",
          phase: "commit",
          query: result.query,
          delay: result.delay,
          at: Date.now(),
        });
        render();
      })
      .catch((error) => {
        state = {
          ...state,
          status: "error",
          error,
        };
        render();
      });
  }

  render();

  return {
    reset,
    search,
  };
}
