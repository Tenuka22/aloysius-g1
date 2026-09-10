import type { ApplicationDraft, CategoryType } from "./application-store";
import { INTAKE_YEAR_DEFAULT } from "@/lib/g1/intake-year";
import { scoreCategory } from "./scoring";

/**
 * Applicant-facing PDF of a submitted application, laid out as the school's
 * marking-scheme verification sheet: crest and name at the head, the applicant's
 * particulars, then a ruled table whose right-hand columns are left blank for
 * the first interview board and the objection/appeal board to complete by hand.
 *
 * jsPDF is imported dynamically: it is ~350 kB and only ever needed on the
 * submitted screen, so it must not sit in the initial bundle that every
 * applicant downloads before they can start typing.
 *
 * jsPDF's built-in fonts are Latin-1 only, so any Sinhala value would render as
 * blank boxes. Rather than embedding a Sinhala font (another ~500 kB), the few
 * fields that can hold Sinhala are painted to a canvas using the fonts the
 * browser already has and embedded as images. See `renderUnicodeToImage`.
 */

const PAGE_MARGIN = 12;
const CREST_URL = "/logo.png";
const CREST_HEIGHT_MM = 20;

/** English category names. The sheet is always produced in English so any
 * reviewer can read it regardless of the language the form was filled in. */
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
  for (const character of value) {
    if ((character.codePointAt(0) ?? 0) > 0xff) return true;
  }
  return false;
}

function slugForFilename(value: string): string {
  return (
    value
      .normalize("NFKD")
      // NFKD splits accents into combining marks; drop the marks so "é" folds to
      // "e" instead of being discarded wholesale by the ASCII filter below.
      .replace(/\p{M}/gu, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60)
  );
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
  return `${formatDate(value)} ${parsed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
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
        { label: "Permanent address (English)", value: orDash(draft.residence.permanentAddressEn) },
        { label: "Permanent address (Sinhala)", value: orDash(draft.residence.permanentAddressSi) },
        {
          label: "Current address (English)",
          value: draft.residence.sameAsPermanent
            ? "Same as permanent"
            : orDash(draft.residence.currentAddressEn),
        },
        {
          label: "Current address (Sinhala)",
          value: draft.residence.sameAsPermanent
            ? "Same as permanent"
            : orDash(draft.residence.currentAddressSi),
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

/** A marking-sheet line: either a category banner or a scored criterion. */
type MarkLine =
  | { kind: "category"; label: string; max: number; declared: number }
  | { kind: "criterion"; label: string; max: number; declared: number };

/**
 * Builds the marking table body.
 *
 * There is deliberately no cross-category total: every category is scored out
 * of 100 on its own, exactly as the printed scheme does, so adding them would
 * hand the board a number ("123 / 200") that means nothing.
 */
export function buildMarkLines(draft: ApplicationDraft): MarkLine[] {
  const lines: MarkLine[] = [];

  for (const category of draft.categories) {
    const score = scoreCategory(category);
    lines.push({
      kind: "category",
      label: `${category.categoryType} — ${CATEGORY_LABELS[category.categoryType] ?? ""}`.trim(),
      max: score.breakdown.reduce((sum, row) => sum + row.max, 0),
      declared: score.total,
    });
    for (const row of score.breakdown) {
      lines.push({ kind: "criterion", label: row.label, max: row.max, declared: row.marks });
    }
  }

  return lines;
}

/**
 * Paints a non-Latin string with the browser's own fonts and returns it as a
 * PNG data URL. Returns null when there is no DOM (SSR) or the canvas is
 * unavailable, so callers can fall back to plain text.
 */
function renderUnicodeToImage(
  text: string,
  fontSizePt: number,
): { dataUrl: string; widthMm: number; heightMm: number } | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d");
  if (!measure) return null;

  // Render at 4x then scale down in the PDF so the glyphs stay crisp in print.
  const scale = 4;
  const fontPx = fontSizePt * 1.333 * scale;
  const fontStack = `${fontPx}px "Noto Sans Sinhala", "Iskoola Pota", system-ui, sans-serif`;
  measure.font = fontStack;
  canvas.width = Math.max(Math.ceil(measure.measureText(text).width) + scale * 2, 1);
  canvas.height = Math.ceil(fontPx * 1.45);

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = fontStack;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#111111";
  ctx.fillText(text, 0, canvas.height / 2);

  const mmPerPx = 0.2646 / scale;
  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthMm: canvas.width * mmPerPx,
    heightMm: canvas.height * mmPerPx,
  };
}

/** Loads the school crest as a data URL. Returns null so the sheet still
 * prints (name only) if the asset is missing or blocked.
 *
 * The source art is 960x1330. Embedding it as-is makes jsPDF store several
 * megabytes of bitmap for a 20 mm shield, so it is redrawn at print size
 * (300 dpi) first — that alone is the difference between a ~5 MB and a ~200 kB
 * sheet. */
async function loadCrest(): Promise<string | null> {
  if (typeof document === "undefined") return null;
  try {
    const response = await fetch(CREST_URL);
    if (!response.ok) return null;
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const targetHeight = Math.round((CREST_HEIGHT_MM / 25.4) * 300);
    const targetWidth = Math.round(targetHeight * (bitmap.width / bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

type Column = { width: number; align?: "left" | "center" | "right" };

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
  const [{ jsPDF }, crest] = await Promise.all([import("jspdf"), loadCrest()]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  const bottomLimit = pageHeight - PAGE_MARGIN - 6;
  let y = PAGE_MARGIN;

  const setBody = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(20);
  };

  /** Draws one bordered table row, wrapping text and growing the row to fit. */
  const drawRow = (
    cells: string[],
    columns: Column[],
    options: { bold?: boolean; fill?: [number, number, number]; minHeight?: number } = {},
  ) => {
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    const padding = 1.4;

    const wrapped = cells.map((cell, index) => {
      const width = (columns[index]?.width ?? 20) - padding * 2;
      if (needsUnicodeFallback(cell)) return [cell];
      return doc.splitTextToSize(cell, width) as string[];
    });
    const lineCount = Math.max(...wrapped.map((lines) => lines.length), 1);
    const height = Math.max(lineCount * 3.6 + padding * 2, options.minHeight ?? 6);

    if (y + height > bottomLimit) {
      doc.addPage();
      y = PAGE_MARGIN;
    }

    let x = PAGE_MARGIN;
    for (const [index, column] of columns.entries()) {
      if (options.fill) {
        doc.setFillColor(...options.fill);
        doc.rect(x, y, column.width, height, "F");
      }
      doc.setDrawColor(70);
      doc.setLineWidth(0.2);
      doc.rect(x, y, column.width, height);

      const lines = wrapped[index] ?? [];
      const raw = cells[index] ?? "";
      const textY = y + padding + 2.6;

      if (needsUnicodeFallback(raw)) {
        const image = renderUnicodeToImage(raw, 8);
        if (image) {
          const drawHeight = Math.min(image.heightMm, height - padding);
          const drawWidth = Math.min(
            image.widthMm * (drawHeight / image.heightMm),
            column.width - padding * 2,
          );
          doc.addImage(
            image.dataUrl,
            "PNG",
            x + padding,
            y + (height - drawHeight) / 2,
            drawWidth,
            drawHeight,
            undefined,
            "FAST",
          );
        }
      } else {
        const align = column.align ?? "left";
        const textX =
          align === "right"
            ? x + column.width - padding
            : align === "center"
              ? x + column.width / 2
              : x + padding;
        doc.text(lines, textX, textY, { align });
      }
      x += column.width;
    }

    y += height;
  };

  // ---------------------------------------------------------------- header
  const crestHeight = CREST_HEIGHT_MM;
  if (crest) {
    // 960x1330 source: keep the aspect ratio so the shield is not squashed.
    doc.addImage(
      crest,
      "PNG",
      PAGE_MARGIN,
      y,
      crestHeight * (960 / 1330),
      crestHeight,
      "crest",
      "FAST",
    );
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(15);
  doc.text("Saint Aloysius' College", pageWidth / 2, y + 8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(70);
  doc.text("Galle, Sri Lanka", pageWidth / 2, y + 13, { align: "center" });
  doc.setFontSize(9.5);
  doc.setTextColor(20);
  doc.text(
    `Grade 1 Admission — ${INTAKE_YEAR_DEFAULT} Intake · Marking scheme verification sheet`,
    pageWidth / 2,
    y + 19,
    { align: "center" },
  );
  y += crestHeight + 6;

  // -------------------------------------------------------- applicant block
  setBody();
  const halfColumns: Column[] = [
    { width: 30 },
    { width: contentWidth / 2 - 30 },
    { width: 32 },
    { width: contentWidth / 2 - 32 },
  ];
  drawRow(
    ["Application no.", orDash(draft.sessionCode), "Date submitted", formatDate(draft.submittedAt)],
    halfColumns,
  );
  drawRow(
    [
      "Child's name",
      orDash(draft.applicant.fullName),
      "Date of birth",
      formatDate(draft.applicant.dateOfBirth),
    ],
    halfColumns,
  );
  drawRow(
    [
      "Name (Sinhala)",
      orDash(draft.applicant.sinhalaName),
      "Birth certificate",
      orDash(draft.applicant.birthCertificateNumber),
    ],
    halfColumns,
  );
  drawRow(
    ["Guardian", orDash(draft.guardian.fullName), "Telephone", orDash(draft.guardian.phone)],
    halfColumns,
  );
  drawRow(
    [
      "Address",
      orDash(draft.residence.permanentAddressEn),
      "GN division",
      orDash(draft.residence.gnDivision),
    ],
    halfColumns,
  );
  y += 5;

  // ------------------------------------------------------------ marks table
  const markColumns: Column[] = [
    { width: contentWidth - 90 },
    { width: 14, align: "center" },
    { width: 19, align: "center" },
    { width: 19, align: "center" },
    { width: 19, align: "center" },
    { width: 19 },
  ];
  const markHeader = [
    "Description",
    "Max",
    "Marks declared by applicant",
    "First interview board",
    "Objection & appeal board",
    "Remarks",
  ];

  doc.setFontSize(7.4);
  drawRow(markHeader, markColumns, { bold: true, fill: [232, 232, 232], minHeight: 13 });
  doc.setFontSize(8);

  const lines = buildMarkLines(draft);
  if (lines.length === 0) {
    drawRow(["No marking categories were selected.", "—", "", "", "", ""], markColumns);
  }
  for (const line of lines) {
    if (line.kind === "category") {
      drawRow([line.label, String(line.max), line.declared.toFixed(2), "", "", ""], markColumns, {
        bold: true,
        fill: [244, 244, 244],
      });
    } else {
      drawRow(
        [`   ${line.label}`, String(line.max), line.declared.toFixed(2), "", "", ""],
        markColumns,
      );
    }
  }

  // ------------------------------------------------------- declaration text
  y += 5;
  if (y + 20 > bottomLimit) {
    doc.addPage();
    y = PAGE_MARGIN;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(45);
  const declaration =
    "I certify that the particulars given above are true and correct. I understand that if any information is found to be false, or if any required document cannot be produced at the interview, the application may be rejected and any place already granted may be withdrawn.";
  doc.text(doc.splitTextToSize(declaration, contentWidth) as string[], PAGE_MARGIN, y);
  y += 12;

  // ----------------------------------------------------------- signatures
  const signatureWidth = contentWidth / 3 - 4;
  const signatures = ["Applicant's signature", "First interview board", "Objection & appeal board"];
  doc.setTextColor(20);
  for (const [index, label] of signatures.entries()) {
    const x = PAGE_MARGIN + index * (signatureWidth + 6);
    doc.setDrawColor(90);
    doc.line(x, y + 8, x + signatureWidth, y + 8);
    doc.setFontSize(7.4);
    doc.text(label, x, y + 12);
  }

  // ------------------------------------------------------ footer per page
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(130);
    doc.text(
      `Generated ${formatDateTime(new Date().toISOString())} · Application ${draft.sessionCode || "—"} · Page ${page} of ${pageCount}`,
      PAGE_MARGIN,
      pageHeight - 6,
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
  // Revoke on a delay: revoking synchronously can cancel the download in some
  // browsers before they have finished reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return filename;
}
