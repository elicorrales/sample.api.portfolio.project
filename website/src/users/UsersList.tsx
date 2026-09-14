import { useEffect, useState } from "react";
import { call, isTokenRefused, messageOf } from "../api/call.ts";
import { api } from "../api/client.ts";
import type { components } from "../api/schema.ts";
import { bearer } from "../api/token.ts";

type UserBasic = components["schemas"]["UserBasic"];
type UserPage = components["schemas"]["UserPage"];

type Query = { search: string; page: number };
// Each answer remembers the query it belongs to, so a late answer for an older query is never shown.
type Answer = { query: Query } & ({ status: "loaded"; page: UserPage } | { status: "failed"; message: string });

const PAGE_SIZE = 10;
const SEARCH_PAUSE_MS = 300;
const SEARCH_MAX = 100; // the spec's maxLength for search

type Props = {
  token: string;
  onTokenRefused: (token: string) => void;
  openedId: string | null;
  onOpen: (user: UserBasic) => void;
};

export function UsersList({ token, onTokenRefused, openedId, onOpen }: Props) {
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState<Query>({ search: "", page: 1 });
  const [answer, setAnswer] = useState<Answer | null>(null);
  // The last page that loaded: stays on screen, faded, while the next one loads.
  const [shown, setShown] = useState<UserPage | null>(null);

  // Search after a pause in typing. Trimmed, and empty means no search (the API refuses an empty one).
  useEffect(() => {
    const timer = setTimeout(() => {
      const search = typed.trim();
      setQuery((current) => (current.search === search ? current : { search, page: 1 }));
    }, SEARCH_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  useEffect(() => {
    // A newer query (or closing the page) marks this one as replaced.
    let replaced = false;
    loadPage(token, query).then(
      (page) => {
        if (replaced) return;
        setAnswer({ query, status: "loaded", page });
        setShown(page);
      },
      (error) => {
        if (replaced) return;
        if (isTokenRefused(error)) onTokenRefused(token);
        setAnswer({ query, status: "failed", message: messageOf(error) });
      },
    );
    return () => {
      replaced = true;
    };
  }, [token, onTokenRefused, query]);

  const loading = answer?.query !== query;
  const page = loading ? shown : answer.status === "loaded" ? answer.page : null;
  const goTo = (pageNumber: number) => setQuery({ search: query.search, page: pageNumber });

  return (
    <>
      <div className="tools">
        <label className="line-input">
          Search name or email
          <input type="search" value={typed} maxLength={SEARCH_MAX} onChange={(event) => setTyped(event.target.value)} />
        </label>
      </div>

      {!loading && answer.status === "failed" ? (
        <p role="alert" className="problem">{answer.message}</p>
      ) : !page ? (
        <p className="waiting">Loading users…</p>
      ) : !loading && page.items.length === 0 && query.page > 1 ? (
        <div className="past-end">
          <p>{`Page ${query.page} is past the end; there ${page.totalPages === 1 ? "is" : "are"} now ${plural(page.totalPages, "page")}.`}</p>
          <button type="button" className="btn" onClick={() => goTo(Math.max(1, page.totalPages))}>
            {`Go to page ${Math.max(1, page.totalPages)}`}
          </button>
        </div>
      ) : !loading && page.items.length === 0 ? (
        <p className="waiting">{query.search ? `No users match "${query.search}".` : "No users yet."}</p>
      ) : (
        <>
          <table className={loading ? "users loading" : "users"} aria-busy={loading}>
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
            <span>{`${plural(page.totalItems, "user")}, page ${page.page} of ${page.totalPages}`}</span>
            <span>
              <button type="button" className="btn" disabled={loading || query.page <= 1} onClick={() => goTo(query.page - 1)}>
                Previous
              </button>{" "}
              <button type="button" className="btn" disabled={loading || query.page >= page.totalPages} onClick={() => goTo(query.page + 1)}>
                Next
              </button>
            </span>
          </div>
        </>
      )}
    </>
  );
}

function loadPage(token: string, { search, page }: Query): Promise<UserPage> {
  return call(() =>
    api.GET("/v1/users", {
      params: { query: { sort: "lastName", ...(search ? { search } : {}), page, pageSize: PAGE_SIZE } },
      headers: bearer(token),
    }),
  );
}

// 1, "user" → "1 user"; 25, "user" → "25 users"
function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}
