import { createEffect } from "@signal-kernel/core";
import { onScopeDispose, readonly, shallowRef, type Ref } from "vue";

export function useReactive<T>(read: () => T): Readonly<Ref<T>> {
  const value = shallowRef<T>() as Ref<T>;

  const stop = createEffect(() => {
    value.value = read();
  });

  onScopeDispose(stop);

  return readonly(value) as Readonly<Ref<T>>;
}
