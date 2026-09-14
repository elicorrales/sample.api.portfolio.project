import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { openWithToken, startApp } from "../helpers/app.ts";
import { apiUrl, DEMO_TOKEN, fakeApi, problem } from "../helpers/fake-api.ts";

describe("users list: when things go wrong (token failures are in tests/token)", () => {
  test("list refused: shows the status and the API's own message", async () => {
    fakeApi.use(http.get(apiUrl("/v1/users"), () => problem(500, "Internal error", "Something went wrong")));
    const user = startApp();

    await user.click(screen.getByRole("button", { name: "Get demo token" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("500");
    expect(alert).toHaveTextContent("Something went wrong");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("users list: the normal case", () => {
  test("gets a demo token, then lists the first page with it, 10 users sorted by last name", async () => {
    let authorization: string | null = null;
    let query = "";
    fakeApi.use(
      http.get(apiUrl("/v1/users"), ({ request }) => {
        authorization = request.headers.get("Authorization");
        query = new URL(request.url).search;
        return HttpResponse.json({
          items: [{ id: "0b6f1c2e-1111-4a2b-9c3d-000000000009", firstName: "Nora", lastName: "O'Brien", email: "nora.obrien@example.com" }],
          page: 1,
          pageSize: 10,
          totalItems: 45,
          totalPages: 5,
        });
      }),
    );

    await openWithToken();

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(2); // the header row and Nora
    expect(within(rows[1]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["O'Brien", "Nora", "nora.obrien@example.com"]);
    expect(screen.getByText("45 users, page 1 of 5")).toBeInTheDocument();

    expect(authorization).toBe(`Bearer ${DEMO_TOKEN}`);
    expect(Object.fromEntries(new URLSearchParams(query))).toEqual({ sort: "lastName", page: "1", pageSize: "10" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
