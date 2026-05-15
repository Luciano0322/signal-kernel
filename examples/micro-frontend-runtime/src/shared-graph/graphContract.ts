import type {
  Account,
  AccountId,
  CartItem,
  CartSummary,
  CatalogItem,
  CheckoutDecision,
  InventoryResult,
  ItemId,
  PricingResult,
  Readable,
  Region,
  ResourceTuple,
  ShellEvent,
} from "./types";

export interface CommerceGraphContract {
  identity: {
    graphId: string;
    contractVersion: "commerce-graph/v1";
  };
  selectors: {
    accounts: Readable<readonly Account[]>;
    catalog: Readable<readonly CatalogItem[]>;
    selectedAccount: Readable<AccountId>;
    selectedRegion: Readable<Region>;
    cartItems: Readable<readonly CartItem[]>;
    cartSummary: Readable<CartSummary>;
    checkout: Readable<CheckoutDecision>;
    eventLog: Readable<readonly ShellEvent[]>;
  };
  resources: {
    pricing: ResourceTuple<PricingResult>;
    inventory: ResourceTuple<InventoryResult>;
  };
  actions: {
    selectAccount(accountId: AccountId): void;
    selectRegion(region: Region): void;
    addItem(itemId: ItemId): void;
    removeItem(itemId: ItemId): void;
    changeQuantity(itemId: ItemId, quantity: number): void;
    clearCart(): void;
  };
}
