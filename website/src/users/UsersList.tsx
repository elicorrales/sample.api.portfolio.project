import { useEffect, useState } from "react";
import { call, isTokenRefused, messageOf } from "../api/call.ts";
import { api } from "../api/client.ts";
import type { components } from "../api/schema.ts";
import { bearer } from "../api/token.ts";

type UserBasic = components["schemas"]["UserBasic"];
type UserPage = components["schemas"]["UserPage"];

type ListState =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "loaded"; page: UserPage };

const PAGE_SIZE = 10;

type Props = {
  token: string;
  onTokenRefused: (token: string) => void;
  openedId: string | null;
  onOpen: (user: UserBasic) => void;
};

export function UsersList({ token, onTokenRefused, openedId, onOpen }: Props) {
  const [state, setState] = useState<ListState>({ status: "loading" });

  useEffect(() => {
    // Ignore a late answer if the page was closed meanwhile.
    let closed = false;
    loadFirstPage(token).then(
      (page) => !closed && setState({ status: "loaded", page }),
      (error) => {
        if (closed) return;
        if (isTokenRefused(error)) onTokenRefused(token);
        setState({ status: "failed", message: messageOf(error) });
      },
    );
    return () => {
      closed = true;
    };
  }, [token, onTokenRefused]);

  if (state.status === "loading") return <p className="waiting">Loading users…</p>;
  if (state.status === "failed") return <p role="alert" className="problem">{state.message}</p>;

  const { page } = state;
  return (
    <>
      <table className="users">
        <thead>
          <tr>
            <th>Last name, sorted</th>
            <th>First name</th>
            <th>Email</th>
          </tr>
        </thead>
        <tbody>
          {page.items.map((user) => (
            // The whole row opens the user; the last name is a button so the keyboard can too.
            <tr key={user.id} aria-current={user.id === openedId ? "true" : undefined} onClick={() => onOpen(user)}>
              <td>
                <button type="button" className="row-open">{user.lastName}</button>
              </td>
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

function loadFirstPage(token: string): Promise<UserPage> {
  return call(() =>
    api.GET("/v1/users", {
      params: { query: { sort: "lastName", page: 1, pageSize: PAGE_SIZE } },
      headers: bearer(token),
    }),
  );
}
