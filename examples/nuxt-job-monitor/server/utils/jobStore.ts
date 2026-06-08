import { createMockJobStore } from "../../job-kernel/transport/mockJobStore";

const jobStore = createMockJobStore();

export function useJobStore() {
  return jobStore;
}
