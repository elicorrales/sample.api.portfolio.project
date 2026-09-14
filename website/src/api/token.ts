import { call } from "./call.ts";
import { api } from "./client.ts";

// POST /demo/token: a 1-hour admin token, only on the hosted demo.
export function requestDemoToken() {
  return call(() => api.POST("/demo/token"));
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
