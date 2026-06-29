import { sql } from "drizzle-orm";
import { publicProcedure, router } from "../trpc";
import { adminProcedure } from "../middleware/auth.middleware";
import { getRedis } from "../lib/redis";
import { orderQueue } from "../lib/order-queue";

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
    ]);

    const [db, redis, queue] = results.map((r) =>
      r.status === "fulfilled"
        ? { ok: r.value.ok, error: null }
        : { ok: false, error: r.reason instanceof Error ? r.reason.message : String(r.reason) },
    );

    const mem = process.memoryUsage();

    return {
      server: { ok: true, uptimeSeconds: Math.floor(process.uptime()), memoryMb: Math.round(mem.rss / 1024 / 1024) },
      db: db ?? { ok: false, error: "no result" },
      redis: redis ?? { ok: false, error: "no result" },
      queue: queue ?? { ok: false, error: "no result" },
    };
  }),
});
