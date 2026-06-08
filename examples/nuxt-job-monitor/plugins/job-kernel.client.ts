import { defineNuxtPlugin } from "nuxt/app";
import { createJobKernel, createMockJobTransport } from "../job-kernel";

export default defineNuxtPlugin(() => {
  const kernel = createJobKernel({
    transport: createMockJobTransport(),
  });

  kernel.actions.start();

  window.addEventListener("beforeunload", kernel.actions.stop);

  return {
    provide: {
      jobKernel: kernel,
    },
  };
});
