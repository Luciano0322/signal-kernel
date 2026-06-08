import type { JobTransport } from "./JobTransport";
import { createMockJobStore } from "./mockJobStore";

export function createMockJobTransport(): JobTransport {
  return createMockJobStore();
}
