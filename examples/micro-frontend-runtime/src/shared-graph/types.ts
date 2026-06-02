import type { AsyncMeta } from "@signal-kernel/async-runtime";

export type AccountId = "account-a" | "account-b";
export type Region = "us-east" | "eu-west";
export type ItemId = "starter" | "pro" | "enterprise";
export type Currency = "USD" | "EUR";

export interface Readable<T> {
  get(): T;
  peek(): T;
}

export type ResourceTuple<T, E = unknown> = [
  value: () => T | undefined,
  meta: AsyncMeta<E, T>,
];

export interface Account {
  id: AccountId;
  name: string;
  tier: "growth" | "pilot";
  discountRate: number;
  checkoutEnabled: boolean;
}

export interface CatalogItem {
  id: ItemId;
  name: string;
  description: string;
  unitPrice: number;
}

export interface CartItem {
  itemId: ItemId;
  quantity: number;
}

export interface CartSummary {
  itemCount: number;
  subtotal: number;
}

export interface PricingRequest {
  accountId: AccountId;
  region: Region;
  items: CartItem[];
  requestKey: string;
}

export interface PricingLine {
  itemId: ItemId;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PricingResult {
  accountId: AccountId;
  region: Region;
  requestKey: string;
  currency: Currency;
  subtotal: number;
  discount: number;
  total: number;
  lines: PricingLine[];
}

export interface InventoryRequest {
  accountId: AccountId;
  region: Region;
  items: CartItem[];
  requestKey: string;
}

export interface InventoryLine {
  itemId: ItemId;
  requested: number;
  available: number;
  ok: boolean;
}

export interface InventoryResult {
  accountId: AccountId;
  region: Region;
  requestKey: string;
  lines: InventoryLine[];
  allAvailable: boolean;
}

export interface CheckoutDecision {
  canCheckout: boolean;
  blockedReason: string | null;
  total: number | null;
  currency: Currency | null;
  unavailableItems: InventoryLine[];
}

export type ShellEventSource = "graph" | "pricing" | "inventory";
export type ShellEventPhase =
  | "action"
  | "start"
  | "resolve"
  | "resolve-ignored";

export interface ShellEvent {
  id: number;
  source: ShellEventSource;
  phase: ShellEventPhase;
  message: string;
  accountId?: AccountId;
  region?: Region;
  requestKey?: string;
  delay?: number;
  at: number;
}
