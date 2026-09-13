import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

// The public docs: the Swagger UI page at /docs and the spec at /openapi.yaml. No token needed, so anyone
// can read the contract and try it; app.ts mounts these before auth.

const page = readFileSync(new URL("./docs.page.html", import.meta.url), "utf8");
const specPath = fileURLToPath(new URL("../../openapi.yaml", import.meta.url));
const swaggerUiFolder = dirname(createRequire(import.meta.url).resolve("swagger-ui-dist/package.json"));
const swaggerUiFiles = ["swagger-ui.css", "swagger-ui-bundle.js"];

export function docsRoutes() {
  const router = express.Router();

  router.get("/docs", (_req, res) => {
    res.type("html").send(page);
  });

  // Only the two Swagger UI files the page loads. Serving the whole package folder would also serve its
  // index.html (a sample Petstore spec). A name not on this list, or one with `..` in it, falls through to auth.
  router.get("/docs/:file", (req, res, next) => {
    const file = req.params.file;
    if (!swaggerUiFiles.includes(file)) return next();
    res.sendFile(join(swaggerUiFolder, file));
  });

  router.get("/openapi.yaml", (_req, res) => {
    res.type("application/yaml").sendFile(specPath);
  });

  return router;
}
