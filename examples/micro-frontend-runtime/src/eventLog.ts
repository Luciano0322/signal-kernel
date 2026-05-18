import { createEffect } from "@signal-kernel/core";
import type { Readable, ShellEvent } from "./shared-graph/types";

export function mountEventLog(
  root: HTMLElement,
  events: Readable<readonly ShellEvent[]>,
) {
  return createEffect(() => {
    const rows = events.get().slice(-18).reverse();

    root.replaceChildren(
      ...(rows.length
        ? rows.map((event) => {
            const item = document.createElement("li");
            item.className =
              "rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2";

            const header = document.createElement("div");
            header.className =
              "flex flex-col gap-1 md:flex-row md:items-center md:justify-between";

            const label = document.createElement("span");
            label.className = "font-mono text-xs text-zinc-300";
            label.textContent = `#${event.id} ${event.source}:${event.phase}`;

            const meta = document.createElement("span");
            meta.className = "font-mono text-xs text-zinc-500";
            meta.textContent = `${event.accountId ?? "-"} ${event.region ?? "-"}${
              event.delay ? ` ${event.delay}ms` : ""
            }`;

            const message = document.createElement("p");
            message.className = "mt-1 text-sm text-zinc-300";
            message.textContent = event.message;

            header.append(label, meta);
            item.append(header, message);

            return item;
          })
        : [createEmptyEventItem()]),
    );
  });
}

function createEmptyEventItem() {
  const item = document.createElement("li");
  item.className =
    "rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-400";
  item.textContent =
    "Use either island to change the cart, account, or region. Events will appear here.";
  return item;
}
