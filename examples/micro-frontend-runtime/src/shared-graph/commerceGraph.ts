import { computed, signal } from "@signal-kernel/core";
import { createResource } from "@signal-kernel/async-runtime";
import { accounts, catalog, getAccount, getCatalogOrder } from "./fixtures";
import { fakeInventoryApi } from "./fakeInventoryApi";
import { fakePricingApi } from "./fakePricingApi";
import { createRequestKey } from "./requestKey";
import type { CommerceGraphContract } from "./graphContract";
import type {
  AccountId,
  CartItem,
  CheckoutDecision,
  InventoryRequest,
  InventoryResult,
  ItemId,
  PricingRequest,
  PricingResult,
  Readable,
  Region,
  ResourceTuple,
  ShellEvent,
} from "./types";

let nextGraphId = 0;

function asReadable<T>(source: Readable<T>): Readable<T> {
  source.get();

  return {
    get: source.get,
    peek: source.peek,
  };
}

function cloneCart(items: CartItem[]) {
  return items.map((item) => ({ ...item }));
}

function readonlyRecords<T extends object>(items: readonly T[]): readonly T[] {
  return Object.freeze(
    items.map((item) => Object.freeze({ ...item }) as T),
  );
}

function normalizeCart(items: CartItem[]) {
  return items
    .filter((item) => item.quantity > 0)
    .sort((a, b) => getCatalogOrder(a.itemId) - getCatalogOrder(b.itemId));
}

function formatMoney(value: number) {
  return Number(value.toFixed(2));
}

export function createCommerceGraph(): CommerceGraphContract {
  const selectedAccount = signal<AccountId>("account-a");
  const selectedRegion = signal<Region>("us-east");
  const cartItems = signal<CartItem[]>([]);
  const eventLog = signal<ShellEvent[]>([]);
  const catalogSelector = computed(() => readonlyRecords(catalog));
  const accountsSelector = computed(() => readonlyRecords(accounts));
  const cartItemsSelector = computed(() => readonlyRecords(cartItems.get()));
  const eventLogSelector = computed(() => readonlyRecords(eventLog.get()));

  const graphId = `commerce-graph-${++nextGraphId}`;
  let nextEventId = 0;

  function recordEvent(event: Omit<ShellEvent, "id" | "at">) {
    eventLog.set([
      ...eventLog.peek(),
      {
        id: ++nextEventId,
        at: Date.now(),
        ...event,
      },
    ]);
  }

  const cartSummary = computed(() => {
    const items = cartItems.get();

    return {
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: items.reduce((sum, item) => {
        const catalogItem = catalog.find((entry) => entry.id === item.itemId);
        return sum + (catalogItem?.unitPrice ?? 0) * item.quantity;
      }, 0),
    };
  });

  const pricingRequest = computed<PricingRequest>(() => {
    const accountId = selectedAccount.get();
    const region = selectedRegion.get();
    const items = cloneCart(cartItems.get());

    return {
      accountId,
      region,
      items,
      requestKey: createRequestKey(accountId, region, items),
    };
  });

  const inventoryRequest = computed<InventoryRequest>(() => {
    const accountId = selectedAccount.get();
    const region = selectedRegion.get();
    const items = cloneCart(cartItems.get());

    return {
      accountId,
      region,
      items,
      requestKey: createRequestKey(accountId, region, items),
    };
  });

  const pricing = createResource<PricingRequest, PricingResult>(
    pricingRequest.get,
    (request, ctx) => fakePricingApi(request, recordEvent, ctx),
    { keepPreviousValueOnPending: true },
  ) satisfies ResourceTuple<PricingResult>;

  const inventory = createResource<InventoryRequest, InventoryResult>(
    inventoryRequest.get,
    (request, ctx) => fakeInventoryApi(request, recordEvent, ctx),
    { keepPreviousValueOnPending: true },
  ) satisfies ResourceTuple<InventoryResult>;

  const checkout = computed<CheckoutDecision>(() => {
    const request = pricingRequest.get();
    const cart = cartItems.get();
    const account = getAccount(selectedAccount.get());
    const pricingResult = pricing[0]();
    const inventoryResult = inventory[0]();
    const pricingMatches = pricingResult?.requestKey === request.requestKey;
    const inventoryMatches = inventoryResult?.requestKey === request.requestKey;
    const unavailableItems = inventoryMatches
      ? inventoryResult.lines.filter((line) => !line.ok)
      : [];

    if (cart.length === 0) {
      return {
        canCheckout: false,
        blockedReason: "Cart is empty",
        total: null,
        currency: null,
        unavailableItems: [],
      };
    }

    if (!account.checkoutEnabled) {
      return {
        canCheckout: false,
        blockedReason: "Account entitlement blocks checkout",
        total: null,
        currency: null,
        unavailableItems: [],
      };
    }

    if (!pricingMatches) {
      return {
        canCheckout: false,
        blockedReason: "Pricing is pending",
        total: null,
        currency: null,
        unavailableItems: [],
      };
    }

    if (!inventoryMatches) {
      return {
        canCheckout: false,
        blockedReason: "Inventory is pending",
        total: pricingResult.total,
        currency: pricingResult.currency,
        unavailableItems: [],
      };
    }

    if (!inventoryResult.allAvailable) {
      return {
        canCheckout: false,
        blockedReason: "Some cart items are unavailable",
        total: pricingResult.total,
        currency: pricingResult.currency,
        unavailableItems,
      };
    }

    return {
      canCheckout: true,
      blockedReason: null,
      total: formatMoney(pricingResult.total),
      currency: pricingResult.currency,
      unavailableItems: [],
    };
  });

  function setCart(nextItems: CartItem[]) {
    cartItems.set(normalizeCart(nextItems));
  }

  function selectAccount(accountId: AccountId) {
    selectedAccount.set(accountId);
    recordEvent({
      source: "graph",
      phase: "action",
      accountId,
      region: selectedRegion.peek(),
      message: `Selected account ${accountId}`,
    });
  }

  function selectRegion(region: Region) {
    selectedRegion.set(region);
    recordEvent({
      source: "graph",
      phase: "action",
      accountId: selectedAccount.peek(),
      region,
      message: `Selected region ${region}`,
    });
  }

  function addItem(itemId: ItemId) {
    const existing = cartItems.peek().find((item) => item.itemId === itemId);
    const nextItems = existing
      ? cartItems
          .peek()
          .map((item) =>
            item.itemId === itemId
              ? { ...item, quantity: Math.min(item.quantity + 1, 9) }
              : item,
          )
      : [...cartItems.peek(), { itemId, quantity: 1 }];

    setCart(nextItems);
    recordEvent({
      source: "graph",
      phase: "action",
      accountId: selectedAccount.peek(),
      region: selectedRegion.peek(),
      message: `Added ${itemId}`,
    });
  }

  function removeItem(itemId: ItemId) {
    setCart(cartItems.peek().filter((item) => item.itemId !== itemId));
    recordEvent({
      source: "graph",
      phase: "action",
      accountId: selectedAccount.peek(),
      region: selectedRegion.peek(),
      message: `Removed ${itemId}`,
    });
  }

  function changeQuantity(itemId: ItemId, quantity: number) {
    const boundedQuantity = Math.max(0, Math.min(9, Math.floor(quantity)));
    const nextItems = cartItems
      .peek()
      .map((item) =>
        item.itemId === itemId
          ? { ...item, quantity: boundedQuantity }
          : item,
      );

    setCart(nextItems);
    recordEvent({
      source: "graph",
      phase: "action",
      accountId: selectedAccount.peek(),
      region: selectedRegion.peek(),
      message: `Changed ${itemId} quantity to ${boundedQuantity}`,
    });
  }

  function clearCart() {
    setCart([]);
    recordEvent({
      source: "graph",
      phase: "action",
      accountId: selectedAccount.peek(),
      region: selectedRegion.peek(),
      message: "Cleared cart",
    });
  }

  return {
    identity: {
      graphId,
      contractVersion: "commerce-graph/v1",
    },
    selectors: {
      accounts: asReadable(accountsSelector),
      catalog: asReadable(catalogSelector),
      selectedAccount: asReadable(selectedAccount),
      selectedRegion: asReadable(selectedRegion),
      cartItems: asReadable(cartItemsSelector),
      cartSummary: asReadable(cartSummary),
      checkout: asReadable(checkout),
      eventLog: asReadable(eventLogSelector),
    },
    resources: {
      pricing,
      inventory,
    },
    actions: {
      selectAccount,
      selectRegion,
      addItem,
      removeItem,
      changeQuantity,
      clearCart,
    },
  };
}
