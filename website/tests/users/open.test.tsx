import { screen, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, onTestFinished, test } from "vitest";
import { openWithToken } from "../helpers/app.ts";
import { apiUrl, DEMO_TOKEN, detailedUser, fakeApi, firstPageUsers, problem } from "../helpers/fake-api.ts";

const [lee, lewis] = firstPageUsers;

const rightPage = () => screen.getByRole("region", { name: "Opened user" });

describe("open a user: when things go wrong", () => {
  test("user gone (404, for example after the nightly reset): the right page says so in the API's words, and the list stays", async () => {
    fakeApi.use(http.get(apiUrl("/v1/users/:userId"), () => problem(404, "Not found", "No user with this id")));
    const user = await openWithToken();

    await user.click(screen.getByRole("button", { name: "Lewis" }));

    const alert = await within(rightPage()).findByRole("alert");
    expect(alert).toHaveTextContent("404");
    expect(alert).toHaveTextContent("No user with this id");
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  test("API unreachable while opening: a message on the right page, and the list stays", async () => {
    fakeApi.use(http.get(apiUrl("/v1/users/:userId"), () => HttpResponse.error()));
    const user = await openWithToken();

    await user.click(screen.getByRole("button", { name: "Lewis" }));

    expect(await within(rightPage()).findByRole("alert")).toHaveTextContent(/can't reach the API/i);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  test("two quick clicks: shows the last user clicked, even when the first answer arrives later", async () => {
    fakeApi.use(
      http.get(apiUrl("/v1/users/:userId"), async ({ params }) => {
        if (params.userId === lee.id) {
          await delay(200); // Lee's answer is slow and arrives after Lewis's
          return HttpResponse.json(detailedUser(lee, { dateOfBirth: "1970-01-01" }));
        }
        return HttpResponse.json(detailedUser(lewis, { dateOfBirth: "1990-02-02" }));
      }),
    );
    const user = await openWithToken();

    await user.click(screen.getByRole("button", { name: "Lee" }));
    await user.click(screen.getByRole("button", { name: "Lewis" }));
    expect(await within(rightPage()).findByDisplayValue("1990-02-02")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 300)); // let Lee's late answer arrive

    expect(within(rightPage()).getByRole("heading", { level: 2 })).toHaveTextContent("Levi Lewis");
    expect(within(rightPage()).getByDisplayValue("1990-02-02")).toBeInTheDocument();
    expect(within(rightPage()).queryByDisplayValue("1970-01-01")).not.toBeInTheDocument();
  });

  test("while loading: shows the name from the list right away, not a blank page", async () => {
    let answer!: () => void;
    const answered = new Promise<void>((resolve) => (answer = resolve));
    onTestFinished(() => answer());
    fakeApi.use(
      http.get(apiUrl("/v1/users/:userId"), async () => {
        await answered;
        return HttpResponse.json(detailedUser(lee));
      }),
    );
    const user = await openWithToken();

    await user.click(screen.getByRole("button", { name: "Lee" }));

    expect(within(rightPage()).getByRole("heading", { level: 2 })).toHaveTextContent("Carter Lee");
    expect(within(rightPage()).getByText("carter.lee@example.com")).toBeInTheDocument();
    expect(within(rightPage()).getByText(/loading details/i)).toBeInTheDocument();

    answer();
    expect(await within(rightPage()).findByDisplayValue("1988-04-12")).toBeInTheDocument();
    expect(within(rightPage()).queryByText(/loading details/i)).not.toBeInTheDocument();
  });
});

describe("open a user: the normal case", () => {
  test("asks for the detailed view with the token, highlights the row, and fills the form with everything about the user", async () => {
    let authorization: string | null = null;
    let query = "";
    let path = "";
    fakeApi.use(
      http.get(apiUrl("/v1/users/:userId"), ({ request }) => {
        authorization = request.headers.get("Authorization");
        path = new URL(request.url).pathname;
        query = new URL(request.url).search;
        return HttpResponse.json(detailedUser(lewis), { headers: { ETag: '"3"' } });
      }),
    );
    const user = await openWithToken();

    await user.click(screen.getByRole("button", { name: "Lewis" }));

    const page = rightPage();
    expect(await within(page).findByDisplayValue("1988-04-12")).toBeInTheDocument();
    const field = (label: string) => within(page).getByLabelText(label);
    expect(within(page).getByRole("heading", { level: 2 })).toHaveTextContent("Levi Lewis");
    expect(within(page).getByText(/version 3/)).toBeInTheDocument();
    expect(field("First name")).toHaveValue("Levi");
    expect(field("Last name")).toHaveValue("Lewis");
    expect(field("Email")).toHaveValue("levi.lewis@example.com");
    expect(field("Date of birth")).toHaveValue("1988-04-12");
    // Phone numbers come back as +13055550130 and are shown the way people write them.
    expect(field("Phone 1 number")).toHaveValue("(305) 555-0130");
    expect(field("Phone 1 type")).toHaveValue("mobile");
    expect(field("Phone 1 is primary")).toBeChecked();
    expect(field("Phone 2 number")).toHaveValue("(305) 555-0131");
    expect(field("Phone 2 type")).toHaveValue("work");
    expect(field("Phone 2 is primary")).not.toBeChecked();
    expect(field("Address 1 street")).toHaveValue("1420 Brickell Ave");
    expect(field("Address 1 street 2")).toHaveValue("Apt 4B");
    expect(field("Address 1 city")).toHaveValue("Miami");
    expect(field("Address 1 state")).toHaveValue("FL");
    expect(field("Address 1 ZIP")).toHaveValue("33101");
    expect(field("Address 1 type")).toHaveValue("home");

    expect(screen.getByRole("button", { name: "Lewis" }).closest("tr")).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Lee" }).closest("tr")).not.toHaveAttribute("aria-current");

    expect(authorization).toBe(`Bearer ${DEMO_TOKEN}`);
    expect(path).toBe(`/v1/users/${lewis.id}`);
    // includeDeleted: a user someone deleted meanwhile shows as deleted (with Restore), not as missing.
    expect(Object.fromEntries(new URLSearchParams(query))).toEqual({ view: "detailed", includeDeleted: "true" });
  });

  test("opens from the keyboard: Enter on a last name", async () => {
    const user = await openWithToken();

    screen.getByRole("button", { name: "Lopez" }).focus();
    await user.keyboard("{Enter}");

    expect(await within(rightPage()).findByDisplayValue("1988-04-12")).toBeInTheDocument();
    expect(within(rightPage()).getByRole("heading", { level: 2 })).toHaveTextContent("Mason Lopez");
  });
});
