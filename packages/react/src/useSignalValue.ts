import { useReadableValue } from "./readable.js";
import { Readable } from "./types.js";

export function useSignalValue<T>(src: Readable<T>): T {
  return useReadableValue(src);
}
