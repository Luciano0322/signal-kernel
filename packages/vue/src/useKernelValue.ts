import { useReadableRef } from "./readable.js";
import type { Readable } from "./types.js";
import type { Ref } from "vue";

export function useKernelValue<T>(src: Readable<T>): Readonly<Ref<T>> {
  return useReadableRef(src);
}
