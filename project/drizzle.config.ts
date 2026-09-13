import { defineConfig } from "drizzle-kit";

// Used by `npm run db:generate`: compares the tables in users.table.ts with the migrations
// generated so far, and writes a new numbered SQL migration for the difference.
export default defineConfig({
  dialect: "postgresql",
  schema: "./api/src/users/users.table.ts",
  out: "./api/migrations",
});
