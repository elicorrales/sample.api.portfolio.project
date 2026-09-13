import { Router } from "express";
import type { z } from "zod";
import {
  type FieldError,
  methodNotAllowed,
  ProblemError,
  preconditionFailedProblem,
  preconditionRequiredProblem,
  validationProblem,
} from "../shared/errors.ts";
import {
  getQuerySchema,
  listQuerySchema,
  noQuerySchema,
  userIdParamsSchema,
  userInputSchema,
} from "./users.schema.ts";
import { toBasicView, toDetailedView, type UsersService } from "./users.service.ts";

// HTTP layer: parse the request, call the service, shape the response.
// Each path lists its methods, then answers any other method with 405.
export function usersRoutes(service: UsersService) {
  const router = Router();

  router
    .route("/")
    .get(async (req, res) => {
      const query = parseOrThrow(listQuerySchema, req.query, "query");
      res.json(await service.list(query));
    })
    .post(async (req, res) => {
      parseOrThrow(noQuerySchema, req.query, "query");
      const input = parseOrThrow(userInputSchema, req.body, "body");
      const user = await service.create(input);
      res
        .status(201)
        .location(`/v1/users/${user.id}`)
        .set("ETag", `"${user.version}"`)
        .json(toDetailedView(user));
    })
    .all(methodNotAllowed("GET, POST"));

  router
    .route("/:userId")
    .get(async (req, res) => {
      const { userId } = parseOrThrow(userIdParamsSchema, req.params, "userId");
      const { view, includeDeleted } = parseOrThrow(getQuerySchema, req.query, "query");
      const user = await service.get(userId, includeDeleted);
      res
        .set("ETag", `"${user.version}"`)
        .json(view === "detailed" ? toDetailedView(user, includeDeleted) : toBasicView(user, includeDeleted));
    })
    .put(async (req, res) => {
      const { userId } = parseOrThrow(userIdParamsSchema, req.params, "userId");
      parseOrThrow(noQuerySchema, req.query, "query");
      const expectedVersion = versionFromIfMatch(req.get("If-Match"));
      const input = parseOrThrow(userInputSchema, req.body, "body");
      const user = await service.update(userId, expectedVersion, input);
      res.set("ETag", `"${user.version}"`).json(toDetailedView(user));
    })
    .delete(async (req, res) => {
      const { userId } = parseOrThrow(userIdParamsSchema, req.params, "userId");
      parseOrThrow(noQuerySchema, req.query, "query");
      const expectedVersion = versionFromIfMatch(req.get("If-Match"));
      await service.delete(userId, expectedVersion);
      res.status(204).end();
    })
    .all(methodNotAllowed("GET, PUT, DELETE"));

  router
    .route("/:userId/restore")
    .post(async (req, res) => {
      const { userId } = parseOrThrow(userIdParamsSchema, req.params, "userId");
      parseOrThrow(noQuerySchema, req.query, "query");
      const user = await service.restore(userId);
      res.set("ETag", `"${user.version}"`).json(toDetailedView(user));
    })
    .all(methodNotAllowed("POST"));

  return router;
}

// If-Match carries the ETag the client loaded, e.g. "3". Missing → 428; anything else that
// isn't a version we issued can never match → 412.
function versionFromIfMatch(header: string | undefined) {
  if (header === undefined) throw preconditionRequiredProblem();
  const match = /^"(\d+)"$/.exec(header.trim());
  if (!match) throw preconditionFailedProblem("If-Match must be the ETag you loaded, e.g. \"3\"");
  return Number(match[1]);
}

// Validates with Zod; on failure, throws a 400 listing each bad field.
function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown, whole: string): z.output<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw validationProblem(toFieldErrors(parsed.error, whole));
  return parsed.data;
}

function toFieldErrors(error: z.ZodError, whole: string): FieldError[] {
  return error.issues.flatMap((issue) => {
    const path = issue.path.map(String);
    // Unknown fields are reported one by one, by name, so the client knows exactly what to remove.
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) => ({ field: [...path, safeFieldName(key)].join("."), message: "Unknown field" }));
    }
    return [{ field: path.join(".") || whole, message: issue.message }];
  });
}

// Unknown field names come from the request. Only plain names are echoed back, so a name like
// "<script>" never reaches a page that displays errors.
function safeFieldName(key: string) {
  return /^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(key) ? key : "(unknown)";
}
