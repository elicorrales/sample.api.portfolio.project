import request from "supertest";
import { createApp } from "../../api/src/app.ts";

// A fresh app per call, so tests never share state.
export function api() {
  return request(createApp());
}
