import express from "express";
import { requireAdmin } from "./shared/auth.ts";
import { cors } from "./shared/cors.ts";
import { errorHandler, ProblemError, sendProblem } from "./shared/errors.ts";
import { MemoryUsersRepository } from "./users/users.repository.memory.ts";
import type { UsersRepository } from "./users/users.repository.ts";
import { usersRoutes } from "./users/users.routes.ts";
import { UsersService } from "./users/users.service.ts";

export interface AppOptions {
  jwtSecret: string;
  corsOrigins?: string[];
  usersRepository?: UsersRepository;
}

// Builds the Express app without starting a server, so tests can call it directly.
// Order matters: CORS (answers preflights) → auth → JSON body → routes → 404 → errors.
// Auth comes before the body is read, so a caller without a token learns nothing, not even that their JSON is bad.
export function createApp({ jwtSecret, corsOrigins = [], usersRepository = new MemoryUsersRepository() }: AppOptions) {
  const app = express();
  // Express would otherwise add its own body-hash ETag to every response. Our ETag is the
  // user's version (for If-Match), so only routes that return a user set one.
  app.set("etag", false);
  // `X-Powered-By: Express` tells attackers which framework (and its known flaws) to try.
  app.disable("x-powered-by");

  app.use(cors(corsOrigins));
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
