import { useCallback, useEffect, useState } from "react";
import { ApiError, messageOf } from "../api/call.ts";
import { requestDemoToken } from "../api/token.ts";

// The token lives in memory only (decision 13): a reload starts over at "none".
type Stored =
  | { status: "none" }
  | { status: "getting" }
  | { status: "failed"; message: string; retryAt: number | null }
  | { status: "active"; token: string; expiresAt: number }
  | { status: "ended"; why: "expired" | "refused" };

export type DemoToken =
  | { status: "none" | "getting" }
  | { status: "failed"; message: string; retrySeconds: number }
  | { status: "active"; token: string; secondsLeft: number }
  | { status: "ended"; why: "expired" | "refused" };

export function useDemoToken() {
  const [stored, setStored] = useState<Stored>({ status: "none" });
  const [now, setNow] = useState(() => Date.now());

  // A 1-second clock, running only while something counts down.
  const counting = stored.status === "active" || (stored.status === "failed" && stored.retryAt !== null);
  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  const getToken = useCallback(async () => {
    setStored({ status: "getting" });
    try {
      const { token, expiresIn } = await requestDemoToken();
      const at = Date.now();
      setNow(at);
      setStored({ status: "active", token, expiresAt: at + expiresIn * 1000 });
    } catch (error) {
      const at = Date.now();
      setNow(at);
      const retryAfter = error instanceof ApiError ? error.retryAfter : null;
      setStored({ status: "failed", message: messageOf(error), retryAt: retryAfter ? at + retryAfter * 1000 : null });
    }
  }, []);

  // Only the token that was refused ends; a late 401 for an older token can't end a newer one.
  const tokenRefused = useCallback((token: string) => {
    setStored((current) => (current.status === "active" && current.token === token ? { status: "ended", why: "refused" } : current));
  }, []);

  return { demoToken: describe(stored, now), getToken, tokenRefused };
}

function describe(stored: Stored, now: number): DemoToken {
  switch (stored.status) {
    case "active": {
      const secondsLeft = Math.ceil((stored.expiresAt - now) / 1000);
      return secondsLeft > 0 ? { status: "active", token: stored.token, secondsLeft } : { status: "ended", why: "expired" };
    }
    case "failed":
      return { status: "failed", message: stored.message, retrySeconds: stored.retryAt ? Math.max(0, Math.ceil((stored.retryAt - now) / 1000)) : 0 };
    default:
      return stored;
  }
}

// 3599 → "59:59"
export function minutesAndSeconds(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
