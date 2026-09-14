import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { openWithToken, startApp } from "../helpers/app.ts";
import { apiUrl, countRequests, fakeApi, problem } from "../helpers/fake-api.ts";
import { fakeUserStore, threeUsers } from "../helpers/fake-store.ts";

const list = () => screen.getByRole("region", { name: "Experiments list" });
const detail = () => screen.getByRole("region", { name: "Experiment" });
const button = (name: string) => screen.getByRole("button", { name });

// The API's rate limit, faked: the first `allowed` requests answer 401 (no token), then 429 with Retry-After.
function rateLimitAfter(allowed: number) {
  const seen: { authorization: string | null }[] = [];
  fakeApi.use(
    http.get(apiUrl("/v1/users"), ({ request }) => {
      seen.push({ authorization: request.headers.get("Authorization") });
      if (seen.length > allowed) {
        const answer = problem(429, "Too many requests", "Rate limit exceeded; retry after 38 seconds");
        answer.headers.set("Retry-After", "38");
        return answer;
      }
      return problem(401, "Not signed in", "A valid admin token is required");
    }),
  );
  return seen;
}

// The flood is first in the list and opens selected.
async function openFlood() {
  const user = startApp();
  await user.click(button("Experiments"));
  return user;
}

describe("experiments: when things go wrong", () => {
  test("an experiment that doesn't run live: its stamp shows without clicking, and Run replays the test's requests without sending any", async () => {
    const user = startApp();
    await user.click(button("Experiments"));
    const requests = countRequests();

    await user.click(within(list()).getByRole("button", { name: /Save a stale copy/ }));

    expect(within(detail()).getByRole("heading", { name: "Save a stale copy" })).toBeInTheDocument();
    const stamp = within(detail()).getByRole("img", { name: "412, proven by tests" });
    expect(stamp).toHaveTextContent("412");
    expect(within(detail()).getByRole("link", { name: "tests/bad-calls/versions.test.ts" })).toHaveAttribute("href", expect.stringContaining("/project/tests/bad-calls/versions.test.ts"));

    await user.click(within(detail()).getByRole("button", { name: "Replay the test" }));

    const replay = await within(detail()).findByRole("table", { name: "Replay of tests/bad-calls/versions.test.ts" });
    expect(within(detail()).getByText("A replay of what the automated test sends and gets back. Nothing was sent from your browser.")).toBeInTheDocument();
    expect(await within(replay).findByText("412")).toBeInTheDocument();
    expect(within(detail()).getByText(/"type": "\/problems\/version-mismatch"/)).toBeInTheDocument();
    expect(requests).toEqual([]);
  });

  test("the flood warns first, and Don't run sends nothing", async () => {
    const user = await openFlood();
    const requests = countRequests();

    await user.click(within(detail()).getByRole("button", { name: "Run experiment" }));

    expect(within(detail()).getByText("Run it now? Your address will be blocked for up to a minute.")).toBeInTheDocument();
    await user.click(within(detail()).getByRole("button", { name: "Don't run" }));
    expect(within(detail()).queryByText(/Run it now\?/)).not.toBeInTheDocument();
    expect(requests).toEqual([]);
  });

  test("the flood hits the limit early (part of this minute already used): the stamp says so", async () => {
    rateLimitAfter(40);
    const user = await openFlood();

    await user.click(within(detail()).getByRole("button", { name: "Run experiment" }));
    await user.click(within(detail()).getByRole("button", { name: "Yes, flood it" }));

    expect(await within(detail()).findByRole("img", { name: "429 after 40 answers, retry in 38 s" })).toBeInTheDocument();
    expect(within(detail()).getByText("Part of this minute was already used, by this page or by someone sharing your address.")).toBeInTheDocument();
  });

  test("a new minute starts during the flood (the API's count starts over): more than 100 answered, and the page says why", async () => {
    let count = 0;
    fakeApi.use(
      http.get(apiUrl("/v1/users"), () => {
        count++;
        if (count > 100 && count <= 130) {
          const answer = problem(429, "Too many requests", "Rate limit exceeded; retry after 1 seconds");
          answer.headers.set("Retry-After", "1");
          return answer;
        }
        return problem(401, "Not signed in", "A valid admin token is required"); // 131 on: the new minute
      }),
    );
    const user = await openFlood();

    await user.click(within(detail()).getByRole("button", { name: "Run experiment" }));
    await user.click(within(detail()).getByRole("button", { name: "Yes, flood it" }));

    expect(await within(detail()).findByRole("img", { name: "429 after 120 answers, retry in 1 s" })).toBeInTheDocument();
    expect(within(detail()).getByText("A new minute started during the flood, so the API's count started over.")).toBeInTheDocument();
  });

  test("the API can't be reached during the flood: says so, stamps nothing, and Run works again", async () => {
    let count = 0;
    fakeApi.use(http.get(apiUrl("/v1/users"), () => (++count > 10 ? HttpResponse.error() : problem(401, "Not signed in", "A valid admin token is required"))));
    const user = await openFlood();

    await user.click(within(detail()).getByRole("button", { name: "Run experiment" }));
    await user.click(within(detail()).getByRole("button", { name: "Yes, flood it" }));

    expect(await within(detail()).findByRole("alert")).toHaveTextContent(/can't reach the API/i);
    expect(within(detail()).queryByRole("img")).not.toBeInTheDocument();
    expect(within(detail()).getByRole("button", { name: "Run experiment" })).toBeEnabled();
  });

  test("switching tabs keeps unsaved edits on the Users tab", async () => {
    const store = fakeUserStore(threeUsers());
    fakeApi.use(...store.handlers);
    const user = await openWithToken();
    await user.click(button("Lee"));
    const firstName = await within(screen.getByRole("region", { name: "Opened user" })).findByLabelText("First name");
    await user.type(firstName, "x");

    await user.click(button("Experiments"));
    expect(screen.queryByRole("region", { name: "Opened user" })).not.toBeInTheDocument();
    await user.click(button("Users"));

    expect(within(screen.getByRole("region", { name: "Opened user" })).getByLabelText("First name")).toHaveValue("Carterx");
  });
});

describe("experiments: the normal case", () => {
  test("the tab lists all 7 with the live flood first and selected, and a stamp on each of the other 6", async () => {
    const user = startApp();

    await user.click(button("Experiments"));

    const items = within(list()).getAllByRole("listitem");
    expect(items.map((item) => within(item).getByRole("button").textContent)).toEqual([
      expect.stringContaining("Flood the API"),
      expect.stringContaining("No token at all"),
      expect.stringContaining("Forge a token"),
      expect.stringContaining("Save a stale copy"),
      expect.stringContaining("Same email twice"),
      expect.stringContaining("Nonsense input"),
      expect.stringContaining("SQL in the search box"),
    ]);
    expect(within(items[0]).getByText("runs live")).toBeInTheDocument();
    expect(within(detail()).getByRole("heading", { name: "Flood the API" })).toBeInTheDocument();
    expect(items.slice(1).map((item) => within(item).getByRole("img").getAttribute("aria-label"))).toEqual([
      "401, proven by tests",
      "401, proven by tests",
      "412, proven by tests",
      "409, proven by tests",
      "400, proven by tests",
      "200, proven by tests",
    ]);
  });

  test("the flood: 150 at once without a token, 100 answered and 50 refused with 429, stamped as predicted", async () => {
    const seen = rateLimitAfter(100);
    const user = await openFlood();
    expect(within(detail()).getByText("Not run yet")).toBeInTheDocument();

    await user.click(within(detail()).getByRole("button", { name: "Run experiment" }));
    await user.click(within(detail()).getByRole("button", { name: "Yes, flood it" }));

    expect(await within(detail()).findByRole("img", { name: "429 as predicted, retry in 38 s" })).toBeInTheDocument();
    expect(within(detail()).getByText("100 answered, 50 refused with 429.")).toBeInTheDocument();
    expect(seen).toHaveLength(150); // all sent at once
    expect(seen.every(({ authorization }) => authorization === null)).toBe(true); // counted before the token is checked
    expect(within(list()).getAllByRole("listitem")[0]).toHaveTextContent("429");
  });
});
