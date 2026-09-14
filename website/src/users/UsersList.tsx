import { useEffect, useState } from "react";
import { api } from "../api/client.ts";
import type { components } from "../api/schema.ts";

type UserPage = components["schemas"]["UserPage"];

type ListState =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "loaded"; page: UserPage };

const PAGE_SIZE = 10;

export function UsersList() {
  const [state, setState] = useState<ListState>({ status: "loading" });

  useEffect(() => {
    // Ignore a late answer if the page was closed meanwhile.
    let closed = false;
    loadFirstPage().then((next) => {
      if (!closed) setState(next);
    });
    return () => {
      closed = true;
    };
  }, []);

  if (state.status === "loading") return <p className="waiting">Loading users…</p>;
  if (state.status === "failed") return <p role="alert" className="problem">{state.message}</p>;

  const { page } = state;
  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Last name, sorted</th>
            <th>First name</th>
            <th>Email</th>
          </tr>
        </thead>
        <tbody>
          {page.items.map((user) => (
            <tr key={user.id}>
              <td>{user.lastName}</td>
              <td>{user.firstName}</td>
              <td className="data">{user.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pager">
        <span>{`${page.totalItems} users, page ${page.page} of ${page.totalPages}`}</span>
      </div>
    </>
  );
}

async function loadFirstPage(): Promise<ListState> {
  try {
    // Demo token: kept in memory only, so a reload gets a fresh one.
    const token = await api.POST("/demo/token");
    if (!token.data) return refused(token.response.status, token.error);

    const list = await api.GET("/v1/users", {
      params: { query: { sort: "lastName", page: 1, pageSize: PAGE_SIZE } },
      headers: { Authorization: `Bearer ${token.data.token}` },
    });
    if (!list.data) return refused(list.response.status, list.error);

    return { status: "loaded", page: list.data };
  } catch {
    // fetch throws only when no answer came back at all.
    return { status: "failed", message: "Can't reach the API. Check your connection, or try again in a minute." };
  }
}

// Shows the API's own words. A proxy error page (not Problem Details) gets just the status.
function refused(status: number, body: unknown): ListState {
  const detail = typeof body === "object" && body !== null && "detail" in body ? String(body.detail) : "";
  return { status: "failed", message: `The API answered ${status}${detail ? `: ${detail}` : "."}` };
}
