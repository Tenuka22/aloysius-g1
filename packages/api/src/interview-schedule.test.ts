import { describe, expect, it, vi } from "vitest";

import {
  fetchInterviewScheduleDays,
  getInterviewScheduleDays,
  INTERVIEW_SHEET_ID,
  parseInterviewSheetTabs,
} from "./interview-schedule";

// Mirrors the server-rendered tab strip on the sheet's htmlview page - JS
// string escapes (`\/`, `\x3d`) included, exactly as Google emits them, plus
// a tab whose name is not MM/DD (which must never surface).
const HTMLVIEW_HTML = String.raw`<!DOCTYPE html><html><head><title>grade1 admession - Google Drive</title></head><body><script>
var gid = null;(gidMatch = /[&?]gid=([0-9]+)/.exec(window.location.hash); var gid = gidMatch ? gidMatch[1] : null;var items = [];items.push({name: "Template", pageUrl: "https://docs.google.com/spreadsheets/d/SHEET/htmlview/sheet?headers\x3dtrue&gid=999", gid: "999",initialSheet: ("999" == gid)});
items.push({name: "09\/23", pageUrl: "https://docs.google.com/spreadsheets/d/SHEET/htmlview/sheet?headers\x3dtrue&gid=855310307", gid: "855310307",initialSheet: ("855310307" == gid)});
items.push({name: "09\/15", pageUrl: "https://docs.google.com/spreadsheets/d/SHEET/htmlview/sheet?headers\x3dtrue&gid=0", gid: "0",initialSheet: ("0" == gid)});
items.push({name: "09\/18", pageUrl: "https://docs.google.com/spreadsheets/d/SHEET/htmlview/sheet?headers\x3dtrue&gid=1200947531", gid: "1200947531",initialSheet: ("1200947531" == gid)});
</script></body></html>`;

describe("parseInterviewSheetTabs", () => {
  it("parses MM/DD tab names into sorted day entries with embed and link URLs", () => {
    const days = parseInterviewSheetTabs(HTMLVIEW_HTML, new Date("2026-09-17T00:00:00Z"));

    expect(days.map((day) => day.date)).toEqual(["2026-09-15", "2026-09-18", "2026-09-23"]);
    expect(days.map((day) => day.gid)).toEqual(["0", "1200947531", "855310307"]);
    expect(days.map((day) => day.label)).toEqual(["Sep 15", "Sep 18", "Sep 23"]);
  });

  it("rolls the schedule year back when the batch lands more than six months ahead", () => {
    // A December schedule still visible in January must read as last
    // December's, not next December's.
    const html = String.raw`items.push({name: "12\/20", pageUrl: "https://x", gid: "7"});`;
    const days = parseInterviewSheetTabs(html, new Date("2027-01-05T00:00:00Z"));
    expect(days.map((day) => day.date)).toEqual(["2026-12-20"]);
  });

  it("assigns a lone far-future month to next year", () => {
    const html = String.raw`items.push({name: "03\/01", pageUrl: "https://x", gid: "5"});`;
    const days = parseInterviewSheetTabs(html, new Date("2026-09-17T00:00:00Z"));
    expect(days.map((day) => day.date)).toEqual(["2027-03-01"]);
  });

  it("returns nothing when the page has no date-named tabs", () => {
    expect(parseInterviewSheetTabs("<html><body>sign in</body></html>")).toEqual([]);
    expect(parseInterviewSheetTabs(String.raw`items.push({name: "Draft", pageUrl: "https://x", gid: "1"});`)).toEqual(
      [],
    );
  });
});

const okResponse = (body: string) => new Response(body, { status: 200 });

describe("fetchInterviewScheduleDays", () => {
  it("fetches the htmlview page and returns full day objects", async () => {
    const fetchFn = vi.fn(async () => okResponse(HTMLVIEW_HTML));
    const days = await fetchInterviewScheduleDays(fetchFn);

    expect(fetchFn).toHaveBeenCalledWith(
      `https://docs.google.com/spreadsheets/d/${INTERVIEW_SHEET_ID}/htmlview`,
      { redirect: "follow" },
    );
    expect(days).toHaveLength(3);
    expect(days[0].label).toBe("Sep 15");
    // URLs carry the module's real sheet id, not the fixture's placeholder.
    expect(days[0].embedUrl).toBe(
      `https://docs.google.com/spreadsheets/d/${INTERVIEW_SHEET_ID}/htmlembed/sheet?gid=0`,
    );
    expect(days[0].sheetUrl).toBe(
      `https://docs.google.com/spreadsheets/d/${INTERVIEW_SHEET_ID}/edit?usp=sharing&gid=0`,
    );
  });

  it("throws on a non-2xx response", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 404 }));
    await expect(fetchInterviewScheduleDays(fetchFn)).rejects.toThrow(/status 404/);
  });
});

describe("getInterviewScheduleDays", () => {
  it("serves the last good list when a refresh fails", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-17T10:00:00Z"));
      const good = await getInterviewScheduleDays(vi.fn(async () => okResponse(HTMLVIEW_HTML)));
      expect(good).toHaveLength(3);

      // Within the TTL the cache is used without refetching.
      vi.setSystemTime(new Date("2026-09-17T10:02:00Z"));
      const cached = await getInterviewScheduleDays(vi.fn(async () => {
        throw new Error("network down");
      }));
      expect(cached).toEqual(good);

      // After the TTL a failed refresh still falls back to the stale list.
      vi.setSystemTime(new Date("2026-09-17T10:20:00Z"));
      const stale = await getInterviewScheduleDays(vi.fn(async () => new Response("", { status: 500 })));
      expect(stale).toEqual(good);

      // ...and a successful refresh replaces it.
      vi.setSystemTime(new Date("2026-09-17T10:40:00Z"));
      const refreshed = await getInterviewScheduleDays(vi.fn(async () => okResponse(String.raw`items.push({name: "09\/28", pageUrl: "https://x", gid: "42"});`)));
      expect(refreshed.map((day) => day.date)).toEqual(["2026-09-28"]);
    } finally {
      vi.useRealTimers();
    }
  });
});
