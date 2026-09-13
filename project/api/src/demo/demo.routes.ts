import { Router } from "express";
import { methodNotAllowed } from "../shared/errors.ts";
import { signAdminToken } from "../shared/tokens.ts";

// The hosted demo's front door: a 1-hour admin token for anyone, so visitors can try the API in Swagger
// and watch auth refuse them without it. app.ts mounts this only in demo mode, and before auth.

const ONE_HOUR = 3600;
export const DEMO_NOTE = "Demo only: all data is fake and resets every night at 08:00 UTC";

export function demoRoutes(jwtSecret: string) {
  const router = Router();

  router
    .route("/demo/token")
    .post(async (_req, res) => {
      const token = await signAdminToken(jwtSecret, "demo-visitor", ONE_HOUR);
      // A cache that obeys this never keeps a copy of the token to hand to someone else. It's a request, not a
      // lock: the real protection is the 1-hour expiry and HTTPS. Token responses must send it (OAuth, RFC 6749 §5.1).
      res.set("Cache-Control", "no-store").json({ token, tokenType: "Bearer", expiresIn: ONE_HOUR, note: DEMO_NOTE });
    })
    .all(methodNotAllowed("POST"));

  return router;
}
