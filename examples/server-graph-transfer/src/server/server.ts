import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { renderHtml } from "./renderHtml";

const exampleRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const port = Number(process.env.PORT ?? 5180);
const host = process.env.HOST ?? "0.0.0.0";

const vite = await createViteServer({
  appType: "custom",
  root: exampleRoot,
  server: {
    middlewareMode: true,
  },
});

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (req.method === "GET" && requestUrl.pathname === "/") {
      const html = await vite.transformIndexHtml(
        requestUrl.pathname,
        renderHtml({ requestUrl }),
      );

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    vite.middlewares(req, res, () => {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    });
  } catch (error) {
    vite.ssrFixStacktrace(error as Error);
    console.error(error);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal server error");
  }
});

server.listen(port, host, () => {
  console.log(`Server graph transfer example: http://localhost:${port}`);
});
