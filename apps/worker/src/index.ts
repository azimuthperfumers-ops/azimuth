import "dotenv/config";
import http from "node:http";
import { assertCriticalEnv } from "@azimuth/api";
import { scheduleExpirePendingPayments, startOrderWorker } from "@azimuth/queue";

// The worker books shipments and moves money — never start it half-configured.
assertCriticalEnv();

const worker = startOrderWorker();

scheduleExpirePendingPayments().catch((e: unknown) =>
  console.error("[worker] Failed to schedule expire_pending_payments:", e),
);

// Minimal health server — keeps Render free-tier service alive when pinged
const PORT = process.env.PORT ?? 3002;
const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
});
server.listen(PORT, () => console.log(`[worker] health server on :${PORT}`));

console.log("[worker] Order worker started");

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received — draining and closing`);
  await worker.close();
  server.close();
  console.log("[worker] Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
