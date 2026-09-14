import type { components } from "../api/schema.ts";

type UserDetailed = components["schemas"]["UserDetailed"];
type UserInput = components["schemas"]["UserInput"];
type PhoneType = components["schemas"]["PhoneType"];
type AddressType = components["schemas"]["AddressType"];
type UsState = components["schemas"]["UsState"];

// What the form edits: every value is a string or a choice, so half-typed input is fine. The API decides if it's valid.
export type PhoneDraft = { number: string; type: PhoneType; primary: boolean };
export type AddressDraft = { street: string; street2: string; city: string; state: UsState | ""; zip: string; type: AddressType; primary: boolean };
export type UserDraft = { firstName: string; lastName: string; email: string; dateOfBirth: string; phones: PhoneDraft[]; addresses: AddressDraft[] };

export const MAX_ROWS = 3; // the spec's maxItems for phones and addresses
export const PHONE_TYPES: PhoneType[] = ["mobile", "home", "work"];
export const ADDRESS_TYPES: AddressType[] = ["home", "work", "mailing"];
// The spec's UsState values, in its order. `satisfies` stops a typo; the check below stops a missing one.
export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC", "AS", "GU", "MP", "PR", "VI",
] as const satisfies readonly UsState[];
const everyStateListed: Exclude<UsState, (typeof US_STATES)[number]> extends never ? true : false = true;
void everyStateListed;

export function emptyDraft(): UserDraft {
  return {
    firstName: "",
    lastName: "",
    email: "",
    dateOfBirth: "",
    phones: [{ number: "", type: "mobile", primary: true }],
    addresses: [{ street: "", street2: "", city: "", state: "", zip: "", type: "home", primary: true }],
  };
}

export function draftOf(user: UserDetailed): UserDraft {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    dateOfBirth: user.dateOfBirth,
    phones: user.phones.map((phone) => ({ number: readablePhone(phone.number), type: phone.type, primary: phone.primary })),
    addresses: user.addresses.map((address) => ({ ...address, street2: address.street2 ?? "" })),
  };
}

// Sent as typed. A single phone or address is always primary; an empty street 2 is left out.
export function inputOf(draft: UserDraft): UserInput {
  return {
    firstName: draft.firstName,
    lastName: draft.lastName,
    email: draft.email,
    dateOfBirth: draft.dateOfBirth,
    phones: draft.phones.map((phone) => ({ number: phone.number, type: phone.type, primary: draft.phones.length === 1 || phone.primary })),
    addresses: draft.addresses.map(({ street2, state, ...address }) => ({
      ...address,
      ...(street2.trim() ? { street2 } : {}),
      state: state as UsState, // an empty state is sent as is, and the API names the field
      primary: draft.addresses.length === 1 || address.primary,
    })),
  };
}

export const sameDraft = (a: UserDraft, b: UserDraft) => JSON.stringify(a) === JSON.stringify(b);

// +13055550130 → (305) 555-0130, the way people write it (the API accepts both).
export function readablePhone(e164: string) {
  const parts = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return parts ? `(${parts[1]}) ${parts[2]}-${parts[3]}` : e164;
}

// Adds a row of the first type not used yet. Removes a row, keeping one primary.
export function withRowAdded<T extends { type: string; primary: boolean }>(rows: T[], types: T["type"][], blank: Omit<T, "type" | "primary">): T[] {
  const type = types.find((candidate) => !rows.some((row) => row.type === candidate)) ?? types[0];
  return [...rows, { ...blank, type, primary: false } as T];
}

export function withRowRemoved<T extends { primary: boolean }>(rows: T[], index: number): T[] {
  const left = rows.filter((_, i) => i !== index);
  return left.some((row) => row.primary) ? left : left.map((row, i) => ({ ...row, primary: i === 0 }));
}

// Every field name the form can show a message next to, as the API names them (phones.0.number).
export function fieldNamesOf(draft: UserDraft): Set<string> {
  const names = ["firstName", "lastName", "email", "dateOfBirth"];
  draft.phones.forEach((_, i) => names.push(`phones.${i}.number`, `phones.${i}.type`));
  draft.addresses.forEach((_, i) => ["street", "street2", "city", "state", "zip", "type"].forEach((part) => names.push(`addresses.${i}.${part}`)));
  return new Set(names);
}
