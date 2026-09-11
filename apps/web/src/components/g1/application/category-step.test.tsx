// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Category62Fields } from "./category-step";
import { I18nProvider } from "@/lib/i18n";
import type { CategoryApplication, ScoringInputs } from "@/lib/g1/application-store";

function renderOlResult(olSubjectCount: ScoringInputs["olSubjectCount"]) {
  const category: CategoryApplication = {
    id: "cat-1",
    categoryType: "6.2",
    scoringInputs: { olSubjectCount },
    locked: false,
  };
  render(
    <I18nProvider>
      <Category62Fields category={category} onChange={vi.fn()} />
    </I18nProvider>,
  );
}

// The G.C.E. (O/L) result sub-form scores against a different mark table per
// subject count (apps/web/src/lib/g1/scoring.ts OL_CEILINGS), but every table
// has exactly one top ("Distinction") tier: the underlying field is olGradeB
// for the 6 and 8-subject tables and olGradeA for the 10-subject table, while
// the 9-subject table genuinely uses all four grades. Applicants only ever
// see the top tier labelled "D passes" - never "B passes" or "A passes" as a
// top grade - so this defends that label mapping stays correct per table.
describe("Category62Fields O/L grade labels", () => {
  it("labels the top grade 'D passes' for the 8-subject table (olGradeB underneath)", () => {
    renderOlResult(8);
    expect(screen.getByLabelText("D passes")).toBeInTheDocument();
    expect(screen.getByLabelText("S passes")).toBeInTheDocument();
    expect(screen.getByLabelText("C passes")).toBeInTheDocument();
    expect(screen.queryByLabelText("B passes")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("A passes")).not.toBeInTheDocument();
  });

  it("labels the top grade 'D passes' for the 6-subject table (olGradeB underneath)", () => {
    renderOlResult(6);
    expect(screen.getByLabelText("D passes")).toBeInTheDocument();
    expect(screen.queryByLabelText("B passes")).not.toBeInTheDocument();
  });

  it("labels the top grade 'D passes' for the 10-subject table (olGradeA underneath)", () => {
    renderOlResult(10);
    expect(screen.getByLabelText("D passes")).toBeInTheDocument();
    expect(screen.queryByLabelText("A passes")).not.toBeInTheDocument();
  });

  it("keeps literal 'B passes' and 'A passes' labels for the 9-subject table, which uses all four tiers", () => {
    renderOlResult(9);
    expect(screen.getByLabelText("S passes")).toBeInTheDocument();
    expect(screen.getByLabelText("C passes")).toBeInTheDocument();
    expect(screen.getByLabelText("B passes")).toBeInTheDocument();
    expect(screen.getByLabelText("A passes")).toBeInTheDocument();
    expect(screen.queryByLabelText("D passes")).not.toBeInTheDocument();
  });
});
