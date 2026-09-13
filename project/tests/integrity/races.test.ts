import request from "supertest";
import { describe, expect, it } from "vitest";
import { PgUsersRepository } from "../../api/src/users/users.repository.pg.ts";
import { testApp } from "../helpers/api.ts";
import { testDatabase } from "../helpers/database.ts";
import { RacingRepository } from "../helpers/racing-repository.ts";
import { adminToken } from "../helpers/tokens.ts";
import { createUser, userInput } from "../helpers/users.ts";

// A. Two requests at once. The API checks, then saves, in separate steps. The racing repository holds
// both requests right after their check, so both pass it before either one saves.

function racingClient() {
  const repository = new RacingRepository(new PgUsersRepository(testDatabase));
  return { client: request(testApp({ usersRepository: repository })), repository };
}

// Which request wins isn't fixed, so compare the statuses in order.
const statuses = (...responses: request.Response[]) => responses.map((res) => res.status).sort((a, b) => a - b);

describe("integrity: two requests at once", () => {
  it("A1. two creates with the same email → one 201, one 409, and exactly one user", async () => {
    const { client, repository } = racingClient();
    const auth = `Bearer ${await adminToken()}`;

    repository.holdUntil("findByEmail", 2);
    const [first, second] = await Promise.all([
      client.post("/v1/users").set("Authorization", auth).send(userInput({ email: "ann@example.com", firstName: "Ann" })),
      client.post("/v1/users").set("Authorization", auth).send(userInput({ email: "ann@example.com", firstName: "Annie" })),
    ]);

    expect(statuses(first, second)).toEqual([201, 409]);
    const list = await client.get("/v1/users").set("Authorization", auth);
    expect(list.body.totalItems).toBe(1);
  });

  it("A2. two creates with the same email in different case → one 201, one 409", async () => {
    const { client, repository } = racingClient();
    const auth = `Bearer ${await adminToken()}`;

    repository.holdUntil("findByEmail", 2);
    const [first, second] = await Promise.all([
      client.post("/v1/users").set("Authorization", auth).send(userInput({ email: "Ann@Example.com" })),
      client.post("/v1/users").set("Authorization", auth).send(userInput({ email: "ann@example.com" })),
    ]);

    expect(statuses(first, second)).toEqual([201, 409]);
    const list = await client.get("/v1/users").set("Authorization", auth);
    expect(list.body.totalItems).toBe(1);
  });

  it("A3. changing a user's email to one being created at the same moment → one of them gets 409", async () => {
    const { client, repository } = racingClient();
    const auth = `Bearer ${await adminToken()}`;
    const bob = await createUser(client, { email: "bob@example.com" });

    repository.holdUntil("findByEmail", 2);
    const [created, updated] = await Promise.all([
      client.post("/v1/users").set("Authorization", auth).send(userInput({ email: "shared@example.com" })),
      client
        .put(`/v1/users/${bob.id}`)
        .set("Authorization", auth)
        .set("If-Match", '"1"')
        .send(userInput({ email: "shared@example.com" })),
    ]);

    expect([created.status, updated.status]).toContain(409);
    expect([created.status, updated.status]).toSatisfy(
      ([c, u]: number[]) => (c === 201 && u === 409) || (c === 409 && u === 200),
    );
    const list = await client.get("/v1/users?search=shared").set("Authorization", auth);
    expect(list.body.totalItems).toBe(1);
  });

  it("A4. two updates with the same version → one 200, one 412; saved once, and it's the winner's data", async () => {
    const { client, repository } = racingClient();
    const auth = `Bearer ${await adminToken()}`;
    const ann = await createUser(client, { email: "ann@example.com" });
    const edit = (firstName: string) =>
      client
        .put(`/v1/users/${ann.id}`)
        .set("Authorization", auth)
        .set("If-Match", '"1"')
        .send(userInput({ email: "ann@example.com", firstName }));

    repository.holdUntil("findById", 2);
    const [first, second] = await Promise.all([edit("Alice"), edit("Anna")]);

    expect(statuses(first, second)).toEqual([200, 412]);
    const winner = first.status === 200 ? first : second;
    const saved = await client.get(`/v1/users/${ann.id}?view=detailed`).set("Authorization", auth);
    expect(saved.headers.etag).toBe('"2"');
    expect(saved.body).toEqual(winner.body);
  });

  it("A5. an update and a delete with the same version → one wins, the other gets 412", async () => {
    const { client, repository } = racingClient();
    const auth = `Bearer ${await adminToken()}`;
    const ann = await createUser(client, { email: "ann@example.com", firstName: "Ann" });

    repository.holdUntil("findById", 2);
    const [updated, deleted] = await Promise.all([
      client
        .put(`/v1/users/${ann.id}`)
        .set("Authorization", auth)
        .set("If-Match", '"1"')
        .send(userInput({ email: "ann@example.com", firstName: "Changed" })),
      client.delete(`/v1/users/${ann.id}`).set("Authorization", auth).set("If-Match", '"1"'),
    ]);

    expect([updated.status, deleted.status]).toSatisfy(
      ([u, d]: number[]) => (u === 200 && d === 412) || (u === 412 && d === 204),
    );
    const saved = await client.get(`/v1/users/${ann.id}?view=detailed&includeDeleted=true`).set("Authorization", auth);
    expect(saved.headers.etag).toBe('"2"');
    // Exactly one of the two changes happened.
    const wasDeleted = saved.body.deletedAt !== null;
    const wasEdited = saved.body.firstName === "Changed";
    expect(wasDeleted).not.toBe(wasEdited);
  });

  it("A6. two restores of the same user → one 200, one 409; the version goes up once", async () => {
    const { client, repository } = racingClient();
    const auth = `Bearer ${await adminToken()}`;
    const ann = await createUser(client);
    await client.delete(`/v1/users/${ann.id}`).set("Authorization", auth).set("If-Match", '"1"');

    repository.holdUntil("findById", 2);
    const [first, second] = await Promise.all([
      client.post(`/v1/users/${ann.id}/restore`).set("Authorization", auth),
      client.post(`/v1/users/${ann.id}/restore`).set("Authorization", auth),
    ]);

    expect(statuses(first, second)).toEqual([200, 409]);
    const saved = await client.get(`/v1/users/${ann.id}`).set("Authorization", auth);
    expect(saved.headers.etag).toBe('"3"');
  });
});
