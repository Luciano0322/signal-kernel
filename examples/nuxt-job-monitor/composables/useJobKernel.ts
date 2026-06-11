import { useNuxtApp } from "nuxt/app";

export function useJobKernel() {
  const { $jobKernel } = useNuxtApp();
  return $jobKernel;
}
