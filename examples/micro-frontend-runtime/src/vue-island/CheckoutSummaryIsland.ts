import { defineComponent, h } from "vue";
import {
  useComputedValue,
  useResource,
  useSignalValue,
} from "@signal-kernel/vue";
import type { CommerceGraphContract } from "../shared-graph/graphContract";

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

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

export function createCheckoutSummaryIsland(graph: CommerceGraphContract) {
  return defineComponent({
    name: "CheckoutSummaryIsland",
    setup() {
      const selectedAccount = useSignalValue(graph.selectors.selectedAccount);
      const selectedRegion = useSignalValue(graph.selectors.selectedRegion);
      const cartSummary = useComputedValue(graph.selectors.cartSummary);
      const checkout = useComputedValue(graph.selectors.checkout);
      const pricing = useResource(graph.resources.pricing);
      const inventory = useResource(graph.resources.inventory);

      return () => {
        const decision = checkout.value;
        const pricingValue = pricing.value.value;
        const inventoryValue = inventory.value.value;

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
                "Vue island",
              ),
              h(
                "h2",
                { class: "mt-1 text-lg font-semibold text-white" },
                "Checkout summary",
              ),
              h(
                "p",
                { class: "mt-2 text-sm leading-5 text-emerald-100/80" },
                "Receives the same graph contract. It never calls React state.",
              ),
            ]),
            h(
              "div",
              {
                class:
                  "rounded-md border border-zinc-800 bg-zinc-950/60 px-3 text-sm",
              },
              [
                statusLine("Account", selectedAccount.value),
                statusLine("Region", selectedRegion.value),
                statusLine("Items", String(cartSummary.value.itemCount)),
                statusLine("Pricing", pricing.status.value),
                statusLine("Inventory", inventory.status.value),
                statusLine(
                  "Checkout",
                  decision.canCheckout ? "allowed" : "blocked",
                ),
              ],
            ),
            h(
              "div",
              {
                class:
                  "mt-4 rounded-md border border-zinc-800 bg-zinc-950/60 p-3",
              },
              [
                h("p", { class: "text-xs font-medium text-zinc-400" }, "Total"),
                h(
                  "p",
                  { class: "mt-1 text-2xl font-semibold text-white" },
                  decision.total && decision.currency
                    ? formatMoney(decision.total, decision.currency)
                    : "--",
                ),
                h(
                  "p",
                  { class: "mt-2 text-sm text-zinc-300" },
                  decision.blockedReason ?? "All checkout gates passed",
                ),
              ],
            ),
            h(
              "div",
              {
                class:
                  "mt-4 rounded-md border border-zinc-800 bg-zinc-950/60 p-3",
              },
              [
                h(
                  "p",
                  { class: "text-xs font-medium text-zinc-400" },
                  "Inventory details",
                ),
                h(
                  "ul",
                  { class: "mt-2 space-y-1 text-sm text-zinc-300" },
                  inventoryValue?.lines.length
                    ? inventoryValue.lines.map((line) =>
                        h(
                          "li",
                          { key: line.itemId },
                          `${line.itemId}: ${line.requested}/${line.available} ${
                            line.ok ? "available" : "blocked"
                          }`,
                        ),
                      )
                    : [h("li", "No inventory result yet")],
                ),
              ],
            ),
            h(
              "div",
              {
                class:
                  "mt-4 rounded-md border border-zinc-800 bg-zinc-950/60 p-3",
              },
              [
                h("p", { class: "text-xs font-medium text-zinc-400" }, "Pricing key"),
                h(
                  "p",
                  { class: "mt-1 break-all font-mono text-xs text-zinc-300" },
                  pricingValue?.requestKey ?? "pending",
                ),
              ],
            ),
          ],
        );
      };
    },
  });
}
