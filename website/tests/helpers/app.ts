import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { vi } from "vitest";
import { App } from "../../src/App.tsx";

// Opens the app and clicks Get demo token, the way a visitor starts. Waits for the list.
export async function openWithToken() {
  const user = startApp();
  await user.click(screen.getByRole("button", { name: "Get demo token" }));
  await screen.findByRole("table");
  return user;
}

export function startApp() {
  // With fake timers on, clicks must move the fake clock too. Otherwise leave the option out entirely:
  // passing advanceTimers: undefined replaces user-event's default and breaks every click.
  const user = userEvent.setup(vi.isFakeTimers() ? { advanceTimers: vi.advanceTimersByTime } : {});
  render(createElement(App));
  return user;
}
