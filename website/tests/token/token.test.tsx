import { act, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, onTestFinished, test, vi } from "vitest";
import { openWithToken, startApp } from "../helpers/app.ts";
import { apiUrl, countRequests, detailedUser, fakeApi, firstPageUsers, listQueries, problem, tokenAnswer } from "../helpers/fake-api.ts";

// A fake clock that still moves on its own, so waiting for the page keeps working; tests jump it ahead when needed.
function useFakeClock() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  onTestFinished(() => void vi.useRealTimers());
}

// Moves the clock ahead by ms (at least 1 s), ending with one tick of the page's 1-second clock so it redraws.
async function passTime(ms: number) {
  await act(async () => {
    vi.setSystemTime(Date.now() + ms - 1000);
    await vi.advanceTimersByTimeAsync(1000);
  });
}

const leftPage = () => screen.getByRole("region", { name: "Users list" });
const rightPage = () => screen.getByRole("region", { name: "Opened user" });

describe("demo token: when things go wrong", () => {
  test("opening the page sends nothing to the API until the visitor asks for a token", async () => {
    const requests = countRequests();

    startApp();

    expect(within(leftPage()).getByRole("heading", { name: "No token, no list." })).toBeInTheDocument();
    expect(within(rightPage()).getByRole("heading", { name: "What's a demo token?" })).toBeInTheDocument();
    expect(screen.getByText("no token")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(requests).toEqual([]);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("API unreachable: says so with Try again, and the second try gets the list", async () => {
    let tries = 0;
    fakeApi.use(http.post(apiUrl("/demo/token"), () => (++tries === 1 ? HttpResponse.error() : tokenAnswer())));
    const user = startApp();

    await user.click(screen.getByRole("button", { name: "Get demo token" }));

    expect(await within(leftPage()).findByRole("alert")).toHaveTextContent(/can't reach the API/i);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(tries).toBe(2);
  });

  test("too many requests (429): counts down from the API's Retry-After, with Try again paused until it ends", async () => {
    useFakeClock();
    let tries = 0;
    fakeApi.use(
      http.post(apiUrl("/demo/token"), () => {
        tries++;
        const answer = problem(429, "Too many requests", "Rate limit exceeded; retry after 38 seconds");
        answer.headers.set("Retry-After", "38");
        return answer;
      }),
    );
    const user = startApp();

    await user.click(screen.getByRole("button", { name: "Get demo token" }));

    expect(await within(leftPage()).findByRole("alert")).toHaveTextContent("429");
    expect(within(leftPage()).getByText("Too many requests from your address. Try again in 38 s.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeDisabled();

    await passTime(20_000);
    expect(within(leftPage()).getByText("Too many requests from your address. Try again in 18 s.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeDisabled();

    await passTime(18_000);
    expect(within(leftPage()).queryByText(/try again in/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(tries).toBe(1);
  });

  test("no demo mode (401): shows the API's own words, and no list", async () => {
    fakeApi.use(http.post(apiUrl("/demo/token"), () => problem(401, "Not signed in", "A valid admin token is required")));
    const user = startApp();

    await user.click(screen.getByRole("button", { name: "Get demo token" }));

    const alert = await within(leftPage()).findByRole("alert");
    expect(alert).toHaveTextContent("401");
    expect(alert).toHaveTextContent("A valid admin token is required");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("the hour runs out: the list and the opened user are replaced, nothing is sent with the dead token, and a new token brings the list back", async () => {
    useFakeClock();
    const user = await openWithToken();
    await user.click(screen.getByRole("button", { name: "Lee" }));
    expect(await within(rightPage()).findByDisplayValue("1988-04-12")).toBeInTheDocument();

    await passTime(3599_000);
    expect(screen.getByText("demo token, 0:01 left")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();

    const requests = countRequests();
    await passTime(1_000);

    expect(within(leftPage()).getByRole("heading", { name: "Your demo token expired." })).toBeInTheDocument();
    expect(screen.getByText("demo token expired")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(within(rightPage()).queryByText("Carter Lee")).not.toBeInTheDocument();
    expect(within(rightPage()).getByRole("heading", { name: "What's a demo token?" })).toBeInTheDocument();
    await passTime(5_000);
    expect(requests).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Get a new token" }));

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(within(rightPage()).queryByText("Carter Lee")).not.toBeInTheDocument();
    expect(requests).toHaveLength(2);
    expect(requests[0]).toBe("POST /demo/token");
    expect(listQueries(requests)).toEqual([{ sort: "lastName", page: "1", pageSize: "10" }]);
  });

  test("a late 401 for the old token, arriving after a new token was got, doesn't end the new one", async () => {
    useFakeClock();
    let tokens = 0;
    let letOldAnswerArrive!: () => void;
    const oldAnswerMayArrive = new Promise<void>((resolve) => (letOldAnswerArrive = resolve));
    onTestFinished(() => letOldAnswerArrive());
    fakeApi.use(
      http.post(apiUrl("/demo/token"), () =>
        HttpResponse.json({ token: `token-${++tokens}`, tokenType: "Bearer" as const, expiresIn: 3600 as const, note: "Demo only" }),
      ),
      http.get(apiUrl("/v1/users/:userId"), async ({ request }) => {
        if (request.headers.get("Authorization") !== "Bearer token-1") return HttpResponse.json(detailedUser(firstPageUsers[0]));
        await oldAnswerMayArrive; // held back until the new token is in use
        return problem(401, "Not signed in", "A valid admin token is required");
      }),
    );
    const user = await openWithToken();
    await user.click(screen.getByRole("button", { name: "Lee" })); // asked with token-1; its answer is held back

    await passTime(3600_000); // token-1 expires
    await user.click(screen.getByRole("button", { name: "Get a new token" }));
    expect(await screen.findByRole("table")).toBeInTheDocument(); // token-2 in use

    await act(async () => {
      letOldAnswerArrive();
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "The API stopped accepting your token." })).not.toBeInTheDocument();
    expect(screen.getByText(/^demo token, \d+:\d\d left$/)).toBeInTheDocument();
    expect(tokens).toBe(2);
  });

  test("the API stops accepting the token (401 during use): the same page, saying the token was refused", async () => {
    fakeApi.use(http.get(apiUrl("/v1/users"), () => problem(401, "Not signed in", "A valid admin token is required")));
    const user = startApp();

    await user.click(screen.getByRole("button", { name: "Get demo token" }));

    expect(await within(leftPage()).findByRole("heading", { name: "The API stopped accepting your token." })).toBeInTheDocument();
    expect(screen.getByText("demo token refused")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get a new token" })).toBeEnabled();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("demo token: the normal case", () => {
  test("Get demo token shows the list, and the corner counts down from 60:00", async () => {
    useFakeClock();

    await openWithToken();

    expect(screen.getByText("demo token, 60:00 left")).toBeInTheDocument();
    await passTime(1_000);
    expect(screen.getByText("demo token, 59:59 left")).toBeInTheDocument();
  });
});
