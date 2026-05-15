import {
  useComputedValue,
  useResource,
  useSignalValue,
} from "@signal-kernel/react";
import type { CommerceGraphContract } from "../shared-graph/graphContract";
import type { CartItem, CatalogItem, ItemId } from "../shared-graph/types";

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

function getQuantity(items: readonly CartItem[], itemId: ItemId) {
  return items.find((item) => item.itemId === itemId)?.quantity ?? 0;
}

function CatalogRow(props: {
  item: CatalogItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-medium text-white">{props.item.name}</p>
          <p className="mt-1 text-sm text-zinc-400">{props.item.description}</p>
          <p className="mt-1 font-mono text-xs text-zinc-500">
            ${props.item.unitPrice}/unit
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="h-9 rounded-md border border-zinc-700 px-3 text-sm text-zinc-200 hover:border-zinc-500"
            onClick={props.onRemove}
            type="button"
          >
            Remove
          </button>
          <p className="flex h-9 w-16 items-center justify-center rounded-md border border-zinc-700 bg-zinc-950 px-2 text-center font-mono text-sm text-white">
            {props.quantity}
          </p>
          <button
            className="h-9 rounded-md bg-sky-400 px-3 text-sm font-semibold text-zinc-950 hover:bg-sky-300"
            onClick={props.onAdd}
            type="button"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

export function AccountCartIsland(props: { graph: CommerceGraphContract }) {
  const { graph } = props;
  const accounts = useComputedValue(graph.selectors.accounts);
  const catalog = useComputedValue(graph.selectors.catalog);
  const selectedAccount = useSignalValue(graph.selectors.selectedAccount);
  const selectedRegion = useSignalValue(graph.selectors.selectedRegion);
  const cartItems = useSignalValue(graph.selectors.cartItems);
  const cartSummary = useComputedValue(graph.selectors.cartSummary);
  const checkout = useComputedValue(graph.selectors.checkout);
  const [pricing, pricingMeta] = useResource(graph.resources.pricing);

  return (
    <article className="rounded-lg border border-sky-900/70 bg-sky-950/20 p-4">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
          React island
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          Account and cart editor
        </h2>
        <p className="mt-2 text-sm leading-5 text-sky-100/80">
          Receives the graph contract from the shell. Writes only through graph
          actions.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-zinc-300">
          Account
          <select
            className="h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-base text-white outline-none focus:border-sky-400"
            onChange={(event) =>
              graph.actions.selectAccount(event.target.value as typeof selectedAccount)
            }
            value={selectedAccount}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-zinc-300">
          Region
          <select
            className="h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-base text-white outline-none focus:border-sky-400"
            onChange={(event) =>
              graph.actions.selectRegion(event.target.value as typeof selectedRegion)
            }
            value={selectedRegion}
          >
            <option value="us-east">us-east</option>
            <option value="eu-west">eu-west</option>
          </select>
        </label>
      </div>

      <div className="mt-4 space-y-3">
        {catalog.map((item) => (
          <CatalogRow
            item={item}
            key={item.id}
            onAdd={() => graph.actions.addItem(item.id)}
            onRemove={() => graph.actions.removeItem(item.id)}
            quantity={getQuantity(cartItems, item.id)}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-3 rounded-md border border-zinc-800 bg-zinc-950/60 p-3 text-sm md:grid-cols-3">
        <div>
          <p className="text-zinc-400">Items</p>
          <p className="mt-1 font-mono text-white">{cartSummary.itemCount}</p>
        </div>
        <div>
          <p className="text-zinc-400">Pricing</p>
          <p className="mt-1 font-mono text-white">{pricingMeta.status()}</p>
        </div>
        <div>
          <p className="text-zinc-400">Checkout</p>
          <p className="mt-1 font-mono text-white">
            {checkout.canCheckout ? "allowed" : "blocked"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-zinc-300">
          {pricing && checkout.currency
            ? `Latest total: ${formatMoney(pricing.total, checkout.currency)}${
                checkout.blockedReason ? ` · ${checkout.blockedReason}` : ""
              }`
            : checkout.blockedReason}
        </p>
        <button
          className="h-10 rounded-md border border-zinc-700 px-4 text-sm font-semibold text-zinc-200 hover:border-zinc-500"
          onClick={() => graph.actions.clearCart()}
          type="button"
        >
          Clear cart
        </button>
      </div>
    </article>
  );
}
