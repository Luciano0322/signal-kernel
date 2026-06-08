import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@signal-kernel/core": fileURLToPath(
        new URL("../../packages/core/src/index.ts", import.meta.url),
      ),
      "@signal-kernel/async-runtime": fileURLToPath(
        new URL("../../packages/async-runtime/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["job-kernel/**/*.test.ts"],
  },
});
