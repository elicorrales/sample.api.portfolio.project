import { safeLogFields } from "../shared/errors.ts";
import type { User } from "../users/users.repository.ts";
import type { PgUsersRepository } from "../users/users.repository.pg.ts";
import { buildNewUser } from "../users/users.service.ts";
import { userInputSchema } from "../users/users.schema.ts";
import { DEMO_USERS } from "./demo-users.ts";

// The hosted demo looks after its own data: the starting users on first start, and a reset every night,
// so it never needs anyone to clean up after visitors. server.ts runs this only in demo mode; tests call it directly.

const RESET_HOUR_UTC = 8; // 4 AM Eastern and 1 AM Pacific in summer; an hour earlier in winter

// The starting users as stored, through the same validation and building as a real create.
// `parse` throws if a starting user ever breaks the API's rules.
function buildDemoUsers(): User[] {
  const now = new Date().toISOString();
  return DEMO_USERS.map(({ input, deleted }) => {
    const user = buildNewUser(userInputSchema.parse(input), now);
    // Deleted the way the API deletes: marked, and one version later.
    return deleted ? { ...user, version: 2, deletedAt: now } : user;
  });
}

// Adds the starting users only if there are no users at all, deleted ones included. Returns whether it did.
export function seedDemoUsersIfEmpty(repository: PgUsersRepository) {
  return repository.insertAllIfEmpty(buildDemoUsers());
}

// Empties the tables and adds the starting users again, all in one transaction: if anything fails, nothing changes.
export function resetDemoUsers(repository: PgUsersRepository) {
  return repository.replaceAll(buildDemoUsers());
}

// Milliseconds from `now` until the next 08:00 UTC. Exactly at 08:00, that's the next day's.
export function msUntilNextReset(now: Date) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), RESET_HOUR_UTC);
  return next > now.getTime() ? next - now.getTime() : next + 24 * 3600 * 1000 - now.getTime();
}

// Resets at every 08:00 UTC. Each run schedules the next one from the clock, so a slow reset never drifts.
// Returns a function that cancels the schedule (for shutdown).
export function scheduleNightlyReset(repository: PgUsersRepository) {
  let timer: NodeJS.Timeout;
  const scheduleNext = () => {
    timer = setTimeout(async () => {
      try {
        await resetDemoUsers(repository);
        console.log(`Demo data reset at ${new Date().toISOString()}`);
      } catch (error) {
        console.error("Demo data reset failed; the data is unchanged", safeLogFields("RESET", "demo", error));
      }
      scheduleNext();
    }, msUntilNextReset(new Date()));
  };
  scheduleNext();
  return () => clearTimeout(timer);
}
