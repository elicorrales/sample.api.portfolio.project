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
  findById(id: string): Promise<User | undefined>;
  insert(user: User): Promise<void>;
  // One page of matching users, plus how many match in total. Search, sort, and paging
  // happen here because a database does them far better than code after the fact.
  list(query: ListQuery): Promise<{ items: User[]; totalItems: number }>;
}
