import { useCallback, useState } from "react";
import { API_URL } from "./api/client.ts";
import type { components } from "./api/schema.ts";
import { ExperimentsTab } from "./experiments/ExperimentsTab.tsx";
import { NoTokenPage, WhatIsADemoToken } from "./token/NoTokenPages.tsx";
import { minutesAndSeconds, useDemoToken, type DemoToken } from "./token/useDemoToken.ts";
import { OpenedUser } from "./users/OpenedUser.tsx";
import { UsersList } from "./users/UsersList.tsx";

type UserBasic = components["schemas"]["UserBasic"];
type Opened = { kind: "new" } | { kind: "user"; summary: UserBasic } | null;

export function App() {
  const { demoToken, getToken, tokenRefused } = useDemoToken();
  const [opened, setOpened] = useState<Opened>(null);
  const [dirty, setDirty] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [listReload, setListReload] = useState(0);
  // Both tabs stay on the page (one hidden), so unsaved edits and a running flood survive switching.
  const [tab, setTab] = useState<"users" | "experiments">("users");

  const dirtyChanged = useCallback((isDirty: boolean) => {
    setDirty(isDirty);
    if (!isDirty) setBlocked(false);
  }, []);

  // Unsaved changes on the right page block opening something else (decision 13).
  function open(next: Opened) {
    if (dirty) return setBlocked(true);
    setOpened(next);
  }

  // A new token starts with nothing open: what was open may have changed meanwhile.
  function startWithNewToken() {
    setOpened(null);
    void getToken();
  }

  return (
    <div className="spread">
      <nav className="dividers" aria-label="Tabs">
        <button type="button" aria-current={tab === "users" ? "page" : undefined} onClick={() => setTab("users")}>Users</button>
        <button type="button" aria-current={tab === "experiments" ? "page" : undefined} onClick={() => setTab("experiments")}>Experiments</button>
      </nav>
      <ExperimentsTab hidden={tab !== "experiments"} />
      <section className="page page-left" aria-label="Users list" hidden={tab !== "users"}>
        <header className="head">
          <h1>Users</h1>
          <div className="who">
            <span>{cornerText(demoToken)}</span>
            <br />
            {new URL(API_URL).host}
          </div>
        </header>
        <p className="note">Demo only: all data is fake and resets every night at 08:00 UTC.</p>
        {demoToken.status === "active" ? (
          <UsersList
            token={demoToken.token}
            onTokenRefused={tokenRefused}
            openedId={opened?.kind === "user" ? opened.summary.id : null}
            onOpen={(summary) => open({ kind: "user", summary })}
            onNew={() => open({ kind: "new" })}
            reloadKey={listReload}
          />
        ) : (
          <NoTokenPage demoToken={demoToken} onGetToken={startWithNewToken} />
        )}
      </section>
      <section className="page page-right" aria-label="Opened user" hidden={tab !== "users"}>
        {demoToken.status !== "active" ? (
          <WhatIsADemoToken />
        ) : opened ? (
          <OpenedUser
            key={opened.kind === "user" ? opened.summary.id : "new"}
            token={demoToken.token}
            onTokenRefused={tokenRefused}
            summary={opened.kind === "user" ? opened.summary : null}
            blocked={blocked}
            onDirtyChange={dirtyChanged}
            onSaved={(user, created) => {
              setListReload((count) => count + 1);
              // A new user opens as a saved user; the form's unsaved-changes flag goes with the old copy.
              if (created && user) setOpened({ kind: "user", summary: user });
            }}
            onClose={() => setOpened(null)}
          />
        ) : (
          <p className="blank-page">The user you open from the list will appear on this page.</p>
        )}
      </section>
    </div>
  );
}

function cornerText(demoToken: DemoToken) {
  if (demoToken.status === "active") return `demo token, ${minutesAndSeconds(demoToken.secondsLeft)} left`;
  if (demoToken.status === "ended") return demoToken.why === "expired" ? "demo token expired" : "demo token refused";
  return "no token";
}
