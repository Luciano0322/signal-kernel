import type { ResourceContext } from "@signal-kernel/async-runtime";
import {
  currencyByRegion,
  getAccount,
  getCatalogItem,
  regionMultiplier,
} from "./fixtures";
import type { PricingRequest, PricingResult, ShellEvent } from "./types";

function getPricingDelay(request: PricingRequest) {
  if (request.items.length === 0) return 80;
  return request.accountId === "account-a" ? 2600 : 700;
}

export function fakePricingApi(
  request: PricingRequest,
  recordEvent: (event: Omit<ShellEvent, "id" | "at">) => void,
  ctx: ResourceContext,
): Promise<PricingResult> {
  const delay = getPricingDelay(request);

  recordEvent({
    source: "pricing",
    phase: "start",
    accountId: request.accountId,
    region: request.region,
    requestKey: request.requestKey,
    delay,
    message: `Pricing started for ${request.requestKey}`,
  });

  return new Promise((resolve) => {
    globalThis.setTimeout(() => {
      const account = getAccount(request.accountId);
      const lines = request.items.map((item) => {
        const catalogItem = getCatalogItem(item.itemId);
        const lineTotal = catalogItem.unitPrice * item.quantity;

        return {
          itemId: item.itemId,
          quantity: item.quantity,
          unitPrice: catalogItem.unitPrice,
          lineTotal,
        };
      });
      const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
      const regionalSubtotal = subtotal * regionMultiplier[request.region];
      const discount = regionalSubtotal * account.discountRate;
      const total = Math.max(0, regionalSubtotal - discount);
      const ignored = ctx.signal.aborted;

      recordEvent({
        source: "pricing",
        phase: ignored ? "resolve-ignored" : "resolve",
        accountId: request.accountId,
        region: request.region,
        requestKey: request.requestKey,
        delay,
        message: `Pricing resolved for ${request.requestKey}`,
      });

      resolve({
        accountId: request.accountId,
        region: request.region,
        requestKey: request.requestKey,
        currency: currencyByRegion[request.region],
        subtotal: regionalSubtotal,
        discount,
        total,
        lines,
      });
    }, delay);
  });
}
