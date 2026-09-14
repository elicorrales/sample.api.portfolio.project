import { useEffect, useState } from "react";
import { call, isTokenRefused, messageOf } from "../api/call.ts";
import { api } from "../api/client.ts";
import type { components } from "../api/schema.ts";
import { bearer } from "../api/token.ts";

type UserBasic = components["schemas"]["UserBasic"];
type UserDetailed = components["schemas"]["UserDetailed"];

// Each answer remembers which user it belongs to, so a late answer for someone else is never shown.
type DetailsState = { userId: string } & ({ status: "failed"; message: string } | { status: "loaded"; user: UserDetailed });

type Props = { token: string; onTokenRefused: (token: string) => void; summary: UserBasic | null };

export function OpenedUser({ token, onTokenRefused, summary }: Props) {
  const [details, setDetails] = useState<DetailsState | null>(null);

  useEffect(() => {
    if (!summary) return;
    // Opening another user before this answer arrives marks this one as replaced.
    let replaced = false;
    loadDetails(token, summary.id).then(
      (user) => !replaced && setDetails({ userId: summary.id, status: "loaded", user }),
      (error) => {
        if (replaced) return;
        if (isTokenRefused(error)) onTokenRefused(token);
        setDetails({ userId: summary.id, status: "failed", message: messageOf(error) });
      },
    );
    return () => {
      replaced = true;
    };
  }, [token, onTokenRefused, summary]);

  if (!summary) return <p className="blank-page">The user you open from the list will appear on this page.</p>;

  // Until this user's own answer arrives, show what the list already knows.
  const current = details?.userId === summary.id ? details : null;
  const user = current?.status === "loaded" ? current.user : null;

  return (
    <article className="opened">
      <h2>
        {summary.firstName} {summary.lastName}
      </h2>
      {user ? (
        <p className="sub">
          version {user.version}, updated {shortTime(user.updatedAt)}
        </p>
      ) : null}

      <dl className="fill">
        <dt>Email</dt>
        <dd>{user?.email ?? summary.email}</dd>
        {user ? (
          <>
            <dt>Date of birth</dt>
            <dd>{user.dateOfBirth}</dd>
          </>
        ) : null}
      </dl>

      {!current ? <p className="waiting">Loading details…</p> : null}
      {current?.status === "failed" ? (
        <p role="alert" className="problem">{current.message}</p>
      ) : null}

      {user ? (
        <>
          <h3>Phones</h3>
          <dl className="fill">
            {user.phones.map((phone) => (
              <Line key={phone.type} label={labelOf(phone)} value={phone.number} />
            ))}
          </dl>
          <h3>Addresses</h3>
          <dl className="fill">
            {user.addresses.map((address) => (
              <Line
                key={address.type}
                label={labelOf(address)}
                value={[address.street, address.street2, address.city, `${address.state} ${address.zip}`].filter(Boolean).join(", ")}
              />
            ))}
          </dl>
        </>
      ) : null}
    </article>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

async function loadDetails(token: string, userId: string): Promise<UserDetailed> {
  const user = await call(() =>
    api.GET("/v1/users/{userId}", {
      params: { path: { userId }, query: { view: "detailed" } },
      headers: bearer(token),
    }),
  );
  // The spec allows either view in the answer; we asked for detailed.
  if (!("version" in user)) throw new Error("the API sent the basic view instead of the detailed one");
  return user;
}

// "mobile", primary → "Mobile, primary"
function labelOf({ type, primary }: { type: string; primary: boolean }) {
  const name = type.charAt(0).toUpperCase() + type.slice(1);
  return primary ? `${name}, primary` : name;
}

// 2026-09-13T10:42:00Z → 2026-09-13 10:42 UTC
function shortTime(timestamp: string) {
  return `${timestamp.slice(0, 16).replace("T", " ")} UTC`;
}
