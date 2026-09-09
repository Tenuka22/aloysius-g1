import type { ApplicationDraft } from "./application-store";
import type { CategoryType } from "./application-store";

/**
 * Applicant-facing PDF receipt of a submitted application.
 *
 * jsPDF is imported dynamically: it is ~350 kB and only ever needed on the
 * submitted screen, so it must not sit in the initial bundle that every
 * applicant downloads before they can start typing.
 *
 * jsPDF's built-in fonts are Latin-1 only, so any Sinhala value would render as
 * blank boxes. Rather than embedding a Sinhala font (another ~500 kB), the few
 * fields that can hold Sinhala are painted to a canvas using the fonts the
 * browser already has and embedded as small images. See `drawUnicodeText`.
 */

const PAGE_MARGIN = 14;
const LINE_HEIGHT = 5.4;
const LABEL_WIDTH = 52;

/**
 * English category names for the PDF. Deliberately not read from the i18n
 * catalogue: the receipt is always produced in English so a reviewer can read
 * it regardless of the language the applicant filled the form in, and this
 * module stays usable outside React.
 */
const CATEGORY_LABELS: Record<CategoryType, string> = {
  "6.1": "Residence Verification & Proximity",
  "6.2": "Alumni",
  "6.3": "Siblings",
  "6.4": "Period of Service & Distance",
  "6.5": "Transfer Applications",
  "6.6": "Foreign Employment",
};

/** True when the string contains anything jsPDF's Latin-1 fonts cannot draw. */
function needsUnicodeFallback(value: string): boolean {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Latin-1 range check is the point.
  return /[^\u0000-\u00ff]/.test(value);
}

function slugForFilename(value: string): string {
  const slug = value
    .normalize("NFKD")
    // NFKD splits accents into combining marks; drop the marks so "é" folds to
    // "e" instead of being discarded wholesale by the ASCII filter below.
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug.slice(0, 60);
}

/**
 * Filename the applicant ends up with, e.g. `26DHK083-nadhilage-podi-eka.pdf`.
 * Falls back to the session code alone when the name has no Latin characters
 * (a Sinhala-only name slugs to an empty string).
 */
export function applicationPdfFilename(draft: ApplicationDraft): string {
  const code = slugForFilename(draft.sessionCode || "application").toUpperCase();
  const name = slugForFilename(draft.applicant.fullName);
  return name ? `${code}-${name}.pdf` : `${code}.pdf`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return `${parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ${parsed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function orDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text === "" ? "—" : text;
}

type Row = { label: string; value: string };

type Section = { heading: string; rows: Row[] };

/** Flattens the draft into the printable sections, in the order the form asks for them. */
export function buildApplicationSections(draft: ApplicationDraft): Section[] {
  const location = draft.location;
  const coordinates =
    Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
      ? `${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}`
      : "—";

  const sections: Section[] = [
    {
      heading: "Application",
      rows: [
        { label: "Session code", value: orDash(draft.sessionCode) },
        { label: "Access key", value: orDash(draft.accessKey) },
        { label: "Submitted", value: formatDateTime(draft.submittedAt) },
        { label: "Status", value: orDash(draft.admissionStatus) },
      ],
    },
    {
      heading: "Child",
      rows: [
        { label: "Full name (English)", value: orDash(draft.applicant.fullName) },
        { label: "Full name (Sinhala)", value: orDash(draft.applicant.sinhalaName) },
        { label: "Date of birth", value: formatDate(draft.applicant.dateOfBirth) },
        { label: "Gender", value: orDash(draft.applicant.gender) },
        { label: "Religion", value: orDash(draft.applicant.religion) },
        { label: "Education medium", value: orDash(draft.applicant.educationMedium) },
        { label: "Birth certificate no.", value: orDash(draft.applicant.birthCertificateNumber) },
      ],
    },
    {
      heading: "Parent or guardian",
      rows: [
        { label: "Relationship", value: orDash(draft.guardian.relationship) },
        { label: "Full name", value: orDash(draft.guardian.fullName) },
        { label: "Full name (Sinhala)", value: orDash(draft.guardian.sinhalaName) },
        { label: "NIC", value: orDash(draft.guardian.nic) },
        { label: "Phone", value: orDash(draft.guardian.phone) },
        { label: "WhatsApp", value: orDash(draft.guardian.whatsappPhone) },
        { label: "Email", value: orDash(draft.guardian.email) },
      ],
    },
    {
      heading: "Residence",
      rows: [
        { label: "Permanent address", value: orDash(draft.residence.permanentAddress) },
        {
          label: "Current address",
          value: draft.residence.sameAsPermanent
            ? "Same as permanent"
            : orDash(draft.residence.currentAddress),
        },
        { label: "District", value: orDash(draft.residence.district) },
        { label: "DS division", value: orDash(draft.residence.dsDivision) },
        { label: "GN division", value: orDash(draft.residence.gnDivision) },
        { label: "Electoral district", value: orDash(draft.residence.electoralDistrict) },
        { label: "Home coordinates", value: coordinates },
        { label: "Location label", value: orDash(location.address || location.label) },
      ],
    },
  ];

  for (const category of draft.categories) {
    const inputs = Object.entries(category.scoringInputs)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => ({
        label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
        value: Array.isArray(value) ? `${value.length} selected` : orDash(value as string | number),
      }));

    sections.push({
      heading:
        `Category ${category.categoryType} — ${CATEGORY_LABELS[category.categoryType] ?? ""}`.trim(),
      rows: inputs.length > 0 ? inputs : [{ label: "Details", value: "No details recorded" }],
    });
  }

  sections.push({
    heading: "Declaration",
    rows: [
      { label: "Accuracy confirmed", value: draft.declaration.confirmed ? "Yes" : "No" },
      { label: "Consent given", value: draft.declaration.consent ? "Yes" : "No" },
    ],
  });

  return sections;
}

/**
 * Paints a non-Latin string with the browser's own fonts and returns it as a
 * PNG data URL sized for the PDF. Returns null when there is no DOM (SSR) or
 * the canvas is unavailable, so callers can fall back to plain text.
 */
function renderUnicodeToImage(
  text: string,
  fontSizePt: number,
): { dataUrl: string; widthMm: number; heightMm: number } | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;

  // Render at 4x then scale down in the PDF so the glyphs stay crisp in print.
  const scale = 4;
  const fontPx = fontSizePt * 1.333 * scale;
  const fontStack = `${fontPx}px "Noto Sans Sinhala", "Iskoola Pota", system-ui, sans-serif`;
  context.font = fontStack;
  const metrics = context.measureText(text);
  const widthPx = Math.ceil(metrics.width) + scale * 2;
  const heightPx = Math.ceil(fontPx * 1.45);
  canvas.width = Math.max(widthPx, 1);
  canvas.height = heightPx;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = fontStack;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#111111";
  ctx.fillText(text, 0, heightPx / 2);

  const mmPerPx = 0.2646 / scale;
  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthMm: canvas.width * mmPerPx,
    heightMm: canvas.height * mmPerPx,
  };
}

/**
 * Builds the PDF and returns it as a Blob.
 *
 * Kept separate from the download so the caller can own the download state
 * machine and so this is testable without touching the DOM's download path.
 */
export async function buildApplicationPdf(draft: ApplicationDraft): Promise<Blob> {
  // Dynamic import is required, not stylistic: jsPDF is ~350 kB and is only
  // reachable from the submitted screen, so a static import would put it in
  // the bundle every applicant loads before the first step renders.
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN;

  const newPageIfNeeded = (needed: number) => {
    if (y + needed <= pageHeight - PAGE_MARGIN) return;
    doc.addPage();
    y = PAGE_MARGIN;
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("St. Aloysius' College, Galle", PAGE_MARGIN, y + 4);
  y += 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Grade 1 Admission — 2026 Intake — Applicant copy", PAGE_MARGIN, y + 3);
  y += 7;
  doc.setDrawColor(190);
  doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
  y += 6;

  for (const section of buildApplicationSections(draft)) {
    newPageIfNeeded(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(section.heading, PAGE_MARGIN, y);
    y += LINE_HEIGHT + 1;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);

    for (const row of section.rows) {
      const valueX = PAGE_MARGIN + LABEL_WIDTH;
      const valueWidth = contentWidth - LABEL_WIDTH;

      if (needsUnicodeFallback(row.value)) {
        const image = renderUnicodeToImage(row.value, 9.5);
        const height = image ? Math.max(image.heightMm, LINE_HEIGHT) : LINE_HEIGHT;
        newPageIfNeeded(height + 1);
        doc.setTextColor(110);
        doc.text(row.label, PAGE_MARGIN, y);
        doc.setTextColor(17);
        if (image) {
          doc.addImage(
            image.dataUrl,
            "PNG",
            valueX,
            y - height * 0.72,
            Math.min(image.widthMm, valueWidth),
            height,
          );
        } else {
          doc.text(row.value, valueX, y, { maxWidth: valueWidth });
        }
        y += height + 1;
        continue;
      }

      const lines = doc.splitTextToSize(row.value, valueWidth) as string[];
      const blockHeight = Math.max(lines.length, 1) * LINE_HEIGHT;
      newPageIfNeeded(blockHeight);
      doc.setTextColor(110);
      doc.text(row.label, PAGE_MARGIN, y);
      doc.setTextColor(17);
      doc.text(lines, valueX, y);
      y += blockHeight;
    }

    y += 3;
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(
      `Generated ${formatDateTime(new Date().toISOString())} · Session ${draft.sessionCode || "—"} · Page ${page} of ${pageCount}`,
      PAGE_MARGIN,
      pageHeight - 8,
    );
  }

  return doc.output("blob");
}

/** Builds the PDF and triggers a browser download under the applicant's filename. */
export async function downloadApplicationPdf(draft: ApplicationDraft): Promise<string> {
  const blob = await buildApplicationPdf(draft);
  const filename = applicationPdfFilename(draft);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick: revoking synchronously can cancel the download in
  // some browsers before it has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return filename;
}
