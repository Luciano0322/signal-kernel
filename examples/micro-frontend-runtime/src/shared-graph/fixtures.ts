import type {
  Account,
  AccountId,
  CatalogItem,
  Currency,
  ItemId,
  Region,
} from "./types";

export const accounts: Account[] = [
  {
    id: "account-a",
    name: "Acme Growth",
    tier: "growth",
    discountRate: 0.1,
    checkoutEnabled: true,
  },
  {
    id: "account-b",
    name: "Beta Pilot",
    tier: "pilot",
    discountRate: 0.2,
    checkoutEnabled: false,
  },
];

export const catalog: CatalogItem[] = [
  {
    id: "starter",
    name: "Starter seats",
    description: "Base collaboration package",
    unitPrice: 29,
  },
  {
    id: "pro",
    name: "Pro automation",
    description: "Workflow automation package",
    unitPrice: 79,
  },
  {
    id: "enterprise",
    name: "Enterprise controls",
    description: "Advanced compliance controls",
    unitPrice: 149,
  },
];

export const regions: Region[] = ["us-east", "eu-west"];

export const currencyByRegion: Record<Region, Currency> = {
  "us-east": "USD",
  "eu-west": "EUR",
};

export const regionMultiplier: Record<Region, number> = {
  "us-east": 1,
  "eu-west": 1.08,
};

export const inventoryByRegion: Record<Region, Record<ItemId, number>> = {
  "us-east": {
    starter: 12,
    pro: 6,
    enterprise: 2,
  },
  "eu-west": {
    starter: 4,
    pro: 0,
    enterprise: 1,
  },
};

export function getAccount(accountId: AccountId) {
  return accounts.find((account) => account.id === accountId) ?? accounts[0];
}

export function getCatalogItem(itemId: ItemId) {
  return catalog.find((item) => item.id === itemId) ?? catalog[0];
}

export function getCatalogOrder(itemId: ItemId) {
  return catalog.findIndex((item) => item.id === itemId);
}
