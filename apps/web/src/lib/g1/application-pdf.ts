import type { ApplicationDraft, CategoryType } from "./application-store";
import { INTAKE_YEAR_DEFAULT } from "@/lib/g1/intake-year";
import { CATEGORY_MAX_MARKS, scoreCategory } from "./scoring";

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

export type PdfLocale = "en" | "si";

/** English category names. */
const CATEGORY_LABELS_EN: Record<CategoryType, string> = {
  "6.1": "Residence Verification & Proximity",
  "6.2": "Alumni",
  "6.3": "Siblings",
  "6.4": "Education Sector / Teaching Staff",
  "6.5": "Transfer Applications",
  "6.6": "Foreign Employment",
};

/** Sinhala category names, matching the same wording used on the category
 * tabs in the application form itself (see i18n/si.ts `category.tabLabels`). */
const CATEGORY_LABELS_SI: Record<CategoryType, string> = {
  "6.1": "පදිංචිය සහ ආසන්නතාවය",
  "6.2": "ආදි ශිෂ්‍ය",
  "6.3": "සහෝදර/සහෝදරියන්",
  "6.4": "අධ්‍යාපන අංශය",
  "6.5": "ස්ථාන මාරුවීම්",
  "6.6": "විදේශ රැකියා",
};

const CATEGORY_LABELS_BY_LOCALE: Record<PdfLocale, Record<CategoryType, string>> = {
  en: CATEGORY_LABELS_EN,
  si: CATEGORY_LABELS_SI,
};

/**
 * Every static (non-data) string the sheet prints, in both languages. Sinhala
 * strings are drawn through the same `renderUnicodeToImage` path already
 * used for Sinhala data values (see the file header) - jsPDF's own fonts
 * cannot render them directly, but the row-drawing code already detects and
 * rasterises any non-Latin-1 string automatically, so nothing else about the
 * drawing logic needs to change to support a second language.
 */
const PDF_TEXT: Record<
  PdfLocale,
  {
    collegeName: string;
    collegeLocation: string;
    sheetTitle: (year: string) => string;
    applicationNo: string;
    dateSubmitted: string;
    childName: string;
    dateOfBirth: string;
    nameSinhala: string;
    birthCertificate: string;
    guardian: string;
    telephone: string;
    address: string;
    gnDivision: string;
    markHeader: [string, string, string, string, string, string];
    noCategoriesSelected: string;
    declaration: string;
    signatures: [string, string, string];
    homeLocationCaption: string;
    generatedFooter: (dateTime: string, code: string, page: number, pageCount: number) => string;
  }
> = {
  en: {
    collegeName: "Saint Aloysius' College",
    collegeLocation: "Galle, Sri Lanka",
    sheetTitle: (year) => `Grade 1 Admission - ${year} Intake · Marking scheme verification sheet`,
    applicationNo: "Application no.",
    dateSubmitted: "Date submitted",
    childName: "Child's name",
    dateOfBirth: "Date of birth",
    nameSinhala: "Name (Sinhala)",
    birthCertificate: "Birth certificate",
    guardian: "Guardian",
    telephone: "Telephone",
    address: "Address",
    gnDivision: "GN division",
    markHeader: [
      "Description",
      "Max",
      "Marks declared by applicant",
      "First interview board",
      "Objection & appeal board",
      "Remarks",
    ],
    noCategoriesSelected: "No marking categories were selected.",
    declaration:
      "I certify that the particulars given above are true and correct. I understand that if any information is found to be false, or if any required document cannot be produced at the interview, the application may be rejected and any place already granted may be withdrawn.",
    signatures: ["Applicant's signature", "First interview board", "Objection & appeal board"],
    homeLocationCaption: "Home location",
    generatedFooter: (dateTime, code, page, pageCount) =>
      `Generated ${dateTime} · Application ${code} · Page ${page} of ${pageCount}`,
  },
  si: {
    collegeName: "ඇලෝසියස් විද්‍යාලය, ගාල්ල",
    collegeLocation: "ශ්‍රී ලංකාව",
    sheetTitle: (year) =>
      `1 ශ්‍රේණිය ප්‍රවේශය - ${year} වාර්ෂිකය · ලකුණු දීමේ පටිපාටිය තහවුරු කිරීමේ පත්‍රිකාව`,
    applicationNo: "අයදුම්පත් අංකය",
    dateSubmitted: "යොමු කළ දිනය",
    childName: "දරුවාගේ නම",
    dateOfBirth: "උපන් දිනය",
    nameSinhala: "නම (සිංහල)",
    birthCertificate: "උප්පැන්න සහතිකය",
    guardian: "භාරකරු",
    telephone: "දුරකථන අංකය",
    address: "ලිපිනය",
    gnDivision: "ග්‍රාම නිලධාරී වසම",
    markHeader: [
      "විස්තරය",
      "උපරිමය",
      "අයදුම්කරු විසින් ප්‍රකාශිත ලකුණු",
      "පළමු සම්මුඛ පරීක්ෂණ මණ්ඩලය",
      "විරෝධතා හා අභියාචනා මණ්ඩලය",
      "වැදගත් සටහන්",
    ],
    noCategoriesSelected: "ලකුණු දීමේ කිසිදු වර්ගීකරණයක් තෝරාගෙන නොමැත.",
    declaration:
      "ඉහත සඳහන් තොරතුරු සත්‍ය හා නිවැරදි බව මම සහතික කරමි. සපයන ලද තොරතුරු අසත්‍ය බව හෝ අවශ්‍ය ලේඛනයක් සම්මුඛ පරීක්ෂණයේදී ඉදිරිපත් කළ නොහැකි බව අනාවරණය වුවහොත්, අයදුම්පත ප්‍රතික්ෂේප කළ හැකි අතර දැනටමත් ලබා දී ඇති ඉඩක් ආපසු ගත හැකි බව මම තේරුම් ගනිමි.",
    signatures: [
      "අයදුම්කරුගේ අත්සන",
      "පළමු සම්මුඛ පරීක්ෂණ මණ්ඩලය",
      "විරෝධතා හා අභියාචනා මණ්ඩලය",
    ],
    homeLocationCaption: "නිවසේ පිහිටීම",
    generatedFooter: (dateTime, code, page, pageCount) =>
      `ජනනය කළේ ${dateTime} · අයදුම්පත ${code} · පිටුව ${page} / ${pageCount}`,
  },
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
  const base = name ? `${code}-${name}` : code;
  return `${base}.pdf`;
}

/** Same as {@link applicationPdfFilename}, but with a `-si` suffix for the
 * Sinhala sheet so a Sinhala and an English download never overwrite each
 * other in the applicant's downloads folder. */
export function applicationPdfFilenameForLocale(draft: ApplicationDraft, locale: PdfLocale): string {
  if (locale === "en") return applicationPdfFilename(draft);
  return applicationPdfFilename(draft).replace(/\.pdf$/, `-${locale}.pdf`);
}

/**
 * Filename for a single-category download, e.g.
 * `26DHK083-nadhilage-podi-eka-6.1.pdf` - distinguishes it from the full
 * application sheet and from any other category's sheet for the same
 * applicant.
 */
export function applicationCategoryPdfFilename(
  draft: ApplicationDraft,
  categoryType: CategoryType,
  locale: PdfLocale = "en",
): string {
  return applicationPdfFilenameForLocale(draft, locale).replace(/\.pdf$/, `-${categoryType}.pdf`);
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return `${formatDate(value)} ${parsed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function orDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text === "" ? "-" : text;
}

type Row = { label: string; value: string };
type Section = { heading: string; rows: Row[] };

/** Flattens the draft into the printable sections, in the order the form asks for them. */
export function buildApplicationSections(draft: ApplicationDraft): Section[] {
  const location = draft.location;
  const coordinates =
    Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
      ? `${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}`
      : "-";

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
        `Category ${category.categoryType} - ${CATEGORY_LABELS_EN[category.categoryType] ?? ""}`.trim(),
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
  return buildMarkLinesForLocale(draft, "en");
}


/**
 * Sinhala translations for the fixed, small set of criterion labels
 * `scoring.ts` bakes in as plain English strings (it has no access to `t`,
 * being pure business logic shared with the live category-step UI). Keyed by
 * the exact English label so a criterion this table doesn't yet know about
 * still prints legibly in English rather than disappearing.
 */
const CRITERION_LABELS_SI: Record<string, string> = {
  "Main residence document": "ප්‍රධාන පදිංචි ලේඛනය",
  "Additional documents": "අතිරේක ලේඛන",
  "Electoral register": "ඡන්ද හිමි නාමලේඛනය",
  "Nearby schools": "අසල පිහිටි පාසල්",
  "Years educated at school": "පාසලේ ඉගෙනුම ලැබූ වසර ගණන",
  "Grade 5 Scholarship": "5 ශ්‍රේණිය ශිෂ්‍යත්වය",
  "G.C.E. (O/L)": "අ.පො.ස. (සා/පෙළ)",
  "G.C.E. (A/L)": "අ.පො.ස. (උ/පෙළ)",
  "Sports / co-curricular": "ක්‍රීඩා / සහපෙළ පාඨමාලා",
  "Leadership role": "නායකත්ව තනතුරු",
  "Student societies": "ශිෂ්‍ය සමිති සහ සංගම්",
  "Other activities": "වෙනත් බාහිර ක්‍රියාකාරකම්",
  "Past Pupils' Association": "ආදි ශිෂ්‍ය සංගමය",
  "University degrees": "විශ්ව විද්‍යාල උපාධි",
  "Diploma / Higher Diploma": "ඩිප්ලෝමා / උසස් ඩිප්ලෝමා",
  "Contribution to school activities": "පාසල් ක්‍රියාකාරකම්වලට දායකත්වය",
  "Contribution to school projects": "පාසල් ව්‍යාපෘතිවලට දායකත්වය",
  "Siblings currently studying": "දැනට ඉගෙනුම ලබන සහෝදර/සහෝදරියන්",
  "Sibling studied at applied school": "අයදුම් කළ පාසලේ ඉගෙනුම ලැබූ සහෝදර/සහෝදරිය",
  "Two or more siblings applying": "සහෝදර/සහෝදරියන් දෙදෙනෙකු හෝ වැඩි ගණනක් අයදුම් කිරීම",
  "Sibling co-curricular & prefect": "සහෝදර/සහෝදරියන්ගේ සහපෙළ පාඨමාලා සහ ප්‍රධානත්ව තනතුරු",
  "Residence document": "පදිංචි ලේඛනය",
  "Period of service": "සේවා කාලය",
  "Difficult service": "අභියෝගාත්මක සේවය",
  "Unutilized leave": "භාවිත නොකළ නිවාඩු",
  "Service location": "සේවා ස්ථානය",
  "Residence to school": "නිවසේ සිට පාසලට දුර",
  "Workplace to school": "සේවා ස්ථානයේ සිට පාසලට දුර",
  "Previous-to-new workplace distance": "පැරණි සිට නව සේවා ස්ථානයට දුර",
  "Period at previous workplace": "පැරණි සේවා ස්ථානයේ කාලය",
  "Time since transfer": "ස්ථාන මාරුවීමෙන් පසු ගත වූ කාලය",
  "Continuous period abroad with child": "දරුවා සමඟ විදේශයේ අඛණ්ඩ රැඳී සිටි කාලය",
  "Employment purpose": "රැකියාවේ අරමුණ",
};

function localizeCriterionLabel(label: string, locale: PdfLocale): string {
  if (locale !== "si") return label;
  return CRITERION_LABELS_SI[label] ?? label;
}

function buildMarkLinesForLocale(draft: ApplicationDraft, locale: PdfLocale): MarkLine[] {
  const lines: MarkLine[] = [];
  const categoryLabels = CATEGORY_LABELS_BY_LOCALE[locale];

  for (const category of draft.categories) {
    const score = scoreCategory(category);
    lines.push({
      kind: "category",
      label: `${category.categoryType} - ${categoryLabels[category.categoryType] ?? ""}`.trim(),
      max: CATEGORY_MAX_MARKS,
      declared: score.total,
    });
    for (const row of score.breakdown) {
      lines.push({
        kind: "criterion",
        label: localizeCriterionLabel(row.label, locale),
        max: row.max,
        declared: row.marks,
      });
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
 * (300 dpi) first - that alone is the difference between a ~5 MB and a ~200 kB
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

const MAP_WIDTH_PX = 640;
const MAP_HEIGHT_PX = 360;

/**
 * A small static map snapshot of the applicant's home pin, fetched from a
 * public OpenStreetMap static-render service. Best-effort like
 * {@link loadCrest}: the service is a third party, so any failure (network,
 * rate limit, blocked) is swallowed and the sheet simply prints without the
 * map rather than failing the whole download.
 */
async function loadLocationMapImage(latitude: number, longitude: number): Promise<string | null> {
  if (typeof document === "undefined") return null;
  try {
    const url = `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=15&size=${MAP_WIDTH_PX}x${MAP_HEIGHT_PX}&markers=${latitude},${longitude},red-pushpin`;
    // A third-party static-map service must never be able to hang the whole
    // PDF download indefinitely - cap it well below anything a user would
    // wait for, and fall through to "no map" on timeout same as any other
    // failure.
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
}

type Column = { width: number; align?: "left" | "center" | "right" };

function wrapForCanvas(ctx: CanvasRenderingContext2D, text: string, maxWidthPx: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidthPx) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Same rasterisation strategy as `renderUnicodeToImage`, but word-wrapped to
 * a maximum width first - used for the declaration paragraph, which (unlike
 * every other Sinhala string on the sheet) is long enough to need wrapping
 * rather than a single line.
 */
function renderUnicodeParagraphToImage(
  text: string,
  fontSizePt: number,
  maxWidthMm: number,
): { dataUrl: string; widthMm: number; heightMm: number } | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d");
  if (!measure) return null;

  const scale = 4;
  const fontPx = fontSizePt * 1.333 * scale;
  const fontStack = `${fontPx}px "Noto Sans Sinhala", "Iskoola Pota", system-ui, sans-serif`;
  measure.font = fontStack;
  const maxWidthPx = (maxWidthMm / 0.2646) * scale;
  const wrapped = wrapForCanvas(measure, text, maxWidthPx);

  const lineHeightPx = fontPx * 1.55;
  canvas.width = Math.max(...wrapped.map((line) => Math.ceil(measure.measureText(line).width)), 1) + scale * 2;
  canvas.height = Math.ceil(lineHeightPx * wrapped.length);

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = fontStack;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#2d2d2d";
  wrapped.forEach((line, index) => ctx.fillText(line, 0, lineHeightPx * (index + 0.5)));

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
export async function buildApplicationPdf(
  draft: ApplicationDraft,
  locale: PdfLocale = "en",
): Promise<Blob> {
  const text = PDF_TEXT[locale];
  // Dynamic import is required, not stylistic: jsPDF is ~350 kB and is only
  // reachable from the submitted screen, so a static import would put it in
  // the bundle every applicant loads before the first step renders.
  const hasHomeLocation =
    Number.isFinite(draft.location.latitude) && Number.isFinite(draft.location.longitude);
  const [{ jsPDF }, crest, locationMap] = await Promise.all([
    import("jspdf"),
    loadCrest(),
    hasHomeLocation
      ? loadLocationMapImage(Number(draft.location.latitude), Number(draft.location.longitude))
      : Promise.resolve(null),
  ]);

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

  /** Draws a single standalone (non-table-cell) line of text, rasterising it
   * when it contains anything jsPDF's Latin-1 fonts cannot draw - used for
   * the header, since `drawRow`'s same fallback only covers table cells. */
  const drawCenteredText = (value: string, centerX: number, baselineY: number, fontSizePt: number) => {
    if (!needsUnicodeFallback(value)) {
      doc.text(value, centerX, baselineY, { align: "center" });
      return;
    }
    const image = renderUnicodeToImage(value, fontSizePt);
    if (!image) return;
    doc.addImage(
      image.dataUrl,
      "PNG",
      centerX - image.widthMm / 2,
      baselineY - image.heightMm * 0.72,
      image.widthMm,
      image.heightMm,
      undefined,
      "FAST",
    );
  };

  /** Draws one bordered table row, wrapping text and growing the row to fit. */
  const drawRow = (
    cells: string[],
    columns: Column[],
    options: { bold?: boolean; fill?: [number, number, number]; minHeight?: number } = {},
  ) => {
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    const padding = 1.4;
    const fontSizePt = doc.getFontSize();

    // Sinhala cells are word-wrapped to the column width at the row's own
    // font size (matching whatever English cells in the same row use),
    // instead of forced onto one line and shrunk to fit - that made a
    // long Sinhala header (e.g. "First interview board") render tiny next
    // to a short one ("Max") in the same header row.
    const cellContent = cells.map((cell, index) => {
      const width = (columns[index]?.width ?? 20) - padding * 2;
      if (needsUnicodeFallback(cell)) {
        return { image: renderUnicodeParagraphToImage(cell, fontSizePt, width) };
      }
      return { lines: doc.splitTextToSize(cell, width) as string[] };
    });
    const contentHeights = cellContent.map((content) =>
      content.lines ? content.lines.length * 3.6 : (content.image?.heightMm ?? 3.6),
    );
    const height = Math.max(...contentHeights, 0) + padding * 2;
    const rowHeight = Math.max(height, options.minHeight ?? 6);

    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = PAGE_MARGIN;
    }

    let x = PAGE_MARGIN;
    for (const [index, column] of columns.entries()) {
      if (options.fill) {
        doc.setFillColor(...options.fill);
        doc.rect(x, y, column.width, rowHeight, "F");
      }
      doc.setDrawColor(70);
      doc.setLineWidth(0.2);
      doc.rect(x, y, column.width, rowHeight);

      const content = cellContent[index];
      const textY = y + padding + 2.6;

      if (content.image) {
        const image = content.image;
        {
          const drawWidth = Math.min(image.widthMm, column.width - padding * 2);
          const drawHeight = image.heightMm * (drawWidth / image.widthMm);
          doc.addImage(
            image.dataUrl,
            "PNG",
            x + padding,
            y + (rowHeight - drawHeight) / 2,
            drawWidth,
            drawHeight,
            undefined,
            "FAST",
          );
        }
      } else if (content.lines) {
        const align = column.align ?? "left";
        const textX =
          align === "right"
            ? x + column.width - padding
            : align === "center"
              ? x + column.width / 2
              : x + padding;
        doc.text(content.lines, textX, textY, { align });
      }
      x += column.width;
    }

    y += rowHeight;
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
  drawCenteredText(text.collegeName, pageWidth / 2, y + 8, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(70);
  drawCenteredText(text.collegeLocation, pageWidth / 2, y + 13, 9);
  doc.setFontSize(9.5);
  doc.setTextColor(20);
  drawCenteredText(text.sheetTitle(INTAKE_YEAR_DEFAULT), pageWidth / 2, y + 19, 9.5);
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
    [text.applicationNo, orDash(draft.sessionCode), text.dateSubmitted, formatDate(draft.submittedAt)],
    halfColumns,
  );
  drawRow(
    [
      text.childName,
      orDash(draft.applicant.fullName),
      text.dateOfBirth,
      formatDate(draft.applicant.dateOfBirth),
    ],
    halfColumns,
  );
  drawRow(
    [
      text.nameSinhala,
      orDash(draft.applicant.sinhalaName),
      text.birthCertificate,
      orDash(draft.applicant.birthCertificateNumber),
    ],
    halfColumns,
  );
  drawRow(
    [text.guardian, orDash(draft.guardian.fullName), text.telephone, orDash(draft.guardian.phone)],
    halfColumns,
  );
  drawRow(
    [
      text.address,
      orDash(
        locale === "si"
          ? draft.residence.permanentAddressSi || draft.residence.permanentAddressEn
          : draft.residence.permanentAddressEn,
      ),
      text.gnDivision,
      orDash(draft.residence.gnDivision),
    ],
    halfColumns,
  );
  y += 5;

  // ------------------------------------------------------ home location map
  if (locationMap) {
    if (y + 46 > bottomLimit) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
    const mapDrawWidth = Math.min(contentWidth, 90);
    const mapDrawHeight = mapDrawWidth * (MAP_HEIGHT_PX / MAP_WIDTH_PX);
    doc.addImage(locationMap, "JPEG", PAGE_MARGIN, y, mapDrawWidth, mapDrawHeight, undefined, "FAST");
    doc.setDrawColor(160);
    doc.setLineWidth(0.2);
    doc.rect(PAGE_MARGIN, y, mapDrawWidth, mapDrawHeight);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    doc.setTextColor(90);
    if (needsUnicodeFallback(text.homeLocationCaption)) {
      const caption = renderUnicodeToImage(text.homeLocationCaption, 7.4);
      if (caption) doc.addImage(caption.dataUrl, "PNG", PAGE_MARGIN, y + mapDrawHeight + 1.5, caption.widthMm, caption.heightMm, undefined, "FAST");
    } else {
      doc.text(text.homeLocationCaption, PAGE_MARGIN, y + mapDrawHeight + 4.5);
    }
    y += mapDrawHeight + 7;
  }

  // ------------------------------------------------------------ marks table
  const markColumns: Column[] = [
    { width: contentWidth - 90 },
    { width: 14, align: "center" },
    { width: 19, align: "center" },
    { width: 19, align: "center" },
    { width: 19, align: "center" },
    { width: 19 },
  ];

  doc.setFontSize(7.4);
  drawRow(text.markHeader, markColumns, { bold: true, fill: [232, 232, 232], minHeight: 13 });
  doc.setFontSize(8);

  const lines = buildMarkLinesForLocale(draft, locale);
  if (lines.length === 0) {
    drawRow([text.noCategoriesSelected, "-", "", "", "", ""], markColumns);
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
  if (needsUnicodeFallback(text.declaration)) {
    const paragraph = renderUnicodeParagraphToImage(text.declaration, 7.6, contentWidth);
    if (paragraph) {
      doc.addImage(paragraph.dataUrl, "PNG", PAGE_MARGIN, y, paragraph.widthMm, paragraph.heightMm, undefined, "FAST");
      y += paragraph.heightMm + 4;
    }
  } else {
    doc.text(doc.splitTextToSize(text.declaration, contentWidth) as string[], PAGE_MARGIN, y);
    y += 12;
  }

  // ----------------------------------------------------------- signatures
  const signatureWidth = contentWidth / 3 - 4;
  doc.setTextColor(20);
  for (const [index, label] of text.signatures.entries()) {
    const x = PAGE_MARGIN + index * (signatureWidth + 6);
    doc.setDrawColor(90);
    doc.line(x, y + 8, x + signatureWidth, y + 8);
    doc.setFontSize(7.4);
    if (needsUnicodeFallback(label)) {
      const image = renderUnicodeToImage(label, 7.4);
      if (image) doc.addImage(image.dataUrl, "PNG", x, y + 9, image.widthMm, image.heightMm, undefined, "FAST");
    } else {
      doc.text(label, x, y + 12);
    }
  }

  // ------------------------------------------------------ footer per page
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(130);
    const footer = text.generatedFooter(
      formatDateTime(new Date().toISOString()),
      draft.sessionCode || "-",
      page,
      pageCount,
    );
    if (needsUnicodeFallback(footer)) {
      const image = renderUnicodeToImage(footer, 7);
      if (image) doc.addImage(image.dataUrl, "PNG", PAGE_MARGIN, pageHeight - 6 - image.heightMm * 0.72, image.widthMm, image.heightMm, undefined, "FAST");
    } else {
      doc.text(footer, PAGE_MARGIN, pageHeight - 6);
    }
  }

  return doc.output("blob");
}

/**
 * Builds the PDF and triggers a browser download under the applicant's
 * filename, or `filenameOverride` when given - used for a single-category
 * download, where the whole-application filename would be ambiguous about
 * which category it covers.
 */
export async function downloadApplicationPdf(
  draft: ApplicationDraft,
  locale: PdfLocale = "en",
  filenameOverride?: string,
): Promise<string> {
  const blob = await buildApplicationPdf(draft, locale);
  const filename = filenameOverride ?? applicationPdfFilenameForLocale(draft, locale);
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
