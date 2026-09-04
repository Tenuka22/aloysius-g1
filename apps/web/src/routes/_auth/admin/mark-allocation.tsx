import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@aloysius-g1/ui/components/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@aloysius-g1/ui/components/tabs";
import {
  CATEGORY_MAX_MARKS,
  MAIN_DOCUMENT_MAX_61, ADDITIONAL_DOC_MAX_61, ELECTORAL_MAX_61, PROXIMITY_MAX_61,
  YEARS_EDUCATED_MAX, GRADE5_SCHOLARSHIP_MARKS, OL_MAX_MARKS, AL_MAX_MARKS, EDUCATIONAL_TOTAL_MAX,
  SPORTS_MAX, LEADERSHIP_MAX, STUDENT_SOCIETIES_MAX, OTHER_ACTIVITIES_MAX,
  PAST_PUPILS_TOTAL_MAX, DEGREE_MAX, DIPLOMA_MARKS, CONTRIBUTION_MAX, SCHOOL_PROJECTS_MARKS,
  SIBLING_STUDYING_MAX, SIBLING_STUDIED_HERE_MARKS, SIBLING_MULTIPLE_APPLYING_MARKS,
  SIBLING_COCURRICULAR_TOTAL_MAX, MAIN_DOCUMENT_MAX_63, ELECTORAL_MAX_63, PROXIMITY_MAX_63,
  SERVICE_PERIOD_MAX, DIFFICULT_SERVICE_MAX, UNUTILIZED_LEAVE_MAX, SERVICE_LOCATION_MAX,
  RESIDENCE_DISTANCE_MAX_64, WORKPLACE_DISTANCE_MAX,
  TRANSFER_DISTANCE_MAX, TRANSFER_SERVICE_PERIOD_MAX, TRANSFER_PREVIOUS_PERIOD_MAX,
  TRANSFER_ELAPSED_MAX, PROXIMITY_MAX_65,
  ABROAD_PERIOD_MAX, EMPLOYMENT_PURPOSE_MAX, PROXIMITY_MAX_66,
} from "@/lib/marking-scheme";

export const Route = createFileRoute("/_auth/admin/mark-allocation")({
  component: MarkAllocationPage,
});

type ScoreRow = { label: string; max: number; note?: string };

const categories: Array<{
  id: string;
  title: string;
  subtitle: string;
  totalMax: number;
  rows: ScoreRow[];
}> = [
  {
    id: "6.1",
    title: "6.1 — Residence Verification & Proximity",
    subtitle: "Marks for proving residence near the school",
    totalMax: CATEGORY_MAX_MARKS,
    rows: [
      { label: "Main residence document", max: MAIN_DOCUMENT_MAX_61, note: "Title deed (20), parents' deed (16), feeder electoral 5yrs (15), lease (10), municipal/DS cert (5), other (4) × deed-age weight" },
      { label: "Additional documents", max: ADDITIONAL_DOC_MAX_61, note: "1 mark each, max 5" },
      { label: "Electoral register", max: ELECTORAL_MAX_61, note: "2.5 marks per person-year (2020–2024), max 25" },
      { label: "Nearby schools (proximity)", max: PROXIMITY_MAX_61, note: "5 marks per school within radius, max 50" },
    ],
  },
  {
    id: "6.2",
    title: "6.2 — Alumni",
    subtitle: "Marks for past pupils of the school",
    totalMax: CATEGORY_MAX_MARKS,
    rows: [
      { label: "Years educated at school", max: YEARS_EDUCATED_MAX, note: "2 marks per year, max 13 years → 26" },
      { label: "Grade 5 Scholarship", max: GRADE5_SCHOLARSHIP_MARKS, note: "3 marks if passed" },
      { label: "G.C.E. (O/L)", max: OL_MAX_MARKS, note: "Grades S/C/B/A with ceilings by subject count" },
      { label: "G.C.E. (A/L)", max: AL_MAX_MARKS, note: "Grades S/C/B/A with ceilings by subject count" },
      { label: "Educational sub-total cap", max: EDUCATIONAL_TOTAL_MAX, note: "Scholarship + OL + AL capped at 25" },
      { label: "Sports / co-curricular", max: SPORTS_MAX, note: "Level-based: inter-house (0.5) → international (5)" },
      { label: "Leadership role", max: LEADERSHIP_MAX, note: "Prefect-primary (1) → head-prefect (5)" },
      { label: "Student societies", max: STUDENT_SOCIETIES_MAX, note: "Committee (0.5) → president (1)" },
      { label: "Other activities", max: OTHER_ACTIVITIES_MAX, note: "Band, scouts, cadets, debating, St John's" },
      { label: "Past Pupils' Association", max: PAST_PUPILS_TOTAL_MAX, note: "Life member (10) or yearly (0.5/yr), + committee (0.25/yr), + executive (1.5×2)" },
      { label: "University degrees", max: DEGREE_MAX, note: "Degree (3), postgraduate (4), doctorate (5)" },
      { label: "Diploma / Higher Diploma", max: DIPLOMA_MARKS, note: "2 marks" },
      { label: "Contribution to school activities", max: CONTRIBUTION_MAX, note: "Sports meet (0.5) + Shramadana (0.5), max 2" },
      { label: "Contribution to school projects", max: SCHOOL_PROJECTS_MARKS, note: "5 marks" },
    ],
  },
  {
    id: "6.3",
    title: "6.3 — Siblings",
    subtitle: "Marks for siblings studying or who studied at the school",
    totalMax: CATEGORY_MAX_MARKS,
    rows: [
      { label: "Siblings currently studying", max: SIBLING_STUDYING_MAX, note: "2 marks per sibling, max 10 → 20" },
      { label: "Sibling studied at applied school", max: SIBLING_STUDIED_HERE_MARKS, note: "5 marks" },
      { label: "Two or more siblings applying", max: SIBLING_MULTIPLE_APPLYING_MARKS, note: "5 marks" },
      { label: "Sibling co-curricular & prefect", max: SIBLING_COCURRICULAR_TOTAL_MAX, note: "Prefect level (0.25–2), exams (0.5–1.5), praiseworthy (2), support (4), total max 10" },
      { label: "Residence document", max: MAIN_DOCUMENT_MAX_63, note: "Title deed-applicant/spouse (10), parents (6), feeder electoral (6), lease (4), other (2)" },
      { label: "Electoral register", max: ELECTORAL_MAX_63, note: "2 marks per person-year, max 20" },
      { label: "Nearby schools (proximity)", max: PROXIMITY_MAX_63, note: "3 marks per school within radius, max 30" },
    ],
  },
  {
    id: "6.4",
    title: "6.4 — Period of Service & Distance",
    subtitle: "Marks for government servants stationed away from home",
    totalMax: CATEGORY_MAX_MARKS,
    rows: [
      { label: "Period of service", max: SERVICE_PERIOD_MAX, note: "1 mark per year, max 20" },
      { label: "Difficult service", max: DIFFICULT_SERVICE_MAX, note: "Current: 25. Previous: base 15 or distance tier (75km→5, 100km→10, 150km→15) + extra periods (0.5 each), max 25" },
      { label: "Unutilized leave", max: UNUTILIZED_LEAVE_MAX, note: "2 marks per year, max 5 → 10" },
      { label: "Service location", max: SERVICE_LOCATION_MAX, note: "Same school (10), zone (7.5), province (5), education institution (2.5)" },
      { label: "Residence to school", max: RESIDENCE_DISTANCE_MAX_64, note: "≤1km: 10, ≤3km: 8, ≤5km: 6, >5km: 4" },
      { label: "Workplace to school", max: WORKPLACE_DISTANCE_MAX, note: "≥100km: 25, ≥70km: 20, ≥40km: 15, ≥20km: 10, <20km: 5" },
    ],
  },
  {
    id: "6.5",
    title: "6.5 — Transfer Applications",
    subtitle: "Marks for teachers transferring from distant stations",
    totalMax: CATEGORY_MAX_MARKS,
    rows: [
      { label: "Previous-to-new workplace distance", max: TRANSFER_DISTANCE_MAX, note: ">150km: 35, >100km: 28, >50km: 21" },
      { label: "Nearby schools (proximity)", max: PROXIMITY_MAX_65, note: "3 marks per school within radius, max 30" },
      { label: "Period of service", max: TRANSFER_SERVICE_PERIOD_MAX, note: "1 mark per year, max 10" },
      { label: "Period at previous workplace", max: TRANSFER_PREVIOUS_PERIOD_MAX, note: "≥3yrs: 10, ≥2yrs: 8, ≥1yr: 5" },
      { label: "Time since transfer", max: TRANSFER_ELAPSED_MAX, note: "≤1yr: 5, ≤2yrs: 4, ≤3yrs: 3, ≤4yrs: 2, ≤5yrs: 1" },
      { label: "Unutilized leave", max: UNUTILIZED_LEAVE_MAX, note: "2 marks per year, max 5 → 10" },
    ],
  },
  {
    id: "6.6",
    title: "6.6 — Foreign Employment",
    subtitle: "Marks for parents who worked abroad with the child",
    totalMax: CATEGORY_MAX_MARKS,
    rows: [
      { label: "Continuous period abroad with child", max: ABROAD_PERIOD_MAX, note: "≥3yrs: 25, ≥2yrs: 15, ≥1yr: 10" },
      { label: "Employment purpose", max: EMPLOYMENT_PURPOSE_MAX, note: "Board (40), personal (30), government (25), education (20)" },
      { label: "Nearby schools (proximity)", max: PROXIMITY_MAX_66, note: "3.5 marks per school within radius, max 35" },
    ],
  },
];

function MarkBar({ max, totalMax }: { max: number; totalMax: number }) {
  const pct = (max / totalMax) * 100;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 w-12 text-right font-mono text-xs tabular-nums text-muted-foreground">{max}</span>
    </div>
  );
}

function CategoryOverview({ cat }: { cat: (typeof categories)[number] }) {
  const subtotals = cat.rows.reduce((sum, r) => sum + r.max, 0);
  return (
    <div className="grid gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl">{cat.title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{cat.subtitle}</p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-2xl font-bold tabular-nums">{cat.totalMax}</span>
          <span className="text-sm text-muted-foreground ml-1">/ {cat.totalMax} max</span>
          {subtotals !== cat.totalMax && (
            <p className="text-xs text-muted-foreground">Sub-items sum: {subtotals}</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid gap-0">
          {cat.rows.map((row, i) => (
            <div
              key={row.label}
              className={`flex items-center gap-4 px-4 py-3 ${i < cat.rows.length - 1 ? "border-b border-border/60" : ""}`}
            >
              <span className="shrink-0 w-5 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-medium truncate">{row.label}</span>
                {row.note && <span className="block text-xs text-muted-foreground mt-0.5 leading-relaxed">{row.note}</span>}
              </div>
              <div className="w-48 shrink-0">
                <MarkBar max={row.max} totalMax={cat.totalMax} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Sum of all sub-items</span>
          <span className="font-mono tabular-nums font-medium text-foreground">{subtotals} marks</span>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary/50" style={{ width: `${Math.min(100, (subtotals / cat.totalMax) * 100)}%` }} />
        </div>
        {subtotals > cat.totalMax && (
          <p className="mt-1 text-xs text-amber-600">Sub-items exceed category max — overlapping caps apply</p>
        )}
      </div>
    </div>
  );
}

function MarkAllocationPage() {
  const [activeTab, setActiveTab] = useState("6.1");
  const activeCat = categories.find((c) => c.id === activeTab) ?? categories[0];

  return (
    <main className="min-h-svh overflow-hidden bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)] p-4 md:p-6 xl:p-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Admin / Reference</p>
          <h1 className="mt-1 font-heading text-[clamp(1.7rem,3vw,2.6rem)] leading-tight">Mark allocation</h1>
          <p className="mt-1.5 max-w-[60ch] text-sm text-muted-foreground">
            How the G1 2026 marking scheme distributes 100 marks across sub-categories for each admission type.
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={(v) => { if (v) setActiveTab(v); }}>
              <div className="border-b px-4 pt-3">
                <TabsList variant="line" className="w-full justify-start overflow-x-auto">
                  {categories.map((cat) => (
                    <TabsTrigger key={cat.id} value={cat.id} className="shrink-0">
                      {cat.id}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <div className="p-4 md:p-6">
                <TabsContent value={activeTab}>
                  <CategoryOverview cat={activeCat} />
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {categories.map((cat) => {
            const subtotals = cat.rows.reduce((sum, r) => sum + r.max, 0);
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`rounded-xl border p-3 text-left transition-colors ${activeTab === cat.id ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50"}`}
              >
                <span className="block text-xs font-bold text-primary">{cat.id}</span>
                <span className="block text-sm font-medium mt-0.5 truncate">{cat.title.split("—")[1]?.trim()}</span>
                <span className="block text-xs text-muted-foreground mt-1">{cat.rows.length} methods · {subtotals} marks</span>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
