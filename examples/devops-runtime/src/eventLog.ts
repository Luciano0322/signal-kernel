import { createEffect } from "@signal-kernel/core";
import { escapeHtml } from "./dom/escapeHtml";
import type { OpsEvent } from "./graph/types";

export function mountEventLog(root: HTMLElement, events: { get(): OpsEvent[] }) {
  return createEffect(() => {
    const rows = events.get().slice(-18).reverse();

    root.innerHTML = rows.length
      ? rows
          .map(
            (event) => `
              <li class="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <span class="font-mono text-xs text-zinc-300">#${event.id} ${event.source}:${event.phase}</span>
                  <span class="font-mono text-xs text-zinc-500">${event.commitId ?? "-"}${event.delay ? ` ${event.delay}ms` : ""}</span>
                </div>
                <p class="mt-1 text-sm text-zinc-300">${escapeHtml(event.message)}</p>
              </li>
            `,
          )
          .join("")
      : `<li class="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-400">Select a commit or request a rollout to see operational state changes.</li>`;
  });
}
