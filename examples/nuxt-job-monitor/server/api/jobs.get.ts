import { defineEventHandler } from "h3";
import { useJobStore } from "../utils/jobStore";

export default defineEventHandler(() => {
  return useJobStore().fetchJobs();
});
