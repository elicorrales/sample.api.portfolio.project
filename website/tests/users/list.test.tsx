import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { App } from "../../src/App.tsx";
import { apiUrl, DEMO_TOKEN, fakeApi, problem } from "../helpers/fake-api.ts";

describe("users list: when things go wrong", () => {
  test("API can't be reached: says so, and shows no table", async () => {
    fakeApi.use(http.post(apiUrl("/demo/token"), () => HttpResponse.error()));

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/can't reach the API/i);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("no demo token (the server isn't in demo mode): shows the status and the API's own message", async () => {
    fakeApi.use(http.post(apiUrl("/demo/token"), () => problem(401, "Not signed in", "A valid admin token is required")));

    render(<App />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("401");
    expect(alert).toHaveTextContent("A valid admin token is required");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("list refused: shows the status and the API's own message", async () => {
    fakeApi.use(http.get(apiUrl("/v1/users"), () => problem(500, "Internal error", "Something went wrong")));

    render(<App />);

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

    render(<App />);

    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(2); // the header row and Nora
    expect(within(rows[1]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["O'Brien", "Nora", "nora.obrien@example.com"]);
    expect(screen.getByText("45 users, page 1 of 5")).toBeInTheDocument();

    expect(authorization).toBe(`Bearer ${DEMO_TOKEN}`);
    expect(Object.fromEntries(new URLSearchParams(query))).toEqual({ sort: "lastName", page: "1", pageSize: "10" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
