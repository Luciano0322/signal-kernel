import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // Keep Next's server-only marker alias resolvable under Turbopack.
      "next/dist/compiled/server-only/empty": "./server-only-empty.ts",
    },
  },
};

export default nextConfig;
