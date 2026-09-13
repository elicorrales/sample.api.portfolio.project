import request from "supertest";
import { createApp } from "../../api/src/app.ts";

// A fresh app per call, so tests never share state.
// Within one test, call api() once and reuse it: every request then hits the same app and its data.
export function api() {
  return request(createApp());
}
