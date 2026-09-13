import { signAdminToken } from "../api/src/shared/tokens.ts";

// Prints an admin token for local use: paste it into Swagger UI's "Authorize" button.
// Signed with the same JWT_SECRET that `npm run dev` gives the server.
const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error("JWT_SECRET is not set. Use `npm run token`.");
  process.exit(1);
}

console.log(await signAdminToken(secret, "local-dev", 8 * 3600));
