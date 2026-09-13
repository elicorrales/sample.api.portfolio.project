import { randomUUID } from "node:crypto";
import { conflictProblem, notFoundProblem, preconditionFailedProblem } from "../shared/errors.ts";
import type { Address, Phone, User, UsersRepository } from "./users.repository.ts";
import { ADDRESS_TYPES, PHONE_TYPES, type ListQuery, type UserInput } from "./users.schema.ts";

// Business rules. Knows nothing about HTTP; only talks to the repository interface.
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  async create(input: UserInput): Promise<User> {
    await this.checkEmailIsFree(input.email);

    const now = new Date().toISOString();
    const user: User = {
      id: randomUUID(),
      ...userContents(input),
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await this.repository.insert(user);
    return user;
  }

  // A deleted user is "not found" unless asked for.
  async get(id: string, includeDeleted = false): Promise<User> {
    const user = await this.repository.findById(id);
    if (!user || (user.deletedAt && !includeDeleted)) throw notFoundProblem("No user with this id");
    return user;
  }

  // Replaces the whole user. Checked in order: exists (404), version (412), email (409).
  async update(id: string, expectedVersion: number, input: UserInput): Promise<User> {
    const current = await this.get(id);
    if (current.version !== expectedVersion) throw versionOutOfDate();
    await this.checkEmailIsFree(input.email, id);

    const updated: User = {
      ...current,
      ...userContents(input),
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };

    // The repository re-checks the version as it saves, in case another save got in between.
    if (!(await this.repository.replace(updated, expectedVersion))) throw versionOutOfDate();
    return updated;
  }

  // Marks the user as deleted; nothing is removed, so it can be restored.
  // Deleting an already-deleted user is "not found". Delete is a change, so the version goes up.
  async delete(id: string, expectedVersion: number): Promise<void> {
    const current = await this.get(id);
    if (current.version !== expectedVersion) throw versionOutOfDate();

    const now = new Date().toISOString();
    const deleted: User = { ...current, deletedAt: now, version: current.version + 1, updatedAt: now };
    if (!(await this.repository.replace(deleted, expectedVersion))) throw versionOutOfDate();
  }

  // A page past the end is not an error: it has no items but still reports the real totals.
  async list(query: ListQuery) {
    const { items, totalItems } = await this.repository.list(query);
    return {
      items: items.map((user) => toBasicView(user, query.includeDeleted)),
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
    };
  }

  // Emails are never reused, so deleted users count too. On update, the user's own email is fine.
  private async checkEmailIsFree(email: string, exceptUserId?: string) {
    const existing = await this.repository.findByEmail(email);
    if (existing && existing.id !== exceptUserId) {
      throw conflictProblem(
        existing.deletedAt
          ? "A deleted user has this email; restore that user instead"
          : "A user with this email already exists",
      );
    }
  }
}

const versionOutOfDate = () => preconditionFailedProblem("This user changed since it was loaded; reload and try again");

// The saved fields that come from the form, shared by create and update.
function userContents(input: UserInput) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    dateOfBirth: input.dateOfBirth,
    phones: sortByPrimaryThenType(withPrimary(input.phones), PHONE_TYPES),
    addresses: sortByPrimaryThenType(
      withPrimary(input.addresses).map((address) => ({ ...address, street2: address.street2 ?? null })),
      ADDRESS_TYPES,
    ),
  };
}

// A single phone or address is primary automatically; otherwise validation already
// guaranteed exactly one is marked.
function withPrimary<T extends { primary?: boolean | undefined }>(items: T[]) {
  return items.map((item) => ({ ...item, primary: items.length === 1 || item.primary === true }));
}

function sortByPrimaryThenType<T extends Phone | Address>(items: T[], typeOrder: readonly string[]): T[] {
  return [...items].sort(
    (a, b) => Number(b.primary) - Number(a.primary) || typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type),
  );
}

// The basic view: what lists show. No date of birth, phones, or addresses.
// `deletedAt` appears only when the caller asked to include deleted users.
export function toBasicView({ id, firstName, lastName, email, deletedAt }: User, includeDeleted = false) {
  return { id, firstName, lastName, email, ...(includeDeleted && { deletedAt }) };
}

// The detailed view: everything, with the same `deletedAt` rule.
export function toDetailedView({ deletedAt, ...user }: User, includeDeleted = false) {
  return { ...user, ...(includeDeleted && { deletedAt }) };
}
