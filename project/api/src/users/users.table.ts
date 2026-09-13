import { sql } from "drizzle-orm";
import { boolean, check, date, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { ADDRESS_TYPES, PHONE_TYPES } from "./users.schema.ts";

// Database tables for users. `drizzle-kit generate` turns changes here into SQL migrations (api/migrations/).
// Columns are snake_case in the database; the repository maps them to the API's camelCase.
// Formats and lengths are checked by Zod (users.schema.ts). The database enforces the rules
// that protect the data itself: unique email, one phone or address per type, one primary.

// `'mobile', 'home', 'work'` for a CHECK constraint, from the same list Zod uses.
const sqlList = (values: readonly string[]) => sql.raw(values.map((value) => `'${value}'`).join(", "));

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    // Returned as "1990-01-01", never a JavaScript Date, so it can't shift a day with the time zone.
    dateOfBirth: date("date_of_birth", { mode: "string" }).notNull(),
    version: integer("version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    // Null means not deleted.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // Emails match ignoring case, and deleted users keep theirs (emails are never reused).
    uniqueIndex("users_email_unique").on(sql`lower(${t.email})`),
  ],
);

export const userPhones = pgTable(
  "user_phones",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    // E.164: +13055551234
    number: text("number").notNull(),
    // "primary" is a reserved word in SQL.
    isPrimary: boolean("is_primary").notNull(),
  },
  (t) => [
    // One phone per type for each user.
    primaryKey({ columns: [t.userId, t.type] }),
    check("user_phones_type_check", sql`${t.type} IN (${sqlList(PHONE_TYPES)})`),
    // At most one primary phone per user.
    uniqueIndex("user_phones_one_primary").on(t.userId).where(sql`${t.isPrimary}`),
  ],
);

export const userAddresses = pgTable(
  "user_addresses",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    street: text("street").notNull(),
    street2: text("street2"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    zip: text("zip").notNull(),
    isPrimary: boolean("is_primary").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.type] }),
    check("user_addresses_type_check", sql`${t.type} IN (${sqlList(ADDRESS_TYPES)})`),
    uniqueIndex("user_addresses_one_primary").on(t.userId).where(sql`${t.isPrimary}`),
  ],
);
