import { useKernelValue, useResource } from "@signal-kernel/react";
import { searchRaceGraph } from "../graph/searchGraph";

export function ReactPanel() {
  const query = useKernelValue(searchRaceGraph.query);
  const [result, meta] = useResource(searchRaceGraph.searchResource);
  const status = meta.status();
  const stale = Boolean(result?.query && query && result.query !== query);

  return (
    <article className="h-full rounded-lg border border-cyan-900/70 bg-cyan-950/20 p-4">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          React + signal-kernel
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">Thin React adapter</h2>
        <p className="mt-2 text-sm leading-5 text-cyan-100/80">
          React renders snapshots from the shared graph.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-zinc-400">Query</dt>
          <dd className="font-mono text-white">{query || "-"}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Status</dt>
          <dd className="font-mono text-white">{status}</dd>
        </div>
      </dl>

      <div
        className={`mt-4 rounded-md border p-3 ${
          stale
            ? "border-rose-400 bg-rose-500/10"
            : "border-zinc-800 bg-zinc-950/60"
        }`}
      >
        <p className={`text-xs font-medium ${stale ? "text-rose-200" : "text-zinc-400"}`}>
          Latest-wins result
        </p>
        <p className="mt-1 font-mono text-sm text-white">
          {result?.query ? `results for "${result.query}"` : "No result yet"}
        </p>
      </div>

      <ul className="mt-4 space-y-2 text-sm text-zinc-300">
        {(result?.items ?? []).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}
