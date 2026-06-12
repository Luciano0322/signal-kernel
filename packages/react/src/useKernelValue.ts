import { useReadableValue } from "./readable.js";
import type { Readable } from "./types.js";

export function useKernelValue<T>(src: Readable<T>): T {
  return useReadableValue(src, {
    snapshot: "get",
    track: "get",
  });
}
