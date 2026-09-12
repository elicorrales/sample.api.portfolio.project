import { SignJWT } from "jose";

export const TEST_JWT_SECRET = "test-only-secret-not-used-anywhere-else";

const key = new TextEncoder().encode(TEST_JWT_SECRET);

function sign(role: string, expiresIn: string | number) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("test-caller")
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export const adminToken = () => sign("admin", "5m");
export const nonAdminToken = () => sign("user", "5m");
export const expiredAdminToken = () => sign("admin", Math.floor(Date.now() / 1000) - 60);
