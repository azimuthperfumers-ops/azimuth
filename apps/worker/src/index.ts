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

// Dead-man's-switch heartbeat — ping Healthchecks.io every 60s, but only while
// the queue worker is actually running. If the process dies OR the worker stops
// consuming, the pings stop and Healthchecks.io alerts after its grace period.
// No-op unless HEALTHCHECK_URL is set.
const HEALTHCHECK_URL = process.env.HEALTHCHECK_URL;
let heartbeat: NodeJS.Timeout | undefined;
if (HEALTHCHECK_URL) {
  const ping = async () => {
    if (!worker.isRunning()) return; // stuck/closed → skip ping → triggers alert
    try {
      await fetch(HEALTHCHECK_URL, { signal: AbortSignal.timeout(10_000) });
    } catch (e: unknown) {
      console.error("[worker] healthcheck ping failed:", e);
    }
  };
  void ping();
  heartbeat = setInterval(() => void ping(), 60_000);
  heartbeat.unref();
  console.log("[worker] heartbeat enabled");
}

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received — draining and closing`);
  if (heartbeat) clearInterval(heartbeat);
  await worker.close();
  server.close();
  console.log("[worker] Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
