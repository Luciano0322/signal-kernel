import { startReactiveProxyServer } from "./server";

function readPort(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const proxyPort = readPort(
  process.env.REACT_PROXY_PORT ?? process.env.REACTIVE_PROXY_PORT ?? process.env.PORT,
  18080,
);
const runtime = await startReactiveProxyServer({ port: proxyPort });

console.log("Reactive proxy example is running.");
console.log("");
console.log("Proxy:");
console.log(`  http://localhost:${proxyPort}`);
console.log("");
console.log("Demo upstreams:");
console.log("  api-a       http://localhost:3001");
console.log("  api-b       http://localhost:3002");
console.log("  web-a       http://localhost:3003");
console.log("  api-admin-a http://localhost:3004");
console.log("");
console.log("Try:");
console.log(`  curl http://localhost:${proxyPort}/api/users`);
console.log(`  curl http://localhost:${proxyPort}/api/admin/users`);
console.log(`  curl http://localhost:${proxyPort}/web/home`);
console.log("  curl http://localhost:3001/toggle-health");
console.log("");

process.on("SIGINT", () => {
  void runtime.close().finally(() => {
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  void runtime.close().finally(() => {
    process.exit(0);
  });
});
