import type { DemoToken } from "./useDemoToken.ts";

type NoToken = Exclude<DemoToken, { status: "active" }>;

// Left page, in place of the list: why there's no list, and the way to get one.
export function NoTokenPage({ demoToken, onGetToken }: { demoToken: NoToken; onGetToken: () => void }) {
  if (demoToken.status === "ended") {
    return (
      <div className="gate">
        {demoToken.why === "expired" ? (
          <>
            <h2>Your demo token expired.</h2>
            <p>Tokens last 1 hour; after that the API refuses them.</p>
          </>
        ) : (
          <>
            <h2>The API stopped accepting your token.</h2>
            <p>It answered 401, so every call would be refused.</p>
          </>
        )}
        <button type="button" className="btn solid" onClick={onGetToken}>
          Get a new token
        </button>
      </div>
    );
  }

  const failed = demoToken.status === "failed" ? demoToken : null;
  const waiting = failed !== null && failed.retrySeconds > 0;
  return (
    <div className="gate">
      <h2>No token, no list.</h2>
      <p>Every call to this API needs an admin token. This demo hands out one that lasts 1 hour.</p>
      {failed ? (
        <p role="alert" className="problem">{failed.message}</p>
      ) : null}
      {waiting && failed ? <p className="waiting">{`Too many requests from your address. Try again in ${failed.retrySeconds} s.`}</p> : null}
      <button type="button" className="btn solid" onClick={onGetToken} disabled={demoToken.status === "getting" || waiting}>
        {demoToken.status === "getting" ? "Getting a token…" : failed ? "Try again" : "Get demo token"}
      </button>
    </div>
  );
}

// Right page while there's no token: what the demo token is.
export function WhatIsADemoToken() {
  return (
    <article className="explain">
      <h2>What's a demo token?</h2>
      <p>
        This API is for admins only. Before it looks at anything else in a request, it checks for an admin token, and
        refuses with <code>401</code> if there isn't a valid one.
      </p>
      <p>
        On a real system you'd get one by signing in. This demo gives anyone a token that works for 1 hour, so you can
        try every operation on fake data.
      </p>
      <p className="proof">
        Proven in the API by <code>tests/security/tokens.test.ts</code>, <code>auth-first.test.ts</code>, and{" "}
        <code>demo-token.test.ts</code>.
      </p>
    </article>
  );
}
