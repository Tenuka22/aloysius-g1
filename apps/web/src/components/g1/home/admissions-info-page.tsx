import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarClock, CalendarDays, MessageCircle, Phone, SquareArrowOutUpRight, TriangleAlert } from "lucide-react";
import { Button } from "@aloysius-admissions/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aloysius-admissions/ui/components/dialog";
import { Eyebrow } from "@aloysius-admissions/ui/components/eyebrow";
import { HeroVignette } from "@aloysius-admissions/ui/components/hero-vignette";
import { INTAKE_YEAR_DEFAULT } from "@/lib/g1/intake-year";
import { orpc } from "@/utils/orpc";
import { useTranslation } from "@/lib/i18n";

// The submission window (opensAt/closesAt) is fetched from the same public
// `application.status` endpoint the application form itself polls (see
// application-form.tsx), so this page always mirrors the real admissions
// schedule instead of a hand-maintained date.
function useAdmissionsWindowText(locale: string) {
  const { t } = useTranslation();
  const status = useQuery(orpc.application.status.queryOptions({ input: { intakeYear: INTAKE_YEAR_DEFAULT } }));

  if (status.isPending) return t("admissionsInfo.window.loading");
  if (status.isError || !status.data) return null;

  const formatter = new Intl.DateTimeFormat(locale === "si" ? "si-LK" : "en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const opensAt = new Date(status.data.submissionOpensAt);
  const closesAt = new Date(status.data.submissionClosesAt);
  const now = new Date();

  if (now < opensAt) return t("admissionsInfo.window.upcoming", { opensDate: formatter.format(opensAt) });
  if (now > closesAt) return t("admissionsInfo.window.closed", { closesDate: formatter.format(closesAt) });
  return t("admissionsInfo.window.open", { closesDate: formatter.format(closesAt) });
}

// YouTube walkthrough video replacing the self-hosted MP4.
const YOUTUBE_VIDEO_ID = "LlxeQo4F30Q";

// wa.me requires the bare international number (no "+", spaces, or dashes).
const HELP_PHONE_DISPLAY = "+94 77 936 8304";
const HELP_WHATSAPP_NUMBER = "94779368304";

// Interview timetable, kept live in a shared Google Sheet rather than a
// hand-copied schedule in this file, so a change on the sheet (a slot
// reassigned, a category added) shows up here without a deploy. The
// `/htmlembed/sheet` route (the same one Google Sites uses to embed a
// sheet) renders just the grid - no toolbar, formula bar, or Sheets' own
// bottom tab bar - so the day picker built below is the only way to switch
// days, instead of competing with a second, redundant tab strip inside the
// iframe. Works because the sheet is shared "Anyone with the link can
// view", not because it's been separately "published to the web".
const INTERVIEW_SHEET_ID = "1-Aa7F2yEJ2P6Ewwvf5onO2p9XTXAycixVhSqPF7Wzp8";

// One tab per interview day in the shared sheet - `gid` is that tab's own
// sheet id (stable even if the tab is renamed or reordered), captured by
// opening the sheet and reading the `?gid=` each tab's URL updates to.
// `date` gates visibility: a day drops off the picker once it's over, so
// this list only ever needs a new entry appended for a future interview
// day, never manual pruning of past ones.
const INTERVIEW_SHEET_DATES: Array<{ date: string; gid: string; label: string }> = [
  { date: "2026-09-15", gid: "0", label: "Sep 15" },
  { date: "2026-09-16", gid: "1746423011", label: "Sep 16" },
  { date: "2026-09-18", gid: "1200947531", label: "Sep 18" },
  { date: "2026-09-21", gid: "1195790196", label: "Sep 21" },
  { date: "2026-09-22", gid: "1592839584", label: "Sep 22" },
];

function interviewSheetLinkUrl(gid: string) {
  return `https://docs.google.com/spreadsheets/d/${INTERVIEW_SHEET_ID}/edit?usp=sharing&gid=${gid}`;
}
function interviewSheetEmbedUrl(gid: string) {
  return `https://docs.google.com/spreadsheets/d/${INTERVIEW_SHEET_ID}/htmlembed/sheet?gid=${gid}`;
}

// Reference page for applicants: demo walkthrough, live interview schedule and a
// help contact. Reached from the dashboard's quick actions (see home-page.tsx) -
// unlike the old root-page placeholder this replaced, it is not the entry point to
// the admissions portal, so it links back to the dashboard rather than to it.
export function AdmissionsInfoPage() {
  const { t, locale } = useTranslation();
  const admissionsWindowText = useAdmissionsWindowText(locale);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [selectedInterviewGid, setSelectedInterviewGid] = useState<string | null>(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const whatsappHref = `https://wa.me/${HELP_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    t(isEmergency ? "admissionsInfo.help.templateEmergency" : "admissionsInfo.help.templateGeneral"),
  )}`;

  // Only today-or-later interview days ever show - a day that's already
  // passed drops out of the picker on its own the next time this renders,
  // no cleanup needed on the sheet or in this list.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const upcomingInterviewDates = INTERVIEW_SHEET_DATES.filter(
    (entry) => new Date(`${entry.date}T00:00:00`) >= todayStart,
  );
  const activeInterviewGid = selectedInterviewGid ?? upcomingInterviewDates[0]?.gid ?? null;

  return (
    <div className="flex min-h-svh flex-col bg-primary text-primary-foreground" data-surface="admissions-info">
      <main className="relative flex flex-1 items-center justify-center overflow-hidden">
        <HeroVignette variant="vertical" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_38%,color-mix(in_oklch,var(--primary-foreground)_8%,transparent),transparent_70%)]"
        />

        <div className="relative z-10 mx-auto grid w-full max-w-(--breakpoint-lg) place-items-center gap-[clamp(1.5rem,2vw+1rem,2.5rem)] px-[clamp(1.25rem,5vw,4rem)] py-[clamp(3rem,6vw+2rem,6rem)] text-center">
          <img
            src="/logo.png"
            alt={t("admissionsInfo.crestAlt")}
            className="h-[clamp(5rem,6vw+2rem,8rem)] w-[clamp(5rem,6vw+2rem,8rem)] object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            width={128}
            height={128}
          />

          <div className="grid gap-3">
            <h1 className="font-display text-5xl font-semibold tracking-tight leading-[1.05]">
              {t("admissionsInfo.heading")}
            </h1>
            <Eyebrow variant="rule" className="mx-auto pt-1">
              {t("auth.hero.motto")}
            </Eyebrow>
          </div>

          {admissionsWindowText && (
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/6 px-3.5 py-1.5 backdrop-blur-sm">
              <CalendarClock size={13} strokeWidth={2.25} className="text-brand-gold" />
              <span className="text-[0.75rem] font-medium tracking-wide text-primary-foreground/85">
                {admissionsWindowText}
              </span>
            </div>
          )}

          <p className="max-w-[38rem] text-[clamp(0.9rem,0.85rem+0.2vw,1.0625rem)] leading-relaxed text-primary-foreground/70">
            {t("admissionsInfo.description")}
          </p>

          {/* YouTube walkthrough video */}
          <div className="aspect-video w-full max-w-sm overflow-hidden rounded-xl border border-primary-foreground/15 shadow-lg shadow-black/20">
            <iframe
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}`}
              title={t("admissionsInfo.demoVideo.previewAlt")}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <Link to="/admissions">
              <Button
                type="button"
                variant="premium"
                className="gap-2 rounded-full px-5 font-semibold"
              >
                {t("admissionsInfo.openAdmissions")}
              </Button>
            </Link>
            <Button
              type="button"
              variant="outline"
              className="gap-2 rounded-full border-primary-foreground/25 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              onClick={() => setInterviewOpen(true)}
            >
              <CalendarDays size={16} />
              {t("admissionsInfo.interviewSchedule.button")}
            </Button>
          </div>

          <div className="mt-2 flex w-full max-w-sm flex-col items-center gap-3 border-t border-primary-foreground/10 pt-6">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary-foreground/55">
              {t("admissionsInfo.help.heading")}
            </p>
            <a
              href={`tel:+${HELP_WHATSAPP_NUMBER}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:text-brand-gold"
            >
              <Phone size={14} className="text-brand-gold" />
              {HELP_PHONE_DISPLAY}
            </a>

            <div className="flex flex-col items-center gap-2.5 sm:flex-row">
              <div className="inline-flex rounded-full border border-primary-foreground/20 bg-primary-foreground/6 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  aria-pressed={!isEmergency}
                  className={`rounded-full px-3 py-1.5 transition-colors ${
                    !isEmergency
                      ? "bg-primary-foreground text-primary"
                      : "text-primary-foreground/70 hover:text-primary-foreground"
                  }`}
                  onClick={() => setIsEmergency(false)}
                >
                  {t("admissionsInfo.help.general")}
                </button>
                <button
                  type="button"
                  aria-pressed={isEmergency}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition-colors ${
                    isEmergency
                      ? "bg-destructive text-white"
                      : "text-primary-foreground/70 hover:text-primary-foreground"
                  }`}
                  onClick={() => setIsEmergency(true)}
                >
                  <TriangleAlert size={12} />
                  {t("admissionsInfo.help.emergency")}
                </button>
              </div>

              <Button
                type="button"
                variant="outline"
                className="gap-2 rounded-full border-primary-foreground/25 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
                nativeButton={false}
              >
                <MessageCircle size={16} />
                {t("admissionsInfo.help.whatsapp")}
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={interviewOpen} onOpenChange={setInterviewOpen}>
        <DialogContent fullScreen className="w-[90svw] h-[90svh] max-w-none gap-0 overflow-hidden bg-background">
          <DialogHeader className="shrink-0 flex-row items-start justify-between gap-4 border-b bg-background p-6 pb-4">
            <div>
              <DialogTitle>{t("admissionsInfo.interviewSchedule.dialogTitle")}</DialogTitle>
              <DialogDescription>{t("admissionsInfo.interviewSchedule.dialogDescription")}</DialogDescription>
            </div>
            {activeInterviewGid && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
                render={<a href={interviewSheetLinkUrl(activeInterviewGid)} target="_blank" rel="noopener noreferrer" />}
              nativeButton={false}
            >
              <SquareArrowOutUpRight size={14} />
              {t("admissionsInfo.interviewSchedule.openInSheets")}
            </Button>
            )}
          </DialogHeader>
          {upcomingInterviewDates.length > 1 && (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b bg-background px-6 pt-4 pb-4">
              {upcomingInterviewDates.map((entry) => (
                <button
                  key={entry.gid}
              type="button"
                  aria-pressed={activeInterviewGid === entry.gid}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeInterviewGid === entry.gid
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                  onClick={() => setSelectedInterviewGid(entry.gid)}
            >
                  {entry.label}
                </button>
              ))}
            </div>
            )}
          <div className="min-h-0 flex-1 w-full bg-white">
            {interviewOpen && activeInterviewGid ? (
              <iframe
                className="h-full w-full"
                key={activeInterviewGid}
                src={interviewSheetEmbedUrl(activeInterviewGid)}
                title={t("admissionsInfo.interviewSchedule.dialogTitle")}
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : interviewOpen ? (
              <p className="grid h-full place-items-center bg-background p-6 text-sm text-muted-foreground">
                {t("admissionsInfo.interviewSchedule.noUpcoming")}
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
