/**
 * Live interview timetable source.
 *
 * The interview schedule is kept in a shared Google Sheet (one tab per
 * interview day, tab named `MM/DD`). Rather than hand-copying dates and tab
 * gids into the frontend - which is how the picker silently stopped at the
 * last hardcoded entry - the sheet itself is read: the `htmlview` page is
 * server-rendered and lists every tab (name + gid) in plain HTML, no API key
 * or auth needed, as long as the sheet stays shared "Anyone with the link can
 * view". Appending a tab named e.g. `09/23` to the sheet is therefore the
 * only step needed to add an interview day to the site; past days drop off
 * the picker client-side on their own.
 */

/** The shared "grade1 admission" interview timetable sheet. */
export const INTERVIEW_SHEET_ID = "1-Aa7F2yEJ2P6Ewwvf5onO2p9XTXAycixVhSqPF7Wzp8";

export type InterviewDay = {
  /** `YYYY-MM-DD` - year is resolved heuristically (see resolveScheduleYear). */
  date: string;
  /** The tab's own sheet id, stable across renames/reorders. */
  gid: string;
  /** Short display label, e.g. `Sep 23`. */
  label: string;
  /** Chrome-less grid-only render for the iframe embed. */
  embedUrl: string;
  /** Full spreadsheet opened on this tab, for the "Open in Sheets" link. */
  sheetUrl: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

// Matches the htmlview page's server-rendered tab strip entries, e.g.:
// items.push({name: "09\/15", pageUrl: "https:\/\/...sheet?headers\x3dtrue&gid=0", gid: "0", ...});
// The name and URLs carry JS-string escapes (`\/`, `\x3d`), so both are
// unescaped before use. Tabs whose name isn't `MM/DD` (templates, scratch)
// never surface.
const TAB_PATTERN = /items\.push\(\{name:\s*"([^"]*)",\s*pageUrl:\s*"(?:[^"\\]|\\.)*",\s*gid:\s*"(\d+)"/g;
const DATE_TAB_NAME = /^(\d{2})\/(\d{2})$/;

// Sheet tab names carry no year. Resolve each tab to the year whose MM/DD
// occurrence lands nearest "now" (ties go to the future): a December-dated
// schedule still visible in January reads as last December's, while a lone
// March tab seen in September reads as next March's. All UTC so the result
// doesn't depend on the server's timezone.
function resolveTabYear(month: number, day: number, now: Date): number {
  const year = now.getUTCFullYear();
  const nowMs = Date.UTC(year, now.getUTCMonth(), now.getUTCDate());
  const candidates = [year - 1, year, year + 1].map((candidate) => ({
    year: candidate,
    deltaMs: Math.abs(Date.UTC(candidate, month - 1, day) - nowMs),
  }));
  candidates.sort((a, b) => a.deltaMs - b.deltaMs || b.year - a.year);
  return candidates[0].year;
}

/** Parses the tab strip out of an `htmlview` page body into day entries. */
export function parseInterviewSheetTabs(
  html: string,
  now: Date = new Date(),
): Array<{ date: string; gid: string; label: string }> {
  const tabs: Array<{ month: number; day: number; gid: string }> = [];
  for (const match of html.matchAll(TAB_PATTERN)) {
    const name = match[1].replace(/\\(.)/g, "$1");
    const parsed = DATE_TAB_NAME.exec(name);
    if (!parsed) continue;
    tabs.push({ month: Number(parsed[1]), day: Number(parsed[2]), gid: match[2] });
  }
  if (tabs.length === 0) return [];

  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
  return tabs
    .map((tab) => {
      const date = `${resolveTabYear(tab.month, tab.day, now)}-${pad(tab.month)}-${pad(tab.day)}`;
      return {
        date,
        gid: tab.gid,
        label: `${monthFormatter.format(new Date(`${date}T00:00:00Z`))} ${tab.day}`,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

const interviewSheetEmbedUrl = (gid: string) =>
  `https://docs.google.com/spreadsheets/d/${INTERVIEW_SHEET_ID}/htmlembed/sheet?gid=${gid}`;
const interviewSheetLinkUrl = (gid: string) =>
  `https://docs.google.com/spreadsheets/d/${INTERVIEW_SHEET_ID}/edit?usp=sharing&gid=${gid}`;

/**
 * Fetches the sheet and returns every interview day. `fetchFn` is injectable
 * for tests. Throws on a non-2xx response or network failure - callers that
 * want resilience should go through getInterviewScheduleDays.
 */
export async function fetchInterviewScheduleDays(fetchFn: typeof fetch = fetch): Promise<InterviewDay[]> {
  const response = await fetchFn(`https://docs.google.com/spreadsheets/d/${INTERVIEW_SHEET_ID}/htmlview`, {
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Interview sheet request failed with status ${response.status}`);
  }
  return parseInterviewSheetTabs(await response.text(), new Date()).map((day) => ({
    ...day,
    embedUrl: interviewSheetEmbedUrl(day.gid),
    sheetUrl: interviewSheetLinkUrl(day.gid),
  }));
}

// The tab list only changes when the school edits the sheet, so a short cache
// keeps the landing page's SSR and repeated dialog opens from hammering Google
// on every render. On a failed refresh the last good list is served - a
// transient Google hiccup shouldn't blank the schedule dialog.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; days: InterviewDay[] } | null = null;

export async function getInterviewScheduleDays(fetchFn: typeof fetch = fetch): Promise<InterviewDay[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.days;
  try {
    const days = await fetchInterviewScheduleDays(fetchFn);
    cache = { at: Date.now(), days };
    return days;
  } catch (error) {
    if (cache) return cache.days;
    throw error;
  }
}
