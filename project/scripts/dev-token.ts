import { SignJWT } from "jose";

// Prints an admin token for local use: paste it into Swagger UI's "Authorize" button.
// Signed with the same JWT_SECRET that `npm run dev` gives the server.
const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error("JWT_SECRET is not set. Use `npm run token`.");
  process.exit(1);
}

const token = await new SignJWT({ role: "admin" })
  .setProtectedHeader({ alg: "HS256" })
  .setSubject("local-dev")
  .setIssuedAt()
  .setExpirationTime("8h")
  .sign(new TextEncoder().encode(secret));

console.log(token);
