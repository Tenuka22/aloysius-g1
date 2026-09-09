// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorState } from "./error-state";

/**
 * `ErrorState` is the app's only error boundary UI (wired as `errorComponent`
 * on the root route and on `/`). Before it existed, any uncaught loader or
 * render throw produced a blank white document, so these assertions defend the
 * difference between "an explained failure" and "nothing at all".
 */
describe("ErrorState", () => {
  it("renders a titled, actionable failure instead of an empty page", () => {
    render(<ErrorState />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to dashboard" })).toBeInTheDocument();
  });

  it("calls the router-supplied reset instead of reloading when one is given", async () => {
    const reset = vi.fn();
    render(<ErrorState reset={reset} />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("keeps the technical message available but collapsed by default", () => {
    render(<ErrorState error={new Error("boom: upstream refused")} />);

    // Present in the DOM for support, but inside a closed <details>.
    const details = screen.getByText("Technical details").closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByText("boom: upstream refused")).toBeInTheDocument();
  });

  it("shows no details block when the thrown value is not an Error", () => {
    render(<ErrorState error={"just a string"} />);

    expect(screen.queryByText("Technical details")).not.toBeInTheDocument();
  });
});
