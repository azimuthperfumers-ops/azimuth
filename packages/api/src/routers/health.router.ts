import { sql } from "drizzle-orm";
import { publicProcedure, router } from "../trpc";
import { adminProcedure } from "../middleware/auth.middleware";
import { getRedis } from "../lib/redis";
import { orderQueue } from "../lib/order-queue";
import { env } from "../env";

async function pingWorker(): Promise<{ ok: boolean; uptimeSeconds?: number; error?: string }> {
  const url = env.WORKER_URL;
  if (!url) return { ok: false, error: "WORKER_URL not configured" };
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const body = await res.json() as { uptime?: number };
    return { ok: true, uptimeSeconds: body.uptime !== undefined ? Math.floor(body.uptime) : undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export const healthRouter = router({
  ping: publicProcedure.query(() => ({ status: "ok" as const, time: Date.now() })),

  check: adminProcedure.query(async ({ ctx }) => {
    const results = await Promise.allSettled([
      // DB
      ctx.db.execute(sql`SELECT 1`).then(() => ({ ok: true as const })),
      // Redis
      getRedis().ping().then((r) => ({ ok: r === "PONG" as const })),
      // Queue (BullMQ via Redis)
      orderQueue.getJobCounts().then((counts) => ({ ok: true as const, counts })),
      // Worker process
      pingWorker(),
    ]);

    const errStr = (r: PromiseSettledResult<{ ok: boolean }>) =>
      r.status === "rejected"
        ? r.reason instanceof Error ? r.reason.message : String(r.reason)
        : null;

    const [dbR, redisR, queueR, workerR] = results;
    const db = dbR.status === "fulfilled" ? { ok: dbR.value.ok, error: null } : { ok: false, error: errStr(dbR) };
    const redis = redisR.status === "fulfilled" ? { ok: redisR.value.ok, error: null } : { ok: false, error: errStr(redisR) };
    const queue = queueR.status === "fulfilled" ? { ok: queueR.value.ok, error: null } : { ok: false, error: errStr(queueR) };
    const worker = workerR.status === "fulfilled"
      ? { ok: workerR.value.ok, error: workerR.value.error ?? null, uptimeSeconds: workerR.value.uptimeSeconds }
      : { ok: false, error: errStr(workerR), uptimeSeconds: undefined };

    const mem = process.memoryUsage();

    return {
      server: { ok: true, uptimeSeconds: Math.floor(process.uptime()), memoryMb: Math.round(mem.rss / 1024 / 1024) },
      db,
      redis,
      queue,
      worker,
    };
  }),
});
