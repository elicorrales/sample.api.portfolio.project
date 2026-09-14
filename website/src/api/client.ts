import createClient from "openapi-fetch";
import type { paths } from "./schema.ts";

// Set VITE_API_URL to point the client at another API, such as one running locally.
export const API_URL: string = import.meta.env.VITE_API_URL ?? "https://users-admin-api-98o8.onrender.com";

// Every call is checked against the types generated from openapi.yaml.
// fetch is looked up on each call: openapi-fetch otherwise keeps the one that existed when this file loaded,
// which bypassed the tests' fake API and reached the real one.
export const api = createClient<paths>({ baseUrl: API_URL, fetch: (request) => globalThis.fetch(request) });
