import type { RequestHandler } from "express";
import { jwtVerify } from "jose";
import { ProblemError, sendProblem } from "./errors.ts";

// Every operation needs a valid JWT whose `role` claim is `admin`.
// Runs before routing, so a caller without a token can't learn which records exist.
export function requireAdmin(jwtSecret: string): RequestHandler {
  const key = new TextEncoder().encode(jwtSecret);

  return async (req, res, next) => {
    const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) {
      return unauthorized(res, req.path);
    }

    let role: unknown;
    try {
      ({ payload: { role } } = await jwtVerify(token, key, { algorithms: ["HS256"] }));
    } catch {
      // Bad signature, expired, or malformed. The reason isn't revealed.
      return unauthorized(res, req.path);
    }

    if (role !== "admin") {
      return sendProblem(
        res,
        req.path,
        new ProblemError(403, "/problems/forbidden", "Not allowed", "This operation requires the admin role"),
      );
    }
    next();
  };
}

function unauthorized(res: Parameters<RequestHandler>[1], instance: string) {
  res.set("WWW-Authenticate", "Bearer");
  sendProblem(res, instance, new ProblemError(401, "/problems/unauthorized", "Not signed in", "A valid admin token is required"));
}
