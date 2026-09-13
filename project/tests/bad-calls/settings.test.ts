import { describe, expect, it } from "vitest";
import { readSettings, SettingsError } from "../../api/src/shared/settings.ts";

// G. Bad settings. A typo in the host's settings must stop the server with a clear message,
// not let it run quietly with the wrong value. Every problem is listed at once, so one deploy shows them all.

const secret = "s".repeat(32);
const required = { JWT_SECRET: secret, DATABASE_URL: "postgres://user:password@db.internal:5432/users_api" };

// The problems readSettings refuses to start with; empty if it accepts the settings.
function problemsWith(env: Record<string, string | undefined>) {
  try {
    readSettings(env);
    return [];
  } catch (error) {
    if (!(error instanceof SettingsError)) throw error;
    return error.problems;
  }
}

describe("bad calls: settings", () => {
  it("G1. nothing set → both required settings named, in one error", () => {
    const problems = problemsWith({});

    expect(problems).toHaveLength(2);
    expect(problems.join("\n")).toContain("JWT_SECRET");
    expect(problems.join("\n")).toContain("DATABASE_URL");
  });

  it("G2. a JWT_SECRET of 31 characters → refused, without printing the secret", () => {
    const shortSecret = "k".repeat(31);

    const problems = problemsWith({ ...required, JWT_SECRET: shortSecret });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("JWT_SECRET");
    expect(problems[0]).toContain("32");
    expect(problems[0]).not.toContain(shortSecret);
  });

  it.each([
    ["TRUST_PROXY", "abc"],
    ["TRUST_PROXY", "-1"],
    ["TRUST_PROXY", "1.5"],
    ["DEMO_MODE", "yes"],
    ["DEMO_MODE", "1"],
    ["DEMO_MODE", "TRUE"],
    ["MAX_USERS", "0"],
    ["MAX_USERS", "abc"],
    ["PORT", "abc"],
  ])("G3. %s=%s → refused, naming the setting and the value", (name, value) => {
    const problems = problemsWith({ ...required, [name]: value });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(name);
    expect(problems[0]).toContain(`"${value}"`);
  });

  it("G4. several mistakes at once → all listed", () => {
    const problems = problemsWith({ DATABASE_URL: required.DATABASE_URL, TRUST_PROXY: "one", DEMO_MODE: "yes" });

    expect(problems).toHaveLength(3);
  });

  it("G5. only the required settings → the defaults", () => {
    expect(readSettings(required)).toEqual({
      jwtSecret: secret,
      databaseUrl: required.DATABASE_URL,
      port: 3000,
      corsOrigins: [],
      trustProxy: 0,
      demoMode: false,
      maxUsers: undefined,
    });
  });

  it("G6. every setting given → each one read back", () => {
    const settings = readSettings({
      ...required,
      PORT: "10000",
      CORS_ORIGINS: "https://admin.example.com,https://other.example.com",
      TRUST_PROXY: "1",
      DEMO_MODE: "true",
      MAX_USERS: "200",
    });

    expect(settings).toEqual({
      jwtSecret: secret,
      databaseUrl: required.DATABASE_URL,
      port: 10000,
      corsOrigins: ["https://admin.example.com", "https://other.example.com"],
      trustProxy: 1,
      demoMode: true,
      maxUsers: 200,
    });
  });
});
