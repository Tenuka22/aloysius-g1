// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, within } from "@testing-library/react";
import { Category64Fields } from "./category-step";
import { I18nProvider } from "@/lib/i18n";
import type { CategoryApplication, ScoringInputs } from "@/lib/g1/application-store";

// Fixed "now" matching apps/web/src/lib/g1/scoring.test.ts, so period
// lengths computed from open-ended dates (no end date entered) are
// deterministic across test runs.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-01T00:00:00.000Z"));
});

afterAll(() => {
  vi.useRealTimers();
});

function renderCategory64(scoringInputs: ScoringInputs) {
  const category: CategoryApplication = { id: "cat-64", categoryType: "6.4", scoringInputs, locked: false };
  const onChange = vi.fn();
  const view = render(
    <I18nProvider>
      <Category64Fields category={category} onChange={onChange} />
    </I18nProvider>,
  );
  return { onChange, ...view };
}

// 7.5.1 Path I used to only accept one open-ended institution-service
// period (implicitly measured through "now"). It now accepts a second,
// independently-dated period (e.g. an earlier station before a transfer)
// that is summed with the first under the shared 10-mark ceiling.
describe("Category64Fields contribution to school education - two service periods", () => {
  it("keeps the second period's fields hidden by default, and checking the toggle enables it", () => {
    const { container, onChange } = renderCategory64({
      contributionPath: "institution",
      contributionSameSchool: true,
      contributionServiceStartDate: "2023-09-01",
    });
    const queries = within(container);
    expect(queries.queryByText("Second period of service")).not.toBeInTheDocument();

    // Base UI's Checkbox renders both a visible `span[role=checkbox]` and a
    // hidden native `input[type=checkbox]` inside the same `<label>`, and
    // both independently resolve as "the labelled element" to
    // testing-library's label-text queries - querying the checkbox by its
    // own id sidesteps that double-match rather than fighting it.
    const toggle = container.querySelector("#contribution-second-period-toggle-cat-64");
    expect(toggle).not.toBeNull();
    fireEvent.click(toggle as Element);

    // The checkbox flips scoringInputs.contributionSecondPeriodEnabled via
    // the same onChange wiring every other field uses; re-rendering with
    // that patch applied (rather than asserting on Base UI's own internal
    // click-to-check behavior, which needs a full pointer-event sequence
    // jsdom's plain `click` doesn't reproduce) is what actually reveals the
    // second period's fields.
    expect(onChange).toHaveBeenCalledWith({ contributionSecondPeriodEnabled: true });
  });

  it("shows the second period's fields once contributionSecondPeriodEnabled is set", () => {
    const { container } = renderCategory64({
      contributionPath: "institution",
      contributionSameSchool: true,
      contributionServiceStartDate: "2023-09-01",
      contributionSecondPeriodEnabled: true,
    });
    expect(within(container).getByText("Second period of service")).toBeInTheDocument();
  });

  it("sums marks from both periods once the second is enabled and dated", () => {
    const { container } = renderCategory64({
      contributionPath: "institution",
      contributionSameSchool: true,
      contributionServiceStartDate: "2024-09-01", // 2 years * 2/yr = 4
      contributionServiceEndDate: "2026-09-01",
      contributionSecondPeriodEnabled: true,
      contributionSecondSameSchool: false,
      contributionSecondServiceStartDate: "2020-09-01", // 2 years * 1.5/yr = 3
      contributionSecondServiceEndDate: "2022-09-01",
    });

    expect(within(container).getByText("7 / 10")).toBeInTheDocument();
  });

  it("caps the combined total at the shared ten-mark ceiling", () => {
    const { container } = renderCategory64({
      contributionPath: "institution",
      contributionSameSchool: true,
      contributionServiceStartDate: "2015-09-01", // 11 years capped at 5*2=10
      contributionSecondPeriodEnabled: true,
      contributionSecondSameSchool: true,
      contributionSecondServiceStartDate: "2005-09-01", // 5 years * 2/yr = 10, but overall capped
      contributionSecondServiceEndDate: "2010-09-01",
    });

    expect(within(container).getByText("10 / 10")).toBeInTheDocument();
  });
});

// The distance-branch live preview used to reuse the "officially classified
// difficult station" dates instead of its own dedicated "first-appointment
// station" dates, so it silently ignored whatever the applicant actually
// entered there and showed a mark total that could never match what
// scoreCategory64 (the authoritative scorer) computes from the real fields.
describe("Category64Fields difficult service - distance branch reads its own dates", () => {
  it("scores the distance branch from its own dedicated start/end dates, not the previous-station ones", () => {
    const { container } = renderCategory64({
      contributionPath: "institution",
      contributionSameSchool: true,
      contributionServiceStartDate: "2023-09-01",
      difficultServiceType: "previous",
      // Previous-station branch left blank...
      difficultServiceDistanceStartDate: "2021-09-01", // ...only the distance branch is dated: 2 years
      difficultServiceDistanceEndDate: "2023-09-01",
      difficultServiceDistanceKm: 160, // >=150km tier: 3 marks/year
    });

    // 2 years * 3/yr = 6. Before the fix this rendered "0 / 25" because the
    // live preview looked at the (blank) previous-station dates instead.
    expect(within(container).getByText("6 / 25")).toBeInTheDocument();
  });
});

// The shared CalendarDatePicker previously passed `asChild` to Base UI's
// PopoverTrigger, a prop that component doesn't support (Base UI uses a
// `render` prop instead). Because it went unrecognized, PopoverTrigger fell
// back to rendering its own default <button>, nesting the caller's custom
// <button className="w-full" ...> inside it - invalid HTML, and the outer
// button (with no width styling) shrank to content, so the visibly
// bordered date box never actually filled its column despite the `w-full`
// class on it.
describe("Category64Fields date fields - no nested trigger button", () => {
  it("renders the date trigger as a single real button, not nested inside another one", () => {
    const { container } = renderCategory64({});
    // Queried by id, not label text: the FieldLabel also wraps a hint
    // tooltip button, which independently resolves as "the labelled
    // element" to testing-library's label-text queries alongside the real
    // trigger - the id is unambiguous.
    const trigger = container.querySelector("#service-start-cat-64");
    expect(trigger).not.toBeNull();
    if (!trigger) throw new Error("unreachable");
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.className).toContain("w-full");
    // A nested <button> would put this trigger's own popover-trigger button
    // one level below Base UI's default outer button - i.e. its parent
    // element would itself be a <button>.
    expect(trigger.parentElement?.tagName).not.toBe("BUTTON");
  });

  it("hides the clear control when no date is entered", () => {
    const { container } = renderCategory64({});
    expect(within(container).queryByLabelText("Clear date")).not.toBeInTheDocument();
  });

  it("shows a clear control once a date is entered, and clears it on click", () => {
    const { onChange, container } = renderCategory64({ serviceStartDate: "2020-09-01" });
    const clearButtons = within(container).getAllByLabelText("Clear date");
    expect(clearButtons.length).toBeGreaterThan(0);
    fireEvent.click(clearButtons[0]);
    expect(onChange).toHaveBeenCalledWith({ serviceStartDate: undefined });
  });
});
