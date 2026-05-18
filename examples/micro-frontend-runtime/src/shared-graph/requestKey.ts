import type { AccountId, CartItem, Region } from "./types";

export function createRequestKey(
  accountId: AccountId,
  region: Region,
  items: CartItem[],
) {
  const cartKey = items
    .map((item) => `${item.itemId}:${item.quantity}`)
    .join(",");

  return `${accountId}|${region}|${cartKey || "empty"}`;
}
