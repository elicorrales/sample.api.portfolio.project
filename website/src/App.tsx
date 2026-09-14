import { useState } from "react";
import { API_URL } from "./api/client.ts";
import type { components } from "./api/schema.ts";
import { NoTokenPage, WhatIsADemoToken } from "./token/NoTokenPages.tsx";
import { minutesAndSeconds, useDemoToken, type DemoToken } from "./token/useDemoToken.ts";
import { OpenedUser } from "./users/OpenedUser.tsx";
import { UsersList } from "./users/UsersList.tsx";

type UserBasic = components["schemas"]["UserBasic"];

export function App() {
  const { demoToken, getToken, tokenRefused } = useDemoToken();
  const [opened, setOpened] = useState<UserBasic | null>(null);

  // A new token starts with nothing open: what was open may have changed meanwhile.
  function startWithNewToken() {
    setOpened(null);
    void getToken();
  }

  return (
    <div className="spread">
      <section className="page page-left" aria-label="Users list">
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
          <UsersList token={demoToken.token} onTokenRefused={tokenRefused} openedId={opened?.id ?? null} onOpen={setOpened} />
        ) : (
          <NoTokenPage demoToken={demoToken} onGetToken={startWithNewToken} />
        )}
      </section>
      <section className="page page-right" aria-label="Opened user">
        {demoToken.status === "active" ? (
          <OpenedUser token={demoToken.token} onTokenRefused={tokenRefused} summary={opened} />
        ) : (
          <WhatIsADemoToken />
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
