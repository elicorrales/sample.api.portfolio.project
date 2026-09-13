import type { ErrorRequestHandler, Response } from "express";

// Problem Details (RFC 9457). Messages never include stack traces, SQL, or file paths.

export interface FieldError {
  field: string;
  message: string;
}

export class ProblemError extends Error {
  constructor(
    readonly status: number,
    readonly type: string,
    readonly title: string,
    readonly detail: string,
    readonly errors?: FieldError[],
    readonly headers?: Record<string, string>,
  ) {
    super(detail);
  }
}

export const validationProblem = (errors: FieldError[]) =>
  new ProblemError(400, "/problems/validation", "Invalid input", `${errors.length} field(s) are invalid`, errors);

export const conflictProblem = (detail: string) => new ProblemError(409, "/problems/conflict", "Conflict", detail);

export const notFoundProblem = (detail: string) => new ProblemError(404, "/problems/not-found", "Not found", detail);

export const preconditionFailedProblem = (detail: string) =>
  new ProblemError(412, "/problems/version-mismatch", "Version out of date", detail);

export const preconditionRequiredProblem = () =>
  new ProblemError(428, "/problems/version-required", "Version required", "Send the If-Match header with the version you loaded");

export function sendProblem(res: Response, instance: string, problem: ProblemError) {
  if (problem.headers) res.set(problem.headers);
  res
    .status(problem.status)
    .type("application/problem+json")
    .json({
      type: problem.type,
      title: problem.title,
      status: problem.status,
      detail: problem.detail,
      instance,
      ...(problem.errors && { errors: problem.errors }),
    });
}

// Last middleware: turns anything thrown into a Problem response.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ProblemError) {
    sendProblem(res, req.path, err);
  } else if (err?.type === "entity.parse.failed" || err?.type === "entity.too.large") {
    // Thrown by express.json() for a malformed or oversized body.
    sendProblem(res, req.path, new ProblemError(400, "/problems/validation", "Invalid input", "Request body must be valid JSON"));
  } else {
    console.error(err);
    sendProblem(res, req.path, new ProblemError(500, "/problems/internal", "Internal error", "Something went wrong"));
  }
};
