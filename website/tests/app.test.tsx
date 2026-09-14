import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { App } from "../src/App.tsx";

test("opens on the Users page with the demo notice", () => {
  render(<App />);

  expect(screen.getByRole("heading", { level: 1, name: "Users" })).toBeInTheDocument();
  expect(screen.getByText(/all data is fake and resets every night/i)).toBeInTheDocument();
});
