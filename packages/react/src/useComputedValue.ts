import { useReadableValue } from "./readable.js";
import { Readable } from "./types.js";

export function useComputedValue<T>(src: Readable<T>): T {
  return useReadableValue(src);
}
