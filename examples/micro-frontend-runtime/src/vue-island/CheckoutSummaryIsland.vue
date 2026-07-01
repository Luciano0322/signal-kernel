<script setup lang="ts">
import { computed } from "vue";
import {
  useKernelValue,
  useResource,
} from "@signal-kernel/vue";
import type { CommerceGraphContract } from "../shared-graph/graphContract";

const props = defineProps<{
  graph: CommerceGraphContract;
}>();

const graph = props.graph;

const selectedAccount = useKernelValue(graph.selectors.selectedAccount);
const selectedRegion = useKernelValue(graph.selectors.selectedRegion);
const cartSummary = useKernelValue(graph.selectors.cartSummary);
const checkout = useKernelValue(graph.selectors.checkout);
const pricing = useResource(graph.resources.pricing);
const inventory = useResource(graph.resources.inventory);

const inventoryLines = computed(() => inventory.value.value?.lines ?? []);
const pricingKey = computed(() => pricing.value.value?.requestKey ?? "pending");
const totalLabel = computed(() => {
  const decision = checkout.value;

  if (decision.total == null || !decision.currency) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: decision.currency,
  }).format(decision.total);
});
</script>

<template>
  <article
    class="h-full rounded-lg border border-emerald-900/70 bg-emerald-950/20 p-4"
  >
    <div class="mb-4">
      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
        Vue island
      </p>
      <h2 class="mt-1 text-lg font-semibold text-white">Checkout summary</h2>
      <p class="mt-2 text-sm leading-5 text-emerald-100/80">
        Receives the same graph contract. It never calls React state.
      </p>
    </div>

    <div class="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 text-sm">
      <div
        class="flex items-center justify-between gap-3 border-b border-zinc-800 py-2"
      >
        <span class="text-zinc-400">Account</span>
        <span class="font-mono text-sm text-white">{{ selectedAccount }}</span>
      </div>
      <div
        class="flex items-center justify-between gap-3 border-b border-zinc-800 py-2"
      >
        <span class="text-zinc-400">Region</span>
        <span class="font-mono text-sm text-white">{{ selectedRegion }}</span>
      </div>
      <div
        class="flex items-center justify-between gap-3 border-b border-zinc-800 py-2"
      >
        <span class="text-zinc-400">Items</span>
        <span class="font-mono text-sm text-white">{{ cartSummary.itemCount }}</span>
      </div>
      <div
        class="flex items-center justify-between gap-3 border-b border-zinc-800 py-2"
      >
        <span class="text-zinc-400">Pricing</span>
        <span class="font-mono text-sm text-white">{{ pricing.status }}</span>
      </div>
      <div
        class="flex items-center justify-between gap-3 border-b border-zinc-800 py-2"
      >
        <span class="text-zinc-400">Inventory</span>
        <span class="font-mono text-sm text-white">{{ inventory.status }}</span>
      </div>
      <div class="flex items-center justify-between gap-3 py-2">
        <span class="text-zinc-400">Checkout</span>
        <span class="font-mono text-sm text-white">
          {{ checkout.canCheckout ? "allowed" : "blocked" }}
        </span>
      </div>
    </div>

    <div class="mt-4 rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
      <p class="text-xs font-medium text-zinc-400">Total</p>
      <p class="mt-1 text-2xl font-semibold text-white">{{ totalLabel }}</p>
      <p class="mt-2 text-sm text-zinc-300">
        {{ checkout.blockedReason ?? "All checkout gates passed" }}
      </p>
    </div>

    <div class="mt-4 rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
      <p class="text-xs font-medium text-zinc-400">Inventory details</p>
      <ul class="mt-2 space-y-1 text-sm text-zinc-300">
        <template v-if="inventoryLines.length === 0">
          <li>No inventory result yet</li>
        </template>
        <template v-else>
          <li v-for="line in inventoryLines" :key="line.itemId">
            {{ line.itemId }}: {{ line.requested }}/{{ line.available }}
            {{ line.ok ? "available" : "blocked" }}
          </li>
        </template>
      </ul>
    </div>

    <div class="mt-4 rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
      <p class="text-xs font-medium text-zinc-400">Pricing key</p>
      <p class="mt-1 break-all font-mono text-xs text-zinc-300">
        {{ pricingKey }}
      </p>
    </div>
  </article>
</template>
