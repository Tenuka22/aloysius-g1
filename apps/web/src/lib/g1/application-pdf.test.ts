// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { applicationPdfFilename, buildApplicationSections, buildMarkLines } from "./application-pdf";
import { emptyDraft } from "./application-store";

const draft = {
  ...emptyDraft,
  sessionCode: "26DHK083",
  accessKey: "ALY-Ya_WHDz5MZNR9mUudXDcgkvTK9MMuliUEfoXgvVc_Xg",
  submittedAt: "2026-09-09T10:15:00.000Z",
  applicant: {
    ...emptyDraft.applicant,
    fullName: "Nadhilage Podi Eka",
    sinhalaName: "නදිලගේ පොඩි එකා",
    dateOfBirth: "2021-06-01",
    birthCertificateNumber: "BC/4471",
  },
};

describe("applicationPdfFilename", () => {
  it("names the file after the session code and the child", () => {
    expect(applicationPdfFilename(draft)).toBe("26DHK083-nadhilage-podi-eka.pdf");
  });

  it("falls back to the session code when the name has no Latin characters", () => {
    const sinhalaOnly = {
      ...draft,
      applicant: { ...draft.applicant, fullName: "නදිලගේ පොඩි එකා" },
    };
    expect(applicationPdfFilename(sinhalaOnly)).toBe("26DHK083.pdf");
  });

  it("never emits path separators or spaces that would break the download", () => {
    const messy = {
      ...draft,
      sessionCode: "26/DHK 083",
      applicant: { ...draft.applicant, fullName: "A/B  C\\D" },
    };
    const filename = applicationPdfFilename(messy);
    expect(filename).not.toMatch(/[/\\\s]/);
    expect(filename.endsWith(".pdf")).toBe(true);
  });
});

describe("buildApplicationSections", () => {
  it("captures the identifying details the interview panel needs", () => {
    const sections = buildApplicationSections(draft);
    const rows = sections.flatMap((section) => section.rows);
    const value = (label: string) => rows.find((row) => row.label === label)?.value;

    expect(value("Session code")).toBe("26DHK083");
    expect(value("Full name (English)")).toBe("Nadhilage Podi Eka");
    expect(value("Full name (Sinhala)")).toBe("නදිලගේ පොඩි එකා");
    expect(value("Birth certificate no.")).toBe("BC/4471");
    expect(value("Date of birth")).toBe("01 Jun 2021");
  });

  it("renders a dash for missing values rather than an empty cell", () => {
    const sections = buildApplicationSections(emptyDraft);
    const rows = sections.flatMap((section) => section.rows);
    const blank = rows.filter((row) => row.value === "");

    expect(blank).toHaveLength(0);
    expect(rows.some((row) => row.value === "-")).toBe(true);
  });

  it("includes a section per selected marking category", () => {
    const withCategories = {
      ...draft,
      categories: [
        { id: "a", categoryType: "6.1" as const, scoringInputs: { olGradeA: 3 }, locked: false },
        { id: "b", categoryType: "6.3" as const, scoringInputs: {}, locked: false },
      ],
    };
    const headings = buildApplicationSections(withCategories).map((s) => s.heading);

    expect(headings).toContain("Category 6.1 - Residence Verification & Proximity");
    expect(headings).toContain("Category 6.3 - Siblings");
  });

  it("always ends with the declaration so the record is self-contained", () => {
    const sections = buildApplicationSections(draft);
    expect(sections[sections.length - 1]?.heading).toBe("Declaration");
  });
});

describe("buildMarkLines", () => {
  it("prints every category's max as the true 100-mark ceiling, not the sum of its breakdown rows' own maxes", () => {
    // Category 6.2's breakdown rows sum to 102 (26+3+10+12+10+5+5+5+13+5+2+2+4)
    // even though the category itself is capped at 100 - regression test for
    // a PDF-only bug where the printed "Max" column used that row-sum
    // instead of the true ceiling every other on-screen display uses.
    const withCategory62 = {
      ...draft,
      categories: [{ id: "a", categoryType: "6.2" as const, scoringInputs: {}, locked: false }],
    };
    const lines = buildMarkLines(withCategory62);
    const categoryLine = lines.find((line) => line.kind === "category");
    expect(categoryLine?.max).toBe(100);
  });
});
