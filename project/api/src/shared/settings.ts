// Every setting the server reads from its environment, checked in one place. A typo in the host's settings
// stops the server with every problem listed, instead of letting it run quietly with a wrong or default value.

export interface Settings {
  jwtSecret: string;
  databaseUrl: string;
  port: number;
  corsOrigins: string[];
  // Proxies in front of the app to trust for the client's IP (X-Forwarded-For); see app.ts.
  trustProxy: number;
  // The public demo: demo tokens, starting users, and the nightly reset (decision 05).
  demoMode: boolean;
  // Most users stored, deleted ones included; undefined means no limit.
  maxUsers: number | undefined;
}

export class SettingsError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`The server can't start:\n${problems.map((problem) => `- ${problem}`).join("\n")}`);
    this.problems = problems;
  }
}

// HS256 signs with this secret; anything shorter than 256 bits (32 characters) is easier to guess.
const MIN_SECRET_LENGTH = 32;

export function readSettings(env: Record<string, string | undefined>): Settings {
  const problems: string[] = [];

  // Secrets are never echoed in a problem: this message ends up in the host's logs.
  const jwtSecret = env.JWT_SECRET ?? "";
  if (!jwtSecret) problems.push("JWT_SECRET is not set");
  else if (jwtSecret.length < MIN_SECRET_LENGTH) problems.push(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);

  const databaseUrl = env.DATABASE_URL ?? "";
  if (!databaseUrl) problems.push("DATABASE_URL is not set");

  // A whole number of at least `min`, or the default when unset.
  function wholeNumber(name: string, min: number, fallback: number | undefined) {
    const value = env[name];
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value) || Number(value) < min) {
      problems.push(`${name} must be a whole number, ${min} or more (got "${value}")`);
      return fallback;
    }
    return Number(value);
  }

  const port = wholeNumber("PORT", 1, 3000) as number;
  const trustProxy = wholeNumber("TRUST_PROXY", 0, 0) as number;
  const maxUsers = wholeNumber("MAX_USERS", 1, undefined);

  let demoMode = false;
  if (env.DEMO_MODE !== undefined) {
    if (env.DEMO_MODE === "true" || env.DEMO_MODE === "false") demoMode = env.DEMO_MODE === "true";
    else problems.push(`DEMO_MODE must be exactly true or false (got "${env.DEMO_MODE}")`);
  }

  const corsOrigins = (env.CORS_ORIGINS ?? "").split(",").filter(Boolean);

  if (problems.length > 0) throw new SettingsError(problems);
  return { jwtSecret, databaseUrl, port, corsOrigins, trustProxy, demoMode, maxUsers };
}
