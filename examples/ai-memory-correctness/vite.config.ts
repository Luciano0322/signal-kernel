import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const exampleRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(exampleRoot, "../..");

export default defineConfig({
  resolve: {
    alias: {
      "@signal-kernel/core": path.resolve(repoRoot, "packages/core/src/index.ts"),
      "@signal-kernel/async-runtime": path.resolve(
        repoRoot,
        "packages/async-runtime/src/index.ts",
      ),
      "@signal-kernel/react": path.resolve(
        repoRoot,
        "packages/react/src/index.ts",
      ),
    },
    dedupe: ["@signal-kernel/core", "@signal-kernel/async-runtime", "react"],
  },
});
