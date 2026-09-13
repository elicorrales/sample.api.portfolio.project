import { Router } from "express";
import type { z } from "zod";
import { validationProblem } from "../shared/errors.ts";
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
    const { view } = parseOrThrow(getQuerySchema, req.query, "query");
    const user = await service.get(userId);
    res.set("ETag", `"${user.version}"`).json(view === "detailed" ? toDetailedView(user) : toBasicView(user));
  });

  return router;
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
