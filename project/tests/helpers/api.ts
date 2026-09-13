import request from "supertest";
import { createApp } from "../../api/src/app.ts";
import { TEST_JWT_SECRET } from "./tokens.ts";

// A fresh app per call (with its own in-memory data), so tests never share state.
// Within one test, call api() once and reuse it: every request then hits the same app and its data.
export function api() {
  return request(createApp({ jwtSecret: TEST_JWT_SECRET }));
}
