import { computed } from "@signal-kernel/core";
import type { Readable } from "./types";

export function createSelector<T>(read: () => T): Readable<T> {
  const memo = computed(read);

  memo.get();

  return {
    get: memo.get,
    peek: memo.peek,
  };
}
