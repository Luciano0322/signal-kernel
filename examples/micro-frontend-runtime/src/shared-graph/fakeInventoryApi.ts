import type { ResourceContext } from "@signal-kernel/async-runtime";
import { inventoryByRegion } from "./fixtures";
import type { InventoryRequest, InventoryResult, ShellEvent } from "./types";

function getInventoryDelay(request: InventoryRequest) {
  if (request.items.length === 0) return 80;
  return request.region === "us-east" ? 1100 : 500;
}

export function fakeInventoryApi(
  request: InventoryRequest,
  recordEvent: (event: Omit<ShellEvent, "id" | "at">) => void,
  ctx: ResourceContext,
): Promise<InventoryResult> {
  const delay = getInventoryDelay(request);

  recordEvent({
    source: "inventory",
    phase: "start",
    accountId: request.accountId,
    region: request.region,
    requestKey: request.requestKey,
    delay,
    message: `Inventory check started for ${request.requestKey}`,
  });

  return new Promise((resolve) => {
    globalThis.setTimeout(() => {
      const inventory = inventoryByRegion[request.region];
      const lines = request.items.map((item) => {
        const available = inventory[item.itemId] ?? 0;

        return {
          itemId: item.itemId,
          requested: item.quantity,
          available,
          ok: available >= item.quantity,
        };
      });
      const ignored = ctx.signal.aborted;

      recordEvent({
        source: "inventory",
        phase: ignored ? "resolve-ignored" : "resolve",
        accountId: request.accountId,
        region: request.region,
        requestKey: request.requestKey,
        delay,
        message: `Inventory check resolved for ${request.requestKey}`,
      });

      resolve({
        accountId: request.accountId,
        region: request.region,
        requestKey: request.requestKey,
        lines,
        allAvailable: lines.every((line) => line.ok),
      });
    }, delay);
  });
}
