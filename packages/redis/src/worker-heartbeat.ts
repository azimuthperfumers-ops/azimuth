import { randomUUID } from "node:crypto";

import { ensureRedis, getRedis } from "./client";

// Worker liveness over Redis instead of HTTP.
//
// The worker is a background container with no reachable HTTP port (nothing
// routes to it but Caddy's /worker-health probe), so the server can't fetch it.
// Both processes already talk to the same Redis, so the worker writes a
// heartbeat there and the server reads it — no ports, no service discovery.
//
// One hash field per worker instance, so replicas each report independently and
// a dead instance simply stops refreshing its field.

const HEARTBEAT_KEY = "health:workers";

/** How often a live worker refreshes its field. */
export const HEARTBEAT_INTERVAL_MS = 10_000;
/** Older than this and the instance counts as dead (3 missed beats). */
export const HEARTBEAT_STALE_MS = 35_000;
/** Older than this and the field is dropped — the instance is gone for good. */
const HEARTBEAT_PURGE_MS = 10 * 60_000;

export type WorkerHeartbeat = {
  instanceId: string;
  pid: number;
  /** epoch ms of the last beat */
  ts: number;
  uptimeSeconds: number;
  /** false when the process is up but the queue worker stopped consuming */
  running: boolean;
};

export type WorkerLiveness = {
  ok: boolean;
  /** instances that beat within HEARTBEAT_STALE_MS and are still consuming */
  live: WorkerHeartbeat[];
  /** known instances that went quiet or stopped consuming */
  stale: WorkerHeartbeat[];
  error: string | null;
};

/**
 * Start beating for this process. Returns a stop function that also clears this
 * instance's field, so a clean shutdown shows as down immediately rather than
 * waiting out the stale window.
 */
export function startWorkerHeartbeat(opts: {
  /** Report unhealthy when the queue worker is no longer consuming. */
  isRunning: () => boolean;
  intervalMs?: number;
}): () => Promise<void> {
  const instanceId = process.env.HOSTNAME || randomUUID().slice(0, 8);
  let stopped = false;
  let inFlight: Promise<void> = Promise.resolve();

  const beat = async () => {
    if (stopped) return;
    const entry: WorkerHeartbeat = {
      instanceId,
      pid: process.pid,
      ts: Date.now(),
      uptimeSeconds: Math.floor(process.uptime()),
      running: opts.isRunning(),
    };
    try {
      const redis = await ensureRedis();
      if (stopped) return; // shut down while we were connecting — don't resurrect the entry
      await redis.hset(HEARTBEAT_KEY, instanceId, JSON.stringify(entry));
    } catch (e) {
      console.warn("[worker] heartbeat write failed:", e instanceof Error ? e.message : e);
    }
  };

  const tick = () => {
    inFlight = beat();
  };
  tick();
  const timer = setInterval(tick, opts.intervalMs ?? HEARTBEAT_INTERVAL_MS);
  timer.unref();

  return async () => {
    stopped = true;
    clearInterval(timer);
    await inFlight.catch(() => undefined); // let any in-flight beat settle before we clear
    try {
      await (await ensureRedis()).hdel(HEARTBEAT_KEY, instanceId);
    } catch {
      // shutting down anyway — the entry ages out on its own
    }
  };
}

/** Read every known worker instance and classify it live or stale. */
export async function readWorkerHeartbeats(): Promise<WorkerLiveness> {
  let raw: Record<string, string>;
  try {
    raw = await (await ensureRedis()).hgetall(HEARTBEAT_KEY);
  } catch (e) {
    return { ok: false, live: [], stale: [], error: e instanceof Error ? e.message : String(e) };
  }

  const now = Date.now();
  const live: WorkerHeartbeat[] = [];
  const stale: WorkerHeartbeat[] = [];
  const purge: string[] = [];

  for (const [instanceId, value] of Object.entries(raw)) {
    let entry: WorkerHeartbeat;
    try {
      entry = JSON.parse(value) as WorkerHeartbeat;
    } catch {
      purge.push(instanceId);
      continue;
    }
    const age = now - entry.ts;
    if (age > HEARTBEAT_PURGE_MS) purge.push(instanceId);
    else if (age <= HEARTBEAT_STALE_MS && entry.running) live.push(entry);
    else stale.push(entry);
  }

  if (purge.length > 0) {
    getRedis()
      .hdel(HEARTBEAT_KEY, ...purge)
      .catch(() => undefined);
  }

  const error =
    live.length > 0
      ? null
      : stale.length > 0
        ? staleReason(stale, now)
        : "no worker has ever reported in";

  return { ok: live.length > 0, live, stale, error };
}

function staleReason(stale: WorkerHeartbeat[], now: number): string {
  const newest = stale.reduce((a, b) => (a.ts > b.ts ? a : b));
  if (!newest.running) return "worker process is up but not consuming jobs";
  return `no heartbeat for ${Math.round((now - newest.ts) / 1000)}s`;
}
