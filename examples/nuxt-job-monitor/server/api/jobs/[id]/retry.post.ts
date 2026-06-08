import { defineEventHandler } from "h3";
import { useJobStore } from "../../../utils/jobStore";

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id;

  if (!id) {
    event.node.res.statusCode = 400;
    return { ok: false, error: "Missing job id" };
  }

  await useJobStore().retryJob(decodeURIComponent(id));
  return { ok: true };
});
