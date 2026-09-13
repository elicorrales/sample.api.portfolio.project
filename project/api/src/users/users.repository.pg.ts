import { and, asc, desc, eq, ilike, inArray, isNull, or, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { Database } from "../shared/database.ts";
import {
  type Address,
  EmailTakenError,
  type Phone,
  sortByPrimaryThenType,
  type User,
  type UsersRepository,
} from "./users.repository.ts";
import { ADDRESS_TYPES, type ListQuery, PHONE_TYPES } from "./users.schema.ts";
import { userAddresses, userPhones, users } from "./users.table.ts";

// PostgreSQL storage. Every value goes in as a query parameter, never pasted into the SQL text.
export class PgUsersRepository implements UsersRepository {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string) {
    const rows = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`);
    return (await this.withPhonesAndAddresses(rows))[0];
  }

  async findById(id: string) {
    const rows = await this.db.select().from(users).where(eq(users.id, id));
    return (await this.withPhonesAndAddresses(rows))[0];
  }

  async insert(user: User) {
    await this.db
      .transaction(async (tx) => {
        await tx.insert(users).values(toUserRow(user));
        await insertPhonesAndAddresses(tx, user);
      })
      .catch(rethrowEmailTaken);
  }

  async replace(user: User, expectedVersion: number) {
    return this.db
      .transaction(async (tx) => {
        // Saves only if the version is still the one the caller loaded; one statement, so two saves can't both win.
        const saved = await tx
          .update(users)
          .set(toUserRow(user))
          .where(and(eq(users.id, user.id), eq(users.version, expectedVersion)))
          .returning({ id: users.id });
        if (saved.length === 0) return false;

        // Phones and addresses have no ids, so the whole set is replaced.
        await tx.delete(userPhones).where(eq(userPhones.userId, user.id));
        await tx.delete(userAddresses).where(eq(userAddresses.userId, user.id));
        await insertPhonesAndAddresses(tx, user);
        return true;
      })
      .catch(rethrowEmailTaken);
  }

  async list({ search, sort, order, page, pageSize, includeDeleted }: ListQuery) {
    const filters: SQL[] = [];
    if (!includeDeleted) filters.push(isNull(users.deletedAt));
    if (search) {
      // % and _ are LIKE wildcards; escaped, they match only themselves.
      const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
      filters.push(or(ilike(users.firstName, pattern), ilike(users.lastName, pattern), ilike(users.email, pattern))!);
    }
    const where = and(...filters);

    // Ignoring case, in plain character order (COLLATE "C"), so hyphens and spaces sort
    // the same everywhere. Ties: first name, then id, always ascending.
    const byText = (column: AnyPgColumn) => sql`lower(${column}) COLLATE "C"`;
    const direction = order === "desc" ? desc : asc;

    const [rows, totalItems] = await Promise.all([
      this.db
        .select()
        .from(users)
        .where(where)
        .orderBy(direction(byText(users[sort])), asc(byText(users.firstName)), asc(users.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.$count(users, where),
    ]);
    return { items: await this.withPhonesAndAddresses(rows), totalItems };
  }

  // Loads the phones and addresses for a set of users in two queries (not two per user).
  private async withPhonesAndAddresses(rows: (typeof users.$inferSelect)[]): Promise<User[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const [phoneRows, addressRows] = await Promise.all([
      this.db.select().from(userPhones).where(inArray(userPhones.userId, ids)),
      this.db.select().from(userAddresses).where(inArray(userAddresses.userId, ids)),
    ]);

    // Rows come back in no particular order, so phones and addresses are put back in the API's order.
    return rows.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      dateOfBirth: row.dateOfBirth,
      phones: sortByPrimaryThenType(
        phoneRows
          .filter((phone) => phone.userId === row.id)
          .map(({ number, type, isPrimary }) => ({ number, type: type as Phone["type"], primary: isPrimary })),
        PHONE_TYPES,
      ),
      addresses: sortByPrimaryThenType(
        addressRows
          .filter((address) => address.userId === row.id)
          .map(({ street, street2, city, state, zip, type, isPrimary }) => ({
            street,
            street2,
            city,
            state,
            zip,
            type: type as Address["type"],
            primary: isPrimary,
          })),
        ADDRESS_TYPES,
      ),
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    }));
  }
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

// The unique index on lower(email) refused the save (PostgreSQL error 23505). Drizzle wraps the
// database's error, so it's in `cause`. Anything else is a real failure and passes through.
function rethrowEmailTaken(error: unknown): never {
  const dbError = (error as { cause?: { code?: string; constraint?: string } }).cause;
  if (dbError?.code === "23505" && dbError.constraint === "users_email_unique") throw new EmailTakenError();
  throw error;
}

async function insertPhonesAndAddresses(tx: Transaction, user: User) {
  if (user.phones.length > 0) {
    await tx
      .insert(userPhones)
      .values(user.phones.map(({ number, type, primary }) => ({ userId: user.id, number, type, isPrimary: primary })));
  }
  if (user.addresses.length > 0) {
    await tx
      .insert(userAddresses)
      .values(user.addresses.map(({ primary, ...address }) => ({ userId: user.id, ...address, isPrimary: primary })));
  }
}

function toUserRow(user: User) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    dateOfBirth: user.dateOfBirth,
    version: user.version,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
    deletedAt: user.deletedAt ? new Date(user.deletedAt) : null,
  };
}
