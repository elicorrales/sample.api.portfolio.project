import { SignJWT } from "jose";

// Signs an admin token like the ones auth.ts accepts: HS256, role `admin`, and always an expiry.
// Used by `npm run token` (local) and POST /demo/token (hosted demo).
export function signAdminToken(jwtSecret: string, subject: string, expiresInSeconds: number) {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(new TextEncoder().encode(jwtSecret));
}
