import type { ADDRESS_TYPES, ListQuery, PHONE_TYPES } from "./users.schema.ts";

// A user as stored. Phones and addresses have no ids; (user, type) identifies each one.
export interface Phone {
  number: string;
  type: (typeof PHONE_TYPES)[number];
  primary: boolean;
}

export interface Address {
  street: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  type: (typeof ADDRESS_TYPES)[number];
  primary: boolean;
}

// The order phones and addresses are always kept in: primary first, then the order the admin
// form shows the types (phones mobile, home, work; addresses home, work, mailing).
// The service sorts before saving; storage that doesn't keep list order sorts again when loading.
export function sortByPrimaryThenType<T extends Phone | Address>(items: T[], typeOrder: readonly string[]): T[] {
  return [...items].sort(
    (a, b) => Number(b.primary) - Number(a.primary) || typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type),
  );
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  phones: Phone[];
  addresses: Address[];
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// Data access. The service only talks to this interface, so the storage behind it
// can change (in-memory now, PostgreSQL later) without touching the rules.
export interface UsersRepository {
  // Matches ignoring case, and includes deleted users (emails are never reused).
  findByEmail(email: string): Promise<User | undefined>;
  // Includes deleted users; the service decides whether to hide them.
  findById(id: string): Promise<User | undefined>;
  insert(user: User): Promise<void>;
  // Saves only if the stored version is still `expectedVersion`; returns false otherwise.
  // With a database this is one statement (UPDATE ... WHERE version = ...), so two saves can't both win.
  replace(user: User, expectedVersion: number): Promise<boolean>;
  // One page of matching users, plus how many match in total. Search, sort, and paging
  // happen here because a database does them far better than code after the fact.
  list(query: ListQuery): Promise<{ items: User[]; totalItems: number }>;
}
