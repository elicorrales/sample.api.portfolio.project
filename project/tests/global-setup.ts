import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import type { TestProject } from "vitest/node";
import { openDatabase } from "../api/src/shared/database.ts";

// Runs once for the whole test run, before any test file.
// Starts one real PostgreSQL server and prepares a template database with the migrations applied.
// Each test file then copies the template into its own database (tests/helpers/database.ts).

const port = 54329; // not the usual 5432, so it never collides with another PostgreSQL on the laptop
const user = "postgres";
const password = "test-only-password";
const templateDatabase = "template_users_api";

declare module "vitest" {
  export interface ProvidedContext {
    postgresUrl: string;
    templateDatabase: string;
  }
}

export default async function setup(project: TestProject) {
  const databaseDir = join(tmpdir(), `users-api-test-postgres-${process.pid}`);
  const server = new EmbeddedPostgres({ databaseDir, port, user, password, persistent: false, onLog: () => {} });
  await server.initialise();
  await server.start();

  const postgresUrl = `postgres://${user}:${password}@localhost:${port}`;
  await server.createDatabase(templateDatabase);
  const template = await openDatabase(`${postgresUrl}/${templateDatabase}`);
  // A database can only be copied while nothing is connected to it.
  await template.$client.end();

  project.provide("postgresUrl", postgresUrl);
  project.provide("templateDatabase", templateDatabase);

  return async () => {
    await server.stop();
    await rm(databaseDir, { recursive: true, force: true });
  };
}
