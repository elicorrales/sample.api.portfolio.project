import type { Response } from "supertest";
import { expect } from "vitest";

// Checks an error response: the status, the Problem Details format, and (for 400s)
// that the `errors` list names the given field.
export function expectProblem(res: Response, status: number, field?: string) {
  expect(res.status).toBe(status);
  expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
  expect(res.body).toMatchObject({ status, type: expect.any(String), title: expect.any(String) });
  if (field !== undefined) {
    expect(res.body.errors?.map((error: { field: string }) => error.field)).toContain(field);
  }
}
