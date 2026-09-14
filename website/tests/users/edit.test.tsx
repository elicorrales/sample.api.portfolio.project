import { fireEvent, screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { openWithToken } from "../helpers/app.ts";
import { apiUrl, countRequests, fakeApi, problem } from "../helpers/fake-api.ts";
import { fakeUserStore, threeUsers } from "../helpers/fake-store.ts";

const [lee, lewis, nora] = threeUsers();

const leftPage = () => screen.getByRole("region", { name: "Users list" });
const rightPage = () => screen.getByRole("region", { name: "Opened user" });
const field = (label: string) => within(rightPage()).getByLabelText(label);
const button = (name: string) => screen.getByRole("button", { name });
const lastNamesShown = () => within(screen.getByRole("table")).getAllByRole("button").map((cell) => cell.textContent);

async function start() {
  const store = fakeUserStore(threeUsers());
  fakeApi.use(...store.handlers);
  const user = await openWithToken();
  return { store, user };
}

async function openUser(user: UserEvent, lastName: string) {
  await user.click(button(lastName));
  await within(rightPage()).findByLabelText("First name");
}

async function fillNewUser(user: UserEvent) {
  await user.click(button("New user"));
  await user.type(field("First name"), "Ada");
  await user.type(field("Last name"), "Lovelace");
  await user.type(field("Email"), "ada.lovelace@example.com");
  fireEvent.change(field("Date of birth"), { target: { value: "1990-05-17" } }); // a date picker, not typed letter by letter
  await user.type(field("Phone 1 number"), "(305) 555-0199");
  await user.type(field("Address 1 street"), "1 Main St");
  await user.type(field("Address 1 city"), "Miami");
  await user.selectOptions(field("Address 1 state"), "FL");
  await user.type(field("Address 1 ZIP"), "33101");
}

describe("add, edit, delete, restore: when things go wrong", () => {
  test("create refused (400): each of the API's messages shows next to the field it names, and nothing typed is lost", async () => {
    const { user } = await start();
    fakeApi.use(
      http.post(apiUrl("/v1/users"), () =>
        problem(400, "Invalid input", "2 fields are invalid", {
          type: "/problems/validation",
          errors: [
            { field: "phones.0.number", message: "Area code can't start with 0 or 1" },
            { field: "addresses.0.zip", message: "Must be 5 digits" },
          ],
        }),
      ),
    );
    await fillNewUser(user);

    await user.click(button("Save"));

    expect(await within(rightPage()).findByRole("alert")).toHaveTextContent("The API answered 400: 2 fields are invalid");
    expect(field("Phone 1 number")).toHaveAccessibleDescription("Area code can't start with 0 or 1");
    expect(field("Address 1 ZIP")).toHaveAccessibleDescription("Must be 5 digits");
    expect(field("Email")).not.toHaveAccessibleDescription();
    expect(field("First name")).toHaveValue("Ada");
    expect(lastNamesShown()).toEqual(["Lee", "Lewis"]);
  });

  test("email already used (409): the message shows next to Email", async () => {
    const { user } = await start();
    await fillNewUser(user);
    await user.clear(field("Email"));
    await user.type(field("Email"), "CARTER.LEE@example.com");

    await user.click(button("Save"));

    expect(await within(rightPage()).findByText("Another user already has this email")).toBeInTheDocument();
    expect(field("Email")).toHaveAccessibleDescription("Another user already has this email");
  });

  test("user limit reached (409): a message above Save, not at Email", async () => {
    const { user } = await start();
    fakeApi.use(
      http.post(apiUrl("/v1/users"), () =>
        problem(409, "User limit reached", "This server stores at most 200 users, including deleted ones", { type: "/problems/user-limit" }),
      ),
    );
    await fillNewUser(user);

    await user.click(button("Save"));

    expect(await within(rightPage()).findByRole("alert")).toHaveTextContent("This server stores at most 200 users, including deleted ones");
    expect(field("Email")).not.toHaveAccessibleDescription();
  });

  test("someone saved first (412): nothing of yours is saved, and Load their version replaces your edits with theirs", async () => {
    const { store, user } = await start();
    await openUser(user, "Lee");
    await user.clear(field("Last name"));
    await user.type(field("Last name"), "Leigh");
    store.changeBehindTheScenes(lee.id, { firstName: "Carla" }); // another admin saves version 4

    await user.click(button("Save"));

    expect(await within(rightPage()).findByRole("alert")).toHaveTextContent("Someone saved this user first. Nothing of yours was saved.");
    expect(field("Last name")).toHaveValue("Leigh");
    expect(store.users.get(lee.id)?.lastName).toBe("Lee");

    await user.click(button("Load their version"));

    expect(await within(rightPage()).findByDisplayValue("Carla")).toBeInTheDocument();
    expect(field("Last name")).toHaveValue("Lee");
    expect(within(rightPage()).getByText(/version 4/)).toBeInTheDocument();
  });

  test("delete with a stale copy (412): nothing is deleted, and the page says why", async () => {
    const { store, user } = await start();
    await openUser(user, "Lee");
    store.changeBehindTheScenes(lee.id, { firstName: "Carla" });

    await user.click(button("Delete user"));
    await user.click(button("Yes, delete"));

    expect(await within(rightPage()).findByRole("alert")).toHaveTextContent("Someone changed this user first. Nothing was deleted.");
    expect(store.users.get(lee.id)?.deletedAt).toBeNull();
    expect(button("Load their version")).toBeInTheDocument();
    expect(lastNamesShown()).toContain("Lee");
  });

  test("unsaved changes: another user or New user is blocked until Save or Cancel, and nothing typed is lost", async () => {
    const { user } = await start();
    await openUser(user, "Lee");
    await user.type(field("First name"), "x");

    await user.click(button("Lewis"));

    expect(within(rightPage()).getByText("You have unsaved changes: Save or Cancel first.")).toBeInTheDocument();
    expect(within(rightPage()).getByRole("heading", { level: 2 })).toHaveTextContent("Carter Lee");
    expect(field("First name")).toHaveValue("Carterx");

    await user.click(button("New user"));
    expect(field("First name")).toHaveValue("Carterx");

    await user.click(button("Cancel"));
    expect(field("First name")).toHaveValue("Carter");
    expect(within(rightPage()).queryByText("You have unsaved changes: Save or Cancel first.")).not.toBeInTheDocument();

    await user.click(button("Lewis"));
    expect(await within(rightPage()).findByDisplayValue("Levi")).toBeInTheDocument();
  });

  test("restore when someone already restored the user (409): says so, and shows the user as they are now", async () => {
    const { store, user } = await start();
    await user.click(within(leftPage()).getByRole("checkbox", { name: "Include deleted" }));
    await user.click(await screen.findByRole("button", { name: "O'Brien" }));
    await within(rightPage()).findByRole("button", { name: "Restore" });
    store.changeBehindTheScenes(nora.id, { deletedAt: null }); // another admin restores first

    await user.click(button("Restore"));

    expect(await within(rightPage()).findByText("Someone restored this user first.")).toBeInTheDocument();
    expect(await within(rightPage()).findByLabelText("First name")).toHaveValue("Nora");
  });

  test("rate limit during save (429): the API's words show, and your edits stay", async () => {
    const { user } = await start();
    await openUser(user, "Lee");
    await user.clear(field("Last name"));
    await user.type(field("Last name"), "Leigh");
    fakeApi.use(
      http.put(apiUrl("/v1/users/:userId"), () => {
        const answer = problem(429, "Too many requests", "Rate limit exceeded; retry after 30 seconds");
        answer.headers.set("Retry-After", "30");
        return answer;
      }),
    );

    await user.click(button("Save"));

    const alert = await within(rightPage()).findByRole("alert");
    expect(alert).toHaveTextContent("429");
    expect(alert).toHaveTextContent("Rate limit exceeded; retry after 30 seconds");
    expect(field("Last name")).toHaveValue("Leigh");
    expect(button("Save")).toBeEnabled();
  });

  test("Save and Cancel stay off until something changes, and Cancel puts back what was loaded", async () => {
    const { user } = await start();
    await openUser(user, "Lee");

    expect(button("Save")).toBeDisabled();
    expect(button("Cancel")).toBeDisabled();

    await user.type(field("First name"), "x");
    expect(button("Save")).toBeEnabled();

    await user.click(button("Cancel"));
    expect(field("First name")).toHaveValue("Carter");
    expect(button("Save")).toBeDisabled();
  });

  test("phones: add up to 3 (one of each type), never fewer than 1, and removing the primary makes the first one primary", async () => {
    const { user } = await start();
    await user.click(button("New user"));

    expect(within(rightPage()).queryByRole("button", { name: "Remove phone 1" })).not.toBeInTheDocument();
    expect(within(rightPage()).queryByLabelText("Phone 1 is primary")).not.toBeInTheDocument(); // one phone is primary automatically

    await user.click(button("Add phone"));
    await user.click(button("Add phone"));

    expect(field("Phone 1 type")).toHaveValue("mobile");
    expect(field("Phone 2 type")).toHaveValue("home");
    expect(field("Phone 3 type")).toHaveValue("work");
    expect(button("Add phone")).toBeDisabled();
    expect(field("Phone 1 is primary")).toBeChecked();

    await user.click(button("Remove phone 1"));

    expect(within(rightPage()).queryByLabelText("Phone 3 number")).not.toBeInTheDocument();
    expect(field("Phone 1 type")).toHaveValue("home");
    expect(field("Phone 1 is primary")).toBeChecked();
    expect(button("Add phone")).toBeEnabled();
  });
});

describe("add, edit, delete, restore: the normal case", () => {
  test("New user: sends exactly what was filled in, then the list shows the new user and the form shows what the API saved", async () => {
    const { user } = await start();
    let sent: unknown = null;
    fakeApi.use(
      http.post(apiUrl("/v1/users"), async ({ request }) => {
        sent = await request.clone().json(); // then the stored-users fake answers
      }),
    );
    await fillNewUser(user);

    await user.click(button("Save"));

    expect(await within(rightPage()).findByText(/version 1/)).toBeInTheDocument();
    expect(sent).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada.lovelace@example.com",
      dateOfBirth: "1990-05-17",
      phones: [{ number: "(305) 555-0199", type: "mobile", primary: true }],
      addresses: [{ street: "1 Main St", city: "Miami", state: "FL", zip: "33101", type: "home", primary: true }],
    });
    expect(within(rightPage()).getByRole("heading", { level: 2 })).toHaveTextContent("Ada Lovelace");
    expect(field("Phone 1 number")).toHaveValue("(305) 555-0199");
    expect(button("Save")).toBeDisabled();
    expect(await within(leftPage()).findByRole("button", { name: "Lovelace" })).toBeInTheDocument();
    expect(lastNamesShown()).toEqual(["Lee", "Lewis", "Lovelace"]);
  });

  test("edit: Save sends the whole user with If-Match, and the new version and name show on both pages", async () => {
    const { user } = await start();
    let ifMatch: string | null = null;
    let sent: { lastName?: string; phones?: unknown } = {};
    fakeApi.use(
      http.put(apiUrl("/v1/users/:userId"), async ({ request }) => {
        ifMatch = request.headers.get("If-Match");
        sent = (await request.clone().json()) as typeof sent;
      }),
    );
    await openUser(user, "Lewis");
    await user.clear(field("Last name"));
    await user.type(field("Last name"), "Lewin");

    await user.click(button("Save"));

    expect(await within(rightPage()).findByText(/version 4/)).toBeInTheDocument();
    expect(ifMatch).toBe('"3"');
    expect(sent.lastName).toBe("Lewin");
    expect(sent.phones).toEqual([
      { number: "(305) 555-0130", type: "mobile", primary: true },
      { number: "(305) 555-0131", type: "work", primary: false },
    ]);
    expect(within(rightPage()).getByRole("heading", { level: 2 })).toHaveTextContent("Levi Lewin");
    expect(button("Save")).toBeDisabled();
    expect(await within(leftPage()).findByRole("button", { name: "Lewin" })).toBeInTheDocument();
  });

  test("delete: asks on the page first (Keep sends nothing), then deletes with If-Match and shows the user as deleted", async () => {
    const { user } = await start();
    await openUser(user, "Lewis");
    const requests = countRequests();

    await user.click(button("Delete user"));
    expect(within(rightPage()).getByText("Delete Levi Lewis?")).toBeInTheDocument();
    await user.click(button("Keep"));
    expect(within(rightPage()).queryByText("Delete Levi Lewis?")).not.toBeInTheDocument();
    expect(requests).toEqual([]);

    await user.click(button("Delete user"));
    await user.click(button("Yes, delete"));

    expect(await within(rightPage()).findByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(within(rightPage()).getByText(/^Deleted 2026-09-13/)).toBeInTheDocument();
    expect(within(rightPage()).queryByLabelText("First name")).not.toBeInTheDocument(); // read-only while deleted
    expect(requests[0]).toBe(`DELETE /v1/users/${lewis.id}`);
    expect(await within(leftPage()).findByText("1 user, page 1 of 1")).toBeInTheDocument();
    expect(lastNamesShown()).toEqual(["Lee"]);
  });

  test("Include deleted: asks the API for deleted users too, marks them, and opens one read-only with Restore", async () => {
    const { user } = await start();
    const requests = countRequests();

    await user.click(within(leftPage()).getByRole("checkbox", { name: "Include deleted" }));

    const noraRow = (await screen.findByRole("button", { name: "O'Brien" })).closest("tr")!;
    expect(within(noraRow).getByText("deleted")).toBeInTheDocument();
    expect(requests.at(-1)).toContain("includeDeleted=true");

    await user.click(button("O'Brien"));

    expect(await within(rightPage()).findByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(within(rightPage()).getByText("nora.obrien@example.com")).toBeInTheDocument();
    expect(within(rightPage()).queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  test("restore: brings the user back, editable again, and the list stops marking them deleted", async () => {
    const { user } = await start();
    await user.click(within(leftPage()).getByRole("checkbox", { name: "Include deleted" }));
    await user.click(await screen.findByRole("button", { name: "O'Brien" }));

    await user.click(await within(rightPage()).findByRole("button", { name: "Restore" }));

    expect(await within(rightPage()).findByLabelText("First name")).toHaveValue("Nora");
    expect(within(rightPage()).getByText(/version 5/)).toBeInTheDocument();
    const noraRow = screen.getByRole("button", { name: "O'Brien" }).closest("tr")!;
    await expect.poll(() => within(noraRow).queryByText("deleted")).toBeNull();
  });
});
