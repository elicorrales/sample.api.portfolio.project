// Adds page matchers like toBeInTheDocument() to expect().
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { fakeApi } from "./helpers/fake-api.ts";

// A request the fake API has no answer for fails the test, instead of quietly reaching the internet.
beforeAll(() => fakeApi.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  fakeApi.resetHandlers();
});
afterAll(() => fakeApi.close());
