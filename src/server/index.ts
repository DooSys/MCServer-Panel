import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { requireAuth } from "./auth.js";
import { assertRuntimeConfig, config } from "./config.js";
import { apiRouter } from "./routes.js";

assertRuntimeConfig();

const app = express();
const dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(dirname, "../client");

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const pocketBaseProxy = createProxyMiddleware({
  target: config.pocketBaseUrl,
  changeOrigin: true,
  ws: true
});

app.use("/pb", createProxyMiddleware({
  target: config.pocketBaseUrl,
  changeOrigin: true,
  pathRewrite: { "^/pb": "" },
  ws: true
}));

app.use("/_", pocketBaseProxy);
app.use(["/api/collections", "/api/files", "/api/realtime", "/api/batch"], pocketBaseProxy);

app.use("/api", (request, response, next) => {
  if (request.path === "/health" || request.path === "/app/config" || request.path === "/auth/login") {
    next();
    return;
  }
  requireAuth(request, response, next);
});
app.use("/api", apiRouter);

app.use(express.static(clientDir));
app.get("*", (_request, response) => {
  response.sendFile(path.join(clientDir, "index.html"));
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 500;
  const message = error instanceof Error ? error.message : "Unexpected error";
  response.status(status || 500).json({ error: message });
});

app.listen(config.appPort, () => {
  console.log(`[mcserver-panel] listening on :${config.appPort}`);
});
