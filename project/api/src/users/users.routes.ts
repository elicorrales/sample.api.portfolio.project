import { Router } from "express";
import type { z } from "zod";
import { preconditionFailedProblem, preconditionRequiredProblem, validationProblem } from "../shared/errors.ts";
import { getQuerySchema, listQuerySchema, userIdParamsSchema, userInputSchema } from "./users.schema.ts";
import { toBasicView, toDetailedView, type UsersService } from "./users.service.ts";

// HTTP layer: parse the request, call the service, shape the response.
export function usersRoutes(service: UsersService) {
  const router = Router();

  router.post("/", async (req, res) => {
    const input = parseOrThrow(userInputSchema, req.body, "body");
    const user = await service.create(input);
    res
      .status(201)
      .location(`/v1/users/${user.id}`)
      .set("ETag", `"${user.version}"`)
      .json(toDetailedView(user));
  });

  router.get("/", async (req, res) => {
    const query = parseOrThrow(listQuerySchema, req.query, "query");
    res.json(await service.list(query));
  });

  router.get("/:userId", async (req, res) => {
    const { userId } = parseOrThrow(userIdParamsSchema, req.params, "userId");
    const { view, includeDeleted } = parseOrThrow(getQuerySchema, req.query, "query");
    const user = await service.get(userId, includeDeleted);
    res
      .set("ETag", `"${user.version}"`)
      .json(view === "detailed" ? toDetailedView(user, includeDeleted) : toBasicView(user, includeDeleted));
  });

  router.put("/:userId", async (req, res) => {
    const { userId } = parseOrThrow(userIdParamsSchema, req.params, "userId");
    const expectedVersion = versionFromIfMatch(req.get("If-Match"));
    const input = parseOrThrow(userInputSchema, req.body, "body");
    const user = await service.update(userId, expectedVersion, input);
    res.set("ETag", `"${user.version}"`).json(toDetailedView(user));
  });

  router.delete("/:userId", async (req, res) => {
    const { userId } = parseOrThrow(userIdParamsSchema, req.params, "userId");
    const expectedVersion = versionFromIfMatch(req.get("If-Match"));
    await service.delete(userId, expectedVersion);
    res.status(204).end();
  });

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
  if (!parsed.success) {
    throw validationProblem(
      parsed.error.issues.map((issue) => ({
        field: issue.path.map(String).join(".") || whole,
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}
