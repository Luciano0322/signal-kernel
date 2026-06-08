import { defineNuxtPlugin } from "nuxt/app";
import { createJobKernel, createNuxtJobTransport } from "../job-kernel";

export default defineNuxtPlugin(() => {
  const kernel = createJobKernel({
    transport: createNuxtJobTransport(),
  });

  kernel.actions.start();

  window.addEventListener("beforeunload", kernel.actions.stop);

  return {
    provide: {
      jobKernel: kernel,
    },
  };
});
