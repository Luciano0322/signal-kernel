import { useKernelValue } from "./useKernelValue.js";
import type { Readable } from "./types.js";

export function useComputedValue<T>(src: Readable<T>): T {
  return useKernelValue(src);
}
