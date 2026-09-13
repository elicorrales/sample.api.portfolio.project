import type { ListQuery } from "../../api/src/users/users.schema.ts";
import type { User, UsersRepository } from "../../api/src/users/users.repository.ts";

// Wraps the real repository so a test can force two requests to overlap.
// `holdUntil("findByEmail", 2)` holds the next calls to findByEmail until 2 have arrived, then lets them
// all go at once. Both requests have then passed their check before either one saves: the race
// happens on every run instead of by luck.
export class RacingRepository implements UsersRepository {
  private held?: { method: keyof UsersRepository; count: number; waiting: (() => void)[] };

  constructor(private readonly real: UsersRepository) {}

  holdUntil(method: keyof UsersRepository, count: number) {
    this.held = { method, count, waiting: [] };
  }

  private async gate(method: keyof UsersRepository) {
    const held = this.held;
    if (held?.method !== method) return;
    await new Promise<void>((resolve) => {
      held.waiting.push(resolve);
      if (held.waiting.length === held.count) {
        this.held = undefined;
        for (const release of held.waiting) release();
      }
    });
  }

  async findByEmail(email: string) {
    await this.gate("findByEmail");
    return this.real.findByEmail(email);
  }

  async findById(id: string) {
    await this.gate("findById");
    return this.real.findById(id);
  }

  async insert(user: User) {
    await this.gate("insert");
    return this.real.insert(user);
  }

  async replace(user: User, expectedVersion: number) {
    await this.gate("replace");
    return this.real.replace(user, expectedVersion);
  }

  async list(query: ListQuery) {
    await this.gate("list");
    return this.real.list(query);
  }
}
