import { randomUUID } from "node:crypto";
import { conflictProblem } from "../shared/errors.ts";
import type { Address, Phone, User, UsersRepository } from "./users.repository.ts";
import { ADDRESS_TYPES, PHONE_TYPES, type UserInput } from "./users.schema.ts";

// Business rules. Knows nothing about HTTP; only talks to the repository interface.
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  async create(input: UserInput): Promise<User> {
    const existing = await this.repository.findByEmail(input.email);
    if (existing) {
      throw conflictProblem(
        existing.deletedAt
          ? "A deleted user has this email; restore that user instead"
          : "A user with this email already exists",
      );
    }

    const now = new Date().toISOString();
    const user: User = {
      id: randomUUID(),
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      dateOfBirth: input.dateOfBirth,
      phones: sortByPrimaryThenType(withPrimary(input.phones), PHONE_TYPES),
      addresses: sortByPrimaryThenType(
        withPrimary(input.addresses).map((address) => ({ ...address, street2: address.street2 ?? null })),
        ADDRESS_TYPES,
      ),
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await this.repository.insert(user);
    return user;
  }
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

// The detailed view. `deletedAt` is left out; it only appears when including deleted users.
export function toDetailedView({ deletedAt: _deletedAt, ...user }: User) {
  return user;
}
