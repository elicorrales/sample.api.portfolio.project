import type { ErrorRequestHandler, RequestHandler, Response } from "express";

// Problem Details (RFC 9457). Messages never include stack traces, SQL, or file paths.

export interface FieldError {
  field: string;
  message: string;
}

export class ProblemError extends Error {
  readonly status: number;
  readonly type: string;
  readonly title: string;
  readonly detail: string;
  readonly errors?: FieldError[];
  readonly headers?: Record<string, string>;

  constructor(
    status: number,
    type: string,
    title: string,
    detail: string,
    errors?: FieldError[],
    headers?: Record<string, string>,
  ) {
    super(detail);
    this.status = status;
    this.type = type;
    this.title = title;
    this.detail = detail;
    this.errors = errors;
    this.headers = headers;
  }
}

export const validationProblem = (errors: FieldError[]) =>
  new ProblemError(400, "/problems/validation", "Invalid input", `${errors.length} field(s) are invalid`, errors);

export const conflictProblem = (detail: string) => new ProblemError(409, "/problems/conflict", "Conflict", detail);

export const notFoundProblem = (detail: string) => new ProblemError(404, "/problems/not-found", "Not found", detail);

export const preconditionFailedProblem = (detail: string) =>
  new ProblemError(412, "/problems/version-mismatch", "Version out of date", detail);

// A known path called with a method it doesn't support. `Allow` tells the client which ones it does.
export function methodNotAllowed(allow: string): RequestHandler {
  return (req) => {
    throw new ProblemError(405, "/problems/method-not-allowed", "Method not allowed", `${req.method} isn't supported here`, undefined, {
      Allow: allow,
    });
  };
}

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

// What an unexpected error may put in the server log: only fields that can't hold personal data.
// Messages are left out (Drizzle's includes the query's values), and so is PostgreSQL's `detail`
// (e.g. "Key (email)=(...) already exists"). The path has no query string, so no search terms.
// The stack keeps only its "at ..." lines, since its first lines repeat the message.
export function safeLogFields(method: string, path: string, err: unknown) {
  const error = err as { name?: string; stack?: string; code?: string; constraint?: string; cause?: unknown };
  const database = (error?.cause ?? error) as { code?: string; constraint?: string } | undefined;
  return {
    method,
    path,
    name: error?.name,
    code: database?.code,
    constraint: database?.constraint,
    stack: error?.stack
      ?.split("\n")
      .filter((line) => /^\s+at /.test(line))
      .join("\n"),
  };
}

// Last middleware: turns anything thrown into a Problem response.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ProblemError) {
    sendProblem(res, req.path, err);
  } else if (err?.type === "entity.parse.failed") {
    // Thrown by express.json() for a malformed body.
    sendProblem(res, req.path, new ProblemError(400, "/problems/validation", "Invalid input", "Request body must be valid JSON"));
  } else if (err?.type === "entity.too.large") {
    // Thrown by express.json() before reading a body over its limit.
    sendProblem(res, req.path, new ProblemError(413, "/problems/too-large", "Body too large", "Request body must be 100 KB or smaller"));
  } else {
    console.error("Unexpected error", safeLogFields(req.method, req.path, err));
    sendProblem(res, req.path, new ProblemError(500, "/problems/internal", "Internal error", "Something went wrong"));
  }
};
