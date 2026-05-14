import { createEffect } from "@signal-kernel/core";
import { escapeHtml } from "./dom/escapeHtml";
import type { SearchEvent } from "./graph/types";

function formatPhase(event: SearchEvent) {
  if (event.phase === "resolve-ignored") return "resolved after cancellation";
  if (event.phase === "commit") return "committed to visible state";
  return event.phase;
}

function formatMode(event: SearchEvent) {
  return event.mode === "signal-kernel" ? "signal-kernel" : "naive";
}

export function mountEventLog(root: HTMLElement, events: { get(): SearchEvent[] }) {
  return createEffect(() => {
    const rows = events.get().slice(-16).reverse();

    root.innerHTML = rows.length
      ? rows
          .map(
            (event) => `
              <li class="flex flex-col gap-1 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 md:flex-row md:items-center md:justify-between">
                <span class="font-mono text-xs text-zinc-300">${formatMode(event)} #${event.id > 0 ? event.id : "-"} ${formatPhase(event)}</span>
                <span class="font-mono text-xs text-zinc-400">query="${escapeHtml(event.query)}" delay=${event.delay}ms</span>
              </li>
            `,
          )
          .join("")
      : `<li class="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-400">Run the race sequence to see request ordering.</li>`;
  });
}
