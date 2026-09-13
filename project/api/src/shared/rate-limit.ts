import type { RequestHandler } from "express";
import { ProblemError, sendProblem } from "./errors.ts";

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

// Fixed window per client IP: at most `limit` requests in each window (e.g. 12:00:00–12:00:59),
// then 429 until the next window starts. Every request counts, including ones that fail auth,
// so a flood of token guesses is stopped too.
// Counts live in memory, so each running copy of the API keeps its own.
export function rateLimit({ limit, windowSeconds }: RateLimitOptions): RequestHandler {
  const windowMs = windowSeconds * 1000;
  let currentWindow = -1;
  let counts = new Map<string, number>();

  return (req, res, next) => {
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    if (window !== currentWindow) {
      // A new window: start over. This also keeps memory to the clients seen in one window.
      currentWindow = window;
      counts = new Map();
    }

    // req.ip is the socket address, or the X-Forwarded-For address when a proxy is trusted (see app.ts).
    const client = req.ip ?? "unknown";
    const count = (counts.get(client) ?? 0) + 1;
    counts.set(client, count);

    if (count > limit) {
      const retryAfter = Math.ceil(((window + 1) * windowMs - now) / 1000);
      return sendProblem(
        res,
        req.path,
        new ProblemError(
          429,
          "/problems/rate-limited",
          "Too many requests",
          `Rate limit exceeded; retry after ${retryAfter} seconds`,
          undefined,
          { "Retry-After": String(retryAfter) },
        ),
      );
    }
    next();
  };
}
