import request from "supertest";
import { type AppOptions, createApp } from "../../api/src/app.ts";
import { PgUsersRepository } from "../../api/src/users/users.repository.pg.ts";
import { testDatabase } from "./database.ts";
import { TEST_JWT_SECRET } from "./tokens.ts";

// An app wired to this test file's database, with the test secret. Tests override only what they need.
export function testApp(options: Partial<AppOptions> = {}) {
  return createApp({ jwtSecret: TEST_JWT_SECRET, usersRepository: new PgUsersRepository(testDatabase), ...options });
}

// A client for a fresh app. Every call in one test shares the same database, which is emptied before each test.
export function api() {
  return request(testApp());
}
