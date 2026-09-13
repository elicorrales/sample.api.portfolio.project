import express from "express";
import { docsRoutes } from "./docs/docs.routes.ts";
import { requireAdmin } from "./shared/auth.ts";
import { cors } from "./shared/cors.ts";
import { errorHandler, ProblemError, sendProblem } from "./shared/errors.ts";
import { type RateLimitOptions, rateLimit } from "./shared/rate-limit.ts";
import type { UsersRepository } from "./users/users.repository.ts";
import { usersRoutes } from "./users/users.routes.ts";
import { UsersService } from "./users/users.service.ts";

export interface AppOptions {
  jwtSecret: string;
  corsOrigins?: string[];
  // Where users are stored. The server passes the PostgreSQL one; tests can pass a broken one.
  usersRepository: UsersRepository;
  // Requests allowed per client IP in each fixed window.
  rateLimit?: RateLimitOptions;
  // How many proxies in front of the app to trust for the client's IP (X-Forwarded-For).
  // 0 (the default) ignores the header, so a client can't fake a new IP to get a fresh limit.
  trustProxy?: number;
}

// Builds the Express app without starting a server, so tests can call it directly.
// Order matters: CORS (answers preflights) → rate limit → public docs → auth → JSON body → routes → 404 → errors.
// The rate limit comes before auth, so floods of bad tokens are stopped cheaply. It comes after CORS,
// so preflights don't count, and a 429 still carries CORS headers the web page needs to read it.
// Auth comes before the body is read, so a caller without a token learns nothing, not even that their JSON is bad.
export function createApp({
  jwtSecret,
  corsOrigins = [],
  usersRepository,
  rateLimit: rateLimitOptions = { limit: 100, windowSeconds: 60 },
  trustProxy = 0,
}: AppOptions) {
  const app = express();
  app.set("trust proxy", trustProxy);
  // Express would otherwise add its own body-hash ETag to every response. Our ETag is the
  // user's version (for If-Match), so only routes that return a user set one.
  app.set("etag", false);
  // `X-Powered-By: Express` tells attackers which framework (and its known flaws) to try.
  app.disable("x-powered-by");

  app.use(cors(corsOrigins));
  app.use(rateLimit(rateLimitOptions));
  app.use(docsRoutes());
  app.use(requireAdmin(jwtSecret));
  app.use(express.json({ limit: "100kb" }));

  app.use("/v1/users", usersRoutes(new UsersService(usersRepository)));

  // No such path. (A known path with the wrong method gets 405 from its router instead.)
  app.use((req, res) => {
    sendProblem(res, req.path, new ProblemError(404, "/problems/not-found", "Not found", "No such endpoint"));
  });

  app.use(errorHandler);

  return app;
}
