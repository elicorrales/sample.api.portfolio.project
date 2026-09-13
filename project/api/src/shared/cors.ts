import type { RequestHandler } from "express";

// Lets a web page on another origin (the Swagger UI docs page, later the admin web client) call the API.
// The browser asks first with an OPTIONS "preflight" request; these headers are the answer.
export function cors(allowedOrigins: string[]): RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin;
    res.vary("Origin");
    if (origin && allowedOrigins.includes(origin)) {
      res.set({
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, If-Match",
        // Without this, browser code can't read these response headers.
        "Access-Control-Expose-Headers": "ETag, Location, Retry-After",
      });
    }
    // Answer the preflight here; it carries no token, so it must not reach auth.
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  };
}
