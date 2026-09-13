import { z } from "zod";

// Input validation for the whole user, matching UserInput in openapi.yaml.
// Unknown fields are rejected at every level (strictObject).

export const PHONE_TYPES = ["mobile", "home", "work"] as const;
export const ADDRESS_TYPES = ["home", "work", "mailing"] as const;

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC", "AS", "GU", "MP", "PR", "VI",
] as const;

const personName = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^(?=.*[A-Za-z])[A-Za-z .'-]+$/, "Letters A-Z, spaces, hyphens, periods, and ' only");

// Date only, not in the future, and 18 or older. Compared as YYYY-MM-DD strings in UTC,
// so someone born Feb 29 turns 18 on Mar 1 in non-leap years.
const dateOfBirth = z.iso.date().superRefine((dob, ctx) => {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = `${Number(today.slice(0, 4)) - 18}${today.slice(4)}`;
  if (dob > today) {
    ctx.addIssue({ code: "custom", message: "Must not be in the future" });
  } else if (dob > cutoff) {
    ctx.addIssue({ code: "custom", message: "Must be 18 or older" });
  }
});

// Any common U.S. format in; E.164 (+13055551234) out.
const phoneNumber = z
  .string()
  .min(10)
  .max(20)
  .transform((raw, ctx) => {
    const allDigits = raw.replace(/\D/g, "");
    // Only digits, spaces, dots, dashes, parentheses, and a leading "+" (which must be "+1").
    const formatOk = /^\+?[\d\s().-]+$/.test(raw.trim()) && (!raw.trim().startsWith("+") || allDigits.startsWith("1"));
    const digits = allDigits.length === 11 && allDigits.startsWith("1") ? allDigits.slice(1) : allDigits;
    if (!formatOk || !/^[2-9]\d{9}$/.test(digits)) {
      ctx.addIssue({ code: "custom", message: "Must be a 10-digit U.S. number; area code can't start with 0 or 1" });
      return z.NEVER;
    }
    return `+1${digits}`;
  });

// Street, street line 2, and city.
const addressText = (max: number) =>
  z.string().min(1).max(max).regex(/^[A-Za-z0-9 ,.#-]+$/, "Letters, digits, spaces, and - , . # only");

const phoneInput = z.strictObject({
  number: phoneNumber,
  type: z.enum(PHONE_TYPES),
  primary: z.boolean().optional(),
});

const addressInput = z.strictObject({
  street: addressText(100),
  street2: addressText(100).optional(),
  city: addressText(50),
  state: z.enum(US_STATES),
  zip: z.string().regex(/^\d{5}$/, "Must be exactly 5 digits"),
  type: z.enum(ADDRESS_TYPES),
  primary: z.boolean().optional(),
});

// One per type; a single item is primary automatically; with 2–3, exactly one must be primary.
function checkTypesAndPrimary(
  items: { type: string; primary?: boolean | undefined }[],
  field: "phones" | "addresses",
  ctx: z.RefinementCtx,
) {
  if (new Set(items.map((item) => item.type)).size !== items.length) {
    ctx.addIssue({ code: "custom", path: [field], message: "Only one per type" });
  }
  if (items.length > 1 && items.filter((item) => item.primary === true).length !== 1) {
    ctx.addIssue({ code: "custom", path: [field], message: "Exactly one must be primary" });
  }
}

export const userInputSchema = z
  .strictObject({
    firstName: personName,
    lastName: personName,
    email: z.email().max(254),
    dateOfBirth,
    phones: z.array(phoneInput).min(1).max(3),
    addresses: z.array(addressInput).min(1).max(3),
  })
  .superRefine((user, ctx) => {
    checkTypesAndPrimary(user.phones, "phones", ctx);
    checkTypesAndPrimary(user.addresses, "addresses", ctx);
  });

export type UserInput = z.infer<typeof userInputSchema>;

// Query-string booleans arrive as the text "true" or "false".
const includeDeleted = z.enum(["true", "false"]).transform((value) => value === "true").default(false);

// Query strings reject unknown parameters (e.g. the typo `pagesize`), just like request bodies.

// For operations that take no query parameters at all.
export const noQuerySchema = z.strictObject({});

// Query string for listing users. Values arrive as text, so numbers are converted.
export const listQuerySchema = z.strictObject({
  search: z.string().min(1).max(100).optional(),
  sort: z.enum(["lastName", "email"]).default("lastName"),
  order: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  includeDeleted,
});

export type ListQuery = z.infer<typeof listQuerySchema>;

// Path and query for getting one user.
export const userIdParamsSchema = z.object({ userId: z.uuid() });

export const getQuerySchema = z.strictObject({
  view: z.enum(["basic", "detailed"]).default("basic"),
  includeDeleted,
});
