import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCommerceGraph } from "./commerceGraph";
import type { CartItem } from "./types";

async function flushGraph() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("commerce graph contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes selectors, resources, and actions without raw writable signals", () => {
    const graph = createCommerceGraph();

    expect(Object.keys(graph).sort()).toEqual([
      "actions",
      "identity",
      "resources",
      "selectors",
    ]);
    expect("signals" in graph).toBe(false);
    expect("set" in graph.selectors.cartItems).toBe(false);
  });

  it("keeps selector array values isolated from direct island mutation", () => {
    const graph = createCommerceGraph();

    graph.actions.addItem("starter");

    const leakedCart = graph.selectors.cartItems.get() as CartItem[];

    expect(() => {
      leakedCart.push({ itemId: "enterprise", quantity: 9 });
    }).toThrow(TypeError);

    expect(graph.selectors.cartItems.get()).toEqual([
      { itemId: "starter", quantity: 1 },
    ]);
  });

  it("updates graph state through actions so all islands read the same cart", () => {
    const graph = createCommerceGraph();

    graph.actions.addItem("starter");
    graph.actions.addItem("starter");
    graph.actions.addItem("pro");
    graph.actions.changeQuantity("pro", 3);

    expect(graph.selectors.cartItems.get()).toEqual([
      { itemId: "starter", quantity: 2 },
      { itemId: "pro", quantity: 3 },
    ]);
    expect(graph.selectors.cartSummary.get()).toEqual({
      itemCount: 5,
      subtotal: 295,
    });
  });

  it("clears account-scoped cart and keeps latest pricing authoritative when account changes race", async () => {
    const graph = createCommerceGraph();
    const [pricing] = graph.resources.pricing;

    graph.actions.addItem("starter");
    await flushGraph();

    graph.actions.selectAccount("account-b");
    await flushGraph();

    expect(graph.selectors.cartItems.get()).toEqual([]);
    expect(pricing()).toBeUndefined();
    expect(graph.selectors.checkout.get()).toMatchObject({
      canCheckout: false,
      blockedReason: "Cart is empty",
    });

    await vi.advanceTimersByTimeAsync(800);
    await flushGraph();

    expect(pricing()?.accountId).toBe("account-b");

    await vi.advanceTimersByTimeAsync(3000);
    await flushGraph();

    expect(pricing()?.accountId).toBe("account-b");
    expect(
      graph.selectors.eventLog
        .get()
        .filter(
          (event) =>
            event.source === "pricing" &&
            event.phase === "resolve-ignored" &&
            event.accountId === "account-a",
        ).length,
    ).toBeGreaterThan(0);
  });

  it("keeps pricing visible when account entitlement blocks checkout", async () => {
    const graph = createCommerceGraph();

    graph.actions.selectAccount("account-b");
    graph.actions.addItem("starter");
    await flushGraph();

    await vi.advanceTimersByTimeAsync(1200);
    await flushGraph();

    expect(graph.selectors.checkout.get()).toMatchObject({
      canCheckout: false,
      blockedReason: "Account entitlement blocks checkout",
      currency: "USD",
      total: 23.2,
    });
  });

  it("allows checkout only when pricing, inventory, cart, and entitlement pass", async () => {
    const graph = createCommerceGraph();

    graph.actions.addItem("starter");
    await flushGraph();

    expect(graph.selectors.checkout.get().canCheckout).toBe(false);

    await vi.advanceTimersByTimeAsync(2700);
    await flushGraph();

    expect(graph.selectors.checkout.get()).toMatchObject({
      canCheckout: true,
      blockedReason: null,
      currency: "USD",
    });
  });

  it("blocks checkout when inventory is unavailable in the selected region", async () => {
    const graph = createCommerceGraph();

    graph.actions.selectRegion("eu-west");
    graph.actions.addItem("pro");
    await flushGraph();

    await vi.advanceTimersByTimeAsync(2700);
    await flushGraph();

    expect(graph.selectors.checkout.get()).toMatchObject({
      canCheckout: false,
      blockedReason: "Some cart items are unavailable",
    });
    expect(graph.selectors.checkout.get().unavailableItems).toEqual([
      {
        itemId: "pro",
        requested: 1,
        available: 0,
        ok: false,
      },
    ]);
  });
});
