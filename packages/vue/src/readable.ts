import { createEffect } from "@signal-kernel/core";
import { onScopeDispose, readonly, shallowRef, type Ref } from "vue";
import type { Readable } from "./types.js";

export function useReadableRef<T>(src: Readable<T>): Readonly<Ref<T>> {
  const value = shallowRef(src.peek()) as Ref<T>;

  const stop = createEffect(() => {
    value.value = src.get();
  });

  onScopeDispose(stop);

  return readonly(value) as Readonly<Ref<T>>;
}
