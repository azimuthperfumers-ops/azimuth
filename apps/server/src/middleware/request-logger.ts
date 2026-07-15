import type { NextFunction, Request, Response } from "express";

// Logs one line per request when the response finishes:
//   [req] POST /trpc/order.create 200 42ms ip=1.2.3.4
// The query string is intentionally omitted — auth verification / password-reset
// links carry secret tokens in the query, and those must never land in logs.
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  // Capture the full path now: mounted routers (e.g. /trpc) rewrite req.path by
  // the time 'finish' fires. Strip the query string so tokens never reach logs.
  const path = req.originalUrl.split("?")[0];

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    const line = `[req] ${req.method} ${path} ${res.statusCode} ${durationMs.toFixed(1)}ms ip=${ip}`;

    if (res.statusCode >= 500) console.error(line);
    else if (res.statusCode >= 400) console.warn(line);
    else console.log(line);
  });

  next();
}
