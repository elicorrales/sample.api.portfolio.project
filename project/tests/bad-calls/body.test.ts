import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../helpers/api.ts";
import { expectProblem } from "../helpers/problems.ts";
import { adminToken } from "../helpers/tokens.ts";
import { createUser, userInput } from "../helpers/users.ts";

// A. Request body. Create and update share the same rules; most cases go through create.

const phone = (overrides: Record<string, unknown> = {}) => ({ number: "3055551234", type: "mobile", ...overrides });
const address = (overrides: Record<string, unknown> = {}) => ({
  street: "1 Main St",
  city: "Miami",
  state: "FL",
  zip: "33101",
  type: "home",
  ...overrides,
});

async function create(body: unknown) {
  return api().post("/v1/users").set("Authorization", `Bearer ${await adminToken()}`).send(body as object);
}

describe("bad calls: request body", () => {
  describe("A1. not JSON, or no body", () => {
    it("rejects malformed JSON", async () => {
      const res = await api()
        .post("/v1/users")
        .set("Authorization", `Bearer ${await adminToken()}`)
        .set("Content-Type", "application/json")
        .send('{"firstName": ');
      expectProblem(res, 400);
    });

    it("rejects a plain-text body", async () => {
      const res = await api()
        .post("/v1/users")
        .set("Authorization", `Bearer ${await adminToken()}`)
        .set("Content-Type", "text/plain")
        .send("firstName=Ann");
      expectProblem(res, 400, "body");
    });

    it("rejects a missing body", async () => {
      const res = await api().post("/v1/users").set("Authorization", `Bearer ${await adminToken()}`);
      expectProblem(res, 400, "body");
    });
  });

  it.each(["firstName", "lastName", "email", "dateOfBirth", "phones", "addresses"])(
    "A2. rejects a missing %s",
    async (field) => {
      const { [field as keyof ReturnType<typeof userInput>]: _removed, ...body } = userInput();
      expectProblem(await create(body), 400, field);
    },
  );

  describe("A3. unknown fields", () => {
    it.each(["id", "role"])("rejects %s in the body, naming it", async (field) => {
      expectProblem(await create({ ...userInput(), [field]: "x" }), 400, field);
    });

    it("doesn't echo an unknown field name that isn't a plain name", async () => {
      const res = await create({ ...userInput(), "<script>": "x" });
      expectProblem(res, 400, "(unknown)");
      expect(res.text).not.toContain("<script>");
    });

    it("rejects an unknown field inside a phone, naming where it is", async () => {
      expectProblem(await create(userInput({ phones: [phone({ extension: "12" })] })), 400, "phones.0.extension");
    });
  });

  it.each([
    ["empty", ""],
    ["spaces only", "   "],
    ["51 characters", "A".repeat(51)],
    ["an accented letter", "José"],
    ["digits", "R2D2"],
    ["a symbol", "Bob!"],
    ["no letters", "--"],
    ["a curly apostrophe", "D’Angelo"],
  ])("A4. rejects a first name with %s", async (_case, firstName) => {
    expectProblem(await create(userInput({ firstName })), 400, "firstName");
  });

  it.each([
    ["one letter", "O"],
    ["50 characters", "A".repeat(50)],
    ["an apostrophe", "O'Brien"],
    ["a space", "Mary Ann"],
    ["a period", "Jr."],
    ["a hyphen", "Smith-Jones"],
  ])("A5. accepts a last name with %s", async (_case, lastName) => {
    expect((await create(userInput({ lastName }))).status).toBe(201);
  });

  it.each([
    ["no @", "ann.example.com"],
    ["nothing after @", "ann@"],
    ["over 254 characters", `${"a".repeat(60)}@${`${"b".repeat(60)}.`.repeat(4)}com`],
  ])("A6. rejects an email with %s", async (_case, email) => {
    expectProblem(await create(userInput({ email })), 400, "email");
  });

  describe("A7. date of birth (today frozen at 2026-06-15)", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      ["an impossible month", "1990-13-01"],
      ["U.S. format", "05/17/1990"],
      ["a future date", "2026-06-16"],
      ["turning 18 tomorrow", "2008-06-16"],
    ])("rejects %s", async (_case, dateOfBirth) => {
      vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
      expectProblem(await create(userInput({ dateOfBirth })), 400, "dateOfBirth");
    });

    it("accepts turning 18 today", async () => {
      vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
      expect((await create(userInput({ dateOfBirth: "2008-06-15" }))).status).toBe(201);
    });

    it("treats a Feb 29 birthday as turning 18 on Mar 1 in a non-leap year", async () => {
      vi.setSystemTime(new Date("2026-02-28T12:00:00Z"));
      expectProblem(await create(userInput({ dateOfBirth: "2008-02-29" })), 400, "dateOfBirth");
      vi.setSystemTime(new Date("2026-03-01T12:00:00Z"));
      expect((await create(userInput({ dateOfBirth: "2008-02-29" }))).status).toBe(201);
    });
  });

  it.each([
    ["none", [], "phones"],
    ["4", [phone(), phone({ type: "home" }), phone({ type: "work" }), phone({ type: "home" })], "phones"],
    ["two of the same type", [phone({ primary: true }), phone()], "phones"],
    ["two, none primary", [phone(), phone({ type: "home" })], "phones"],
    ["two, both primary", [phone({ primary: true }), phone({ type: "home", primary: true })], "phones"],
    ["an area code starting with 0", [phone({ number: "0055551234" })], "phones.0.number"],
    ["an area code starting with 1", [phone({ number: "1055551234" })], "phones.0.number"],
    ["9 digits", [phone({ number: "305555123" })], "phones.0.number"],
    ["letters", [phone({ number: "305555ABCD" })], "phones.0.number"],
    ["a non-U.S. number", [phone({ number: "+44 20 7946 0958" })], "phones.0.number"],
    ["an unknown type", [phone({ type: "fax" })], "phones.0.type"],
    ["primary as text", [phone({ primary: "yes" })], "phones.0.primary"],
  ])("A8. rejects phones: %s", async (_case, phones, field) => {
    expectProblem(await create(userInput({ phones })), 400, field);
  });

  it.each([
    ["none", [], "addresses"],
    ["4", [address(), address({ type: "work" }), address({ type: "mailing" }), address({ type: "work" })], "addresses"],
    ["two of the same type", [address({ primary: true }), address()], "addresses"],
    ["two, none primary", [address(), address({ type: "work" })], "addresses"],
    ["an unknown state", [address({ state: "XX" })], "addresses.0.state"],
    ["a 4-digit ZIP", [address({ zip: "1234" })], "addresses.0.zip"],
    ["a 6-digit ZIP", [address({ zip: "123456" })], "addresses.0.zip"],
    ["a ZIP+4", [address({ zip: "12345-6789" })], "addresses.0.zip"],
    ["a street over 100 characters", [address({ street: "A".repeat(101) })], "addresses.0.street"],
    ["a slash in street line 2", [address({ street2: "Apt 4/B" })], "addresses.0.street2"],
    ["an unknown type", [address({ type: "office" })], "addresses.0.type"],
  ])("A9. rejects addresses: %s", async (_case, addresses, field) => {
    expectProblem(await create(userInput({ addresses })), 400, field);
  });

  it("A9. accepts every allowed address character", async () => {
    const res = await create(userInput({ addresses: [address({ street: "123 Main St., Apt #4", street2: "Bldg B-2" })] }));
    expect(res.status).toBe(201);
  });

  describe("A10. error body", () => {
    it("uses Problem Details with a field list", async () => {
      const res = await create(userInput({ firstName: "", email: "nope" }));
      expectProblem(res, 400, "firstName");
      expect(res.body).toMatchObject({ type: "/problems/validation", title: "Invalid input", instance: "/v1/users" });
      for (const error of res.body.errors) {
        expect(error).toEqual({ field: expect.any(String), message: expect.any(String) });
      }
    });

    it("never echoes the submitted values back", async () => {
      const res = await create(userInput({ firstName: "<script>alert(1)</script>", email: "<img src=x>" }));
      expectProblem(res, 400, "firstName");
      expect(res.text).not.toContain("<script>");
      expect(res.text).not.toContain("<img");
    });
  });

  describe("update uses the same rules", () => {
    it.each([
      ["no phones", { phones: [] }, "phones"],
      ["an unknown field", { role: "admin" }, "role"],
    ])("rejects %s", async (_case, overrides, field) => {
      const client = api();
      const user = await createUser(client);
      const res = await client
        .put(`/v1/users/${user.id}`)
        .set("Authorization", `Bearer ${await adminToken()}`)
        .set("If-Match", '"1"')
        .send({ ...userInput({ email: user.email }), ...overrides });
      expectProblem(res, 400, field);
    });
  });
});
