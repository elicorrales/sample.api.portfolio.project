import type { User, UsersRepository } from "./users.repository.ts";

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

  async insert(user: User) {
    this.users.set(user.id, structuredClone(user));
  }
}
