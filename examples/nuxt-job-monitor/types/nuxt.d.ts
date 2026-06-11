import type { JobKernel } from "../job-kernel";

declare module "#app" {
  interface NuxtApp {
    $jobKernel: JobKernel;
  }
}

declare module "vue" {
  interface ComponentCustomProperties {
    $jobKernel: JobKernel;
  }
}

export {};
