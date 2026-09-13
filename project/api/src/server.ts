import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? 3000);

// No fallback secret: a server that starts without one would accept tokens signed with a guessable key.
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.error("JWT_SECRET is not set. For local development, use `npm run dev`.");
  process.exit(1);
}

const corsOrigins = (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean);

createApp({ jwtSecret, corsOrigins }).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`CORS allowed origins: ${corsOrigins.join(", ") || "(none)"}`);
});
