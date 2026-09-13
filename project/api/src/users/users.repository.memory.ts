import type { User, UsersRepository } from "./users.repository.ts";
import type { ListQuery } from "./users.schema.ts";

// In-memory storage: stage 1 of the database path (decision 03).
// Each app gets its own, so tests never share data. Everything is lost when the server stops.
export class MemoryUsersRepository implements UsersRepository {
  private readonly users = new Map<string, User>();

  async findByEmail(email: string) {
    const wanted = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === wanted) return structuredClone(user);
    }
    return undefined;
  }

  async findById(id: string) {
    const user = this.users.get(id);
    return user && structuredClone(user);
  }

  async insert(user: User) {
    this.users.set(user.id, structuredClone(user));
  }

  async replace(user: User, expectedVersion: number) {
    if (this.users.get(user.id)?.version !== expectedVersion) return false;
    this.users.set(user.id, structuredClone(user));
    return true;
  }

  async list({ search, sort, order, page, pageSize }: ListQuery) {
    const term = search?.toLowerCase();
    const matches = [...this.users.values()].filter(
      (user) =>
        !term || [user.firstName, user.lastName, user.email].some((value) => value.toLowerCase().includes(term)),
    );

    // Sort field in the requested direction (ignoring case), then first name and id ascending,
    // so the order is stable across pages.
    const direction = order === "desc" ? -1 : 1;
    matches.sort(
      (a, b) =>
        direction * compareIgnoringCase(a[sort], b[sort]) ||
        compareIgnoringCase(a.firstName, b.firstName) ||
        compareIgnoringCase(a.id, b.id),
    );

    const start = (page - 1) * pageSize;
    return { items: matches.slice(start, start + pageSize).map((user) => structuredClone(user)), totalItems: matches.length };
  }
}

function compareIgnoringCase(a: string, b: string) {
  const [x, y] = [a.toLowerCase(), b.toLowerCase()];
  return x < y ? -1 : x > y ? 1 : 0;
}
