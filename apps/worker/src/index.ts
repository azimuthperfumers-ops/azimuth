import "dotenv/config";
import { startOrderWorker } from "@azimuth/queue";

const worker = startOrderWorker();

console.log("[worker] Order worker started");

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received — draining and closing`);
  await worker.close();
  console.log("[worker] Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
