import { screen, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, onTestFinished, test } from "vitest";
import { openWithToken } from "../helpers/app.ts";
import { apiUrl, countRequests, fakeApi, listAnswer, listLikeTheApi, listQueries, twentyFiveUsers } from "../helpers/fake-api.ts";

const PAUSE = 300; // the search waits this long after the last keystroke
const waitPastPause = () => new Promise((resolve) => setTimeout(resolve, PAUSE + 150));

const searchBox = () => screen.getByRole("searchbox", { name: "Search name or email" });
const lastNamesShown = () => within(screen.getByRole("table")).getAllByRole("button").map((button) => button.textContent);

describe("paging and search: when things go wrong", () => {
  test("an empty or spaces-only box sends no search (the API refuses an empty one with 400), and the box stops at 100 characters", async () => {
    fakeApi.use(listLikeTheApi(() => twentyFiveUsers));
    const user = await openWithToken();
    const requests = countRequests();

    await user.type(searchBox(), "   ");
    await waitPastPause();
    expect(listQueries(requests)).toEqual([]); // nothing changed, so nothing sent

    await user.clear(searchBox());
    await user.type(searchBox(), "a");
    await waitPastPause();
    await user.clear(searchBox());
    await waitPastPause();

    expect(listQueries(requests)).toEqual([
      { sort: "lastName", search: "a", page: "1", pageSize: "10" },
      { sort: "lastName", page: "1", pageSize: "10" },
    ]);
    expect(await screen.findByText("25 users, page 1 of 3")).toBeInTheDocument();
    expect(searchBox()).toHaveAttribute("maxlength", "100");
  });

  test("typing fast sends one search after the pause, and a slow answer for an earlier search doesn't replace the later one", async () => {
    fakeApi.use(
      http.get(apiUrl("/v1/users"), async ({ request }) => {
        if (new URL(request.url).searchParams.get("search") === "Le") await delay(600); // "Le" answers last
        return listAnswer(request, twentyFiveUsers);
      }),
    );
    const user = await openWithToken();
    const requests = countRequests();

    await user.type(searchBox(), "Le");
    await waitPastPause(); // "Le" is sent, and its answer is slow
    await user.type(searchBox(), "wis");
    await waitPastPause(); // "Lewis" is sent, answered at once

    expect(await screen.findByText("1 user, page 1 of 1")).toBeInTheDocument();
    expect(lastNamesShown()).toEqual(["Lewis"]);
    await new Promise((resolve) => setTimeout(resolve, 700)); // let the "Le" answer arrive

    expect(lastNamesShown()).toEqual(["Lewis"]);
    expect(screen.getByText("1 user, page 1 of 1")).toBeInTheDocument();
    expect(listQueries(requests).map((query) => query.search)).toEqual(["Le", "Lewis"]);
  });

  test("no matches: says so, with no table", async () => {
    fakeApi.use(listLikeTheApi(() => twentyFiveUsers));
    const user = await openWithToken();

    await user.type(searchBox(), "zzz");

    expect(await screen.findByText('No users match "zzz".')).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("SQL-looking text is sent exactly as typed, finds nothing, and every user is still there after", async () => {
    fakeApi.use(listLikeTheApi(() => twentyFiveUsers));
    const user = await openWithToken();
    const requests = countRequests();

    await user.type(searchBox(), "'; DROP TABLE users;--");

    expect(await screen.findByText(`No users match "'; DROP TABLE users;--".`)).toBeInTheDocument();
    expect(listQueries(requests).at(-1)).toEqual({ sort: "lastName", search: "'; DROP TABLE users;--", page: "1", pageSize: "10" });

    await user.clear(searchBox());
    expect(await screen.findByText("25 users, page 1 of 3")).toBeInTheDocument();
  });

  test("page past the end (users deleted meanwhile): says so, and offers the last page", async () => {
    let users = twentyFiveUsers;
    fakeApi.use(listLikeTheApi(() => users));
    const user = await openWithToken();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("25 users, page 2 of 3")).toBeInTheDocument();

    users = twentyFiveUsers.slice(0, 15); // 10 users deleted: now only 2 pages
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Page 3 is past the end; there are now 2 pages.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Go to page 2" }));

    expect(await screen.findByText("15 users, page 2 of 2")).toBeInTheDocument();
    expect(lastNamesShown()).toEqual(["Hall", "Harris", "Jones", "King", "Lee"]);
  });

  test("buttons: Previous off on page 1, Next off on the last page, both paused while loading with the old rows still showing", async () => {
    let answer!: () => void;
    const answered = new Promise<void>((resolve) => (answer = resolve));
    onTestFinished(() => answer());
    let holding = false;
    fakeApi.use(
      http.get(apiUrl("/v1/users"), async ({ request }) => {
        if (holding) await answered;
        return listAnswer(request, twentyFiveUsers);
      }),
    );
    const user = await openWithToken();

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();

    holding = true;
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
    expect(lastNamesShown()[0]).toBe("Adams"); // page 1 still visible while page 2 loads

    holding = false;
    answer();
    expect(await screen.findByText("25 users, page 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("25 users, page 3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });
});

describe("paging and search: the normal case", () => {
  test("Next asks for page 2, a search starts again at page 1, and the opened user stays open", async () => {
    fakeApi.use(listLikeTheApi(() => twentyFiveUsers));
    const user = await openWithToken();
    const requests = countRequests();
    const rightPage = screen.getByRole("region", { name: "Opened user" });

    await user.click(screen.getByRole("button", { name: "Adams" }));
    expect(await within(rightPage).findByDisplayValue("1988-04-12")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("25 users, page 2 of 3")).toBeInTheDocument();
    expect(lastNamesShown()[0]).toBe("Hall");

    await user.type(searchBox(), "lew");
    expect(await screen.findByText("1 user, page 1 of 1")).toBeInTheDocument();
    expect(lastNamesShown()).toEqual(["Lewis"]);

    expect(listQueries(requests)).toEqual([
      { sort: "lastName", page: "2", pageSize: "10" },
      { sort: "lastName", search: "lew", page: "1", pageSize: "10" },
    ]);
    expect(within(rightPage).getByRole("heading", { level: 2 })).toHaveTextContent("Ryan Adams");
  });
});
