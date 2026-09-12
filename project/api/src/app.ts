import express from "express";

// Builds the Express app without starting a server, so tests can call it directly.
// Skeleton: every request answers 501 until real routes exist.
export function createApp() {
  const app = express();

  app.use((req, res) => {
    res
      .status(501)
      .type("application/problem+json")
      .json({
        type: "/problems/not-implemented",
        title: "Not implemented",
        status: 501,
        detail: `${req.method} ${req.path} is not implemented yet`,
        instance: req.path,
      });
  });

  return app;
}
