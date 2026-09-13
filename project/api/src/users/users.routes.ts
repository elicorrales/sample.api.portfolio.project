import { Router } from "express";
import { validationProblem } from "../shared/errors.ts";
import { userInputSchema } from "./users.schema.ts";
import { toDetailedView, type UsersService } from "./users.service.ts";

// HTTP layer: parse the request, call the service, shape the response.
export function usersRoutes(service: UsersService) {
  const router = Router();

  router.post("/", async (req, res) => {
    const parsed = userInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationProblem(
        parsed.error.issues.map((issue) => ({
          field: issue.path.map(String).join(".") || "body",
          message: issue.message,
        })),
      );
    }

    const user = await service.create(parsed.data);
    res
      .status(201)
      .location(`/v1/users/${user.id}`)
      .set("ETag", `"${user.version}"`)
      .json(toDetailedView(user));
  });

  return router;
}
