import { useState } from "react";
import { INTAKE_YEAR_DEFAULT } from "@/lib/g1/intake-year";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@aloysius-admissions/ui/components/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@aloysius-admissions/ui/components/tabs";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@aloysius-admissions/ui/components/tooltip";
import {
  CATEGORY_MAX_MARKS,
  MAIN_DOCUMENT_MAX_61, ADDITIONAL_DOC_MAX_61, ADDITIONAL_DOC_MARKS_PER, ELECTORAL_MAX_61, ELECTORAL_MARKS_PER_PERSON_YEAR_61,
  PROXIMITY_MAX_61, PROXIMITY_PER_SCHOOL_61,
  YEARS_EDUCATED_MAX, YEARS_EDUCATED_MARKS_PER_YEAR, GRADE5_SCHOLARSHIP_MARKS,
  OL_MAX_MARKS, AL_MAX_MARKS, EDUCATIONAL_TOTAL_MAX,
  SPORTS_MAX, LEADERSHIP_MAX, STUDENT_SOCIETIES_MAX, OTHER_ACTIVITIES_MAX,
  PAST_PUPILS_TOTAL_MAX, PAST_PUPILS_LIFE_MEMBER_MARKS, PAST_PUPILS_YEARLY_MARKS, PAST_PUPILS_MEMBERSHIP_MAX,
  PAST_PUPILS_COMMITTEE_MARKS_PER_YEAR, PAST_PUPILS_COMMITTEE_MAX, PAST_PUPILS_EXECUTIVE_MARKS, PAST_PUPILS_EXECUTIVE_MAX,
  DEGREE_MAX, DIPLOMA_MARKS, CONTRIBUTION_MAX, CONTRIBUTION_MAX_62, SCHOOL_PROJECTS_MARKS,
  SIBLING_STUDYING_MAX, SIBLING_MARKS_PER_SIBLING, SIBLING_STUDIED_HERE_MARKS, SIBLING_MULTIPLE_APPLYING_MARKS,
  SIBLING_COCURRICULAR_TOTAL_MAX, SIBLING_PREFECT_MAX, SIBLING_EXAM_MAX, SIBLING_PRAISEWORTHY_MARKS, SIBLING_SUPPORT_MARKS,
  MAIN_DOCUMENT_MAX_63, ELECTORAL_MAX_63, ELECTORAL_MARKS_PER_PERSON_YEAR_63, PROXIMITY_MAX_63, PROXIMITY_PER_SCHOOL_63,
  SERVICE_PERIOD_MAX, DIFFICULT_SERVICE_MAX, DIFFICULT_SERVICE_CURRENT_MARKS, DIFFICULT_SERVICE_PREVIOUS_BASE,
  UNUTILIZED_LEAVE_MAX, UNUTILIZED_LEAVE_MARKS_PER_YEAR, SERVICE_LOCATION_MAX,
  RESIDENCE_DISTANCE_MAX_64, RESIDENCE_DISTANCE_TIERS_64, RESIDENCE_DISTANCE_FALLBACK_64,
  WORKPLACE_DISTANCE_MAX, WORKPLACE_DISTANCE_TIERS, WORKPLACE_DISTANCE_FALLBACK,
  TRANSFER_DISTANCE_MAX, TRANSFER_DISTANCE_TIERS, TRANSFER_SERVICE_PERIOD_MAX,
  TRANSFER_PREVIOUS_PERIOD_MAX, TRANSFER_PREVIOUS_PERIOD_TIERS,
  TRANSFER_ELAPSED_MAX, TRANSFER_ELAPSED_TIERS,
  PROXIMITY_MAX_65, PROXIMITY_PER_SCHOOL_65,
  ABROAD_PERIOD_MAX, ABROAD_PERIOD_TIERS, EMPLOYMENT_PURPOSE_MAX,
  PROXIMITY_MAX_66, PROXIMITY_PER_SCHOOL_66,
  DEED_AGE_WEIGHTS,
} from "@/lib/g1/marking-scheme";
import { SPORTS_LEVEL_MARKS, LEADERSHIP_ROLE_MARKS, STUDENT_SOCIETIES_ROLE_MARKS, OTHER_ACTIVITY_MARKS, OL_CEILINGS, AL_CEILINGS, DEGREE_MARKS, SIBLING_PREFECT_LEVEL_MARKS, SIBLING_EXAM_MARKS } from "@/lib/g1/scoring";

export const Route = createFileRoute("/_auth/g1/admin/mark-allocation")({
  component: MarkAllocationPage,
});

type DetailRow = { label: string; formula: string; max: number; tiers?: string };

const categories: Array<{
  id: string;
  title: string;
  subtitle: string;
  totalMax: number;
  sections: Array<{ heading: string; max: number; rows: DetailRow[] }>;
}> = [
  {
    id: "6.1",
    title: "6.1 - Residence Verification & Proximity",
    subtitle: "Proving residence near the school",
    totalMax: CATEGORY_MAX_MARKS,
    sections: [
      {
        heading: "A) Main residence document",
        max: MAIN_DOCUMENT_MAX_61,
        rows: [
          { label: "Title deed in applicant's name", formula: "20 × deed age weight", max: 20 },
          { label: "Title deed in parents' name", formula: "16 × deed age weight", max: 16 },
          { label: "Feeder area electoral / birth cert (5+ yrs)", formula: "15 × deed age weight", max: 15 },
          { label: "Lease deed in applicant's name", formula: "10 × deed age weight", max: 10 },
          { label: "Municipal / DS certificate", formula: "5 × deed age weight", max: 5 },
          { label: "Other documents (electricity, water, etc.)", formula: "4 × deed age weight", max: 4 },
        ],
      },
      {
        heading: "B) Additional documents",
        max: ADDITIONAL_DOC_MAX_61,
        rows: [
          { label: "NIC, driving license, bills, etc.", formula: `${ADDITIONAL_DOC_MARKS_PER} mark each`, max: ADDITIONAL_DOC_MAX_61 },
        ],
      },
      {
        heading: "C) Electoral register",
        max: ELECTORAL_MAX_61,
        rows: [
          { label: "Mother & father registration (2020–2024)", formula: `${ELECTORAL_MARKS_PER_PERSON_YEAR_61} marks/person-year`, max: ELECTORAL_MAX_61 },
        ],
      },
      {
        heading: "D) Proximity",
        max: PROXIMITY_MAX_61,
        rows: [
          { label: "Schools within residence-to-school radius", formula: `${PROXIMITY_PER_SCHOOL_61} marks/school`, max: PROXIMITY_MAX_61 },
        ],
      },
    ],
  },
  {
    id: "6.2",
    title: "6.2 - Alumni",
    subtitle: "Past pupils of the school",
    totalMax: CATEGORY_MAX_MARKS,
    sections: [
      {
        heading: "Years of education",
        max: YEARS_EDUCATED_MAX,
        rows: [
          { label: "Years educated at the school", formula: `${YEARS_EDUCATED_MARKS_PER_YEAR} marks/year, max 13 years`, max: YEARS_EDUCATED_MAX },
        ],
      },
      {
        heading: "Educational achievements",
        max: EDUCATIONAL_TOTAL_MAX,
        rows: [
          { label: "Grade 5 Scholarship", formula: `${GRADE5_SCHOLARSHIP_MARKS} marks if passed`, max: GRADE5_SCHOLARSHIP_MARKS },
          { label: "G.C.E. (O/L)", formula: "Grades S/C/B/A × ceiling rate", max: OL_MAX_MARKS, tiers: "6 subj: S=0.66 C=1.33 B=1.66 | 8 subj: S=0.51 C=1.00 B=1.25 | 9 subj: S=0.44 C=0.66 B=0.88 A=1.11" },
          { label: "G.C.E. (A/L)", formula: "Grades S/C/B/A × ceiling rate", max: AL_MAX_MARKS, tiers: "3 subj: S=2.00 C=2.66 B=3.33 A=4.00 | 4 subj: S=1.50 C=2.00 B=2.50 A=3.00" },
        ],
      },
      {
        heading: "Co-curricular",
        max: SPORTS_MAX + LEADERSHIP_MAX + STUDENT_SOCIETIES_MAX + OTHER_ACTIVITIES_MAX,
        rows: [
          { label: "Sports", formula: "Level marks × count", max: SPORTS_MAX, tiers: "Inter-house 0.5 | Zonal 1 | District 2 | Provincial 3 | National 4.75 | International 5" },
          { label: "Leadership", formula: "Role-based", max: LEADERSHIP_MAX, tiers: "Primary prefect 1 | Junior 1.5 | Senior 3 | Deputy HP 4 | Head Prefect 5 | Vice-captain 1.5 | Captain 2" },
          { label: "Student societies", formula: "Role-based", max: STUDENT_SOCIETIES_MAX, tiers: "Committee 0.5 | Vice-president 0.75 | President 1" },
          { label: "Other activities", formula: "Activity-based", max: OTHER_ACTIVITIES_MAX, tiers: "Leader 2 | Member 1 (band, scouts, cadets, debating, St John's)" },
        ],
      },
      {
        heading: "Past Pupils' Association",
        max: PAST_PUPILS_TOTAL_MAX,
        rows: [
          { label: "Life membership or yearly", formula: "Life=10 or 0.5/yr", max: PAST_PUPILS_MEMBERSHIP_MAX },
          { label: "Committee membership", formula: `${PAST_PUPILS_COMMITTEE_MARKS_PER_YEAR}/yr × 4yrs`, max: PAST_PUPILS_COMMITTEE_MAX },
          { label: "Executive office", formula: `${PAST_PUPILS_EXECUTIVE_MARKS} × 2 posts`, max: PAST_PUPILS_EXECUTIVE_MAX },
        ],
      },
      {
        heading: "Degrees & contributions",
        max: DEGREE_MAX + DIPLOMA_MARKS + CONTRIBUTION_MAX + SCHOOL_PROJECTS_MARKS,
        rows: [
          { label: "University degree", formula: "Degree 3 / Postgrad 4 / PhD 5", max: DEGREE_MAX },
          { label: "Diploma / NVQ 5-6", formula: "2 marks", max: DIPLOMA_MARKS },
          { label: "School activities", formula: "Sports meet 0.5 + Shramadana 0.5", max: CONTRIBUTION_MAX },
          { label: "School projects", formula: "5 marks", max: SCHOOL_PROJECTS_MARKS },
        ],
      },
    ],
  },
  {
    id: "6.3",
    title: "6.3 - Siblings",
    subtitle: "Siblings at the school",
    totalMax: CATEGORY_MAX_MARKS,
    sections: [
      {
        heading: "Sibling criteria",
        max: SIBLING_STUDYING_MAX + SIBLING_STUDIED_HERE_MARKS + SIBLING_MULTIPLE_APPLYING_MARKS + SIBLING_COCURRICULAR_TOTAL_MAX,
        rows: [
          { label: "Currently studying", formula: `${SIBLING_MARKS_PER_SIBLING}/sibling, max 10`, max: SIBLING_STUDYING_MAX },
          { label: "Studied at applied school", formula: "5 marks", max: SIBLING_STUDIED_HERE_MARKS },
          { label: "Two or more applying", formula: "5 marks", max: SIBLING_MULTIPLE_APPLYING_MARKS },
          { label: "Co-curricular & prefect", formula: "Prefect + exams + praiseworthy + support", max: SIBLING_COCURRICULAR_TOTAL_MAX, tiers: "Prefect 0.25–2 | Scholarship 0.5, OL 1, AL 1.5 | Praiseworthy 2 | Support 4" },
        ],
      },
      {
        heading: "Residence & proximity",
        max: MAIN_DOCUMENT_MAX_63 + ELECTORAL_MAX_63 + PROXIMITY_MAX_63,
        rows: [
          { label: "Residence document", formula: "Varies by doc type", max: MAIN_DOCUMENT_MAX_63 },
          { label: "Electoral register", formula: `${ELECTORAL_MARKS_PER_PERSON_YEAR_63}/person-year`, max: ELECTORAL_MAX_63 },
          { label: "Proximity", formula: `${PROXIMITY_PER_SCHOOL_63}/school`, max: PROXIMITY_MAX_63 },
        ],
      },
    ],
  },
  {
    id: "6.4",
    title: "6.4 - Period of Service & Distance",
    subtitle: "Government servants stationed away",
    totalMax: CATEGORY_MAX_MARKS,
    sections: [
      {
        heading: "Service",
        max: SERVICE_PERIOD_MAX + DIFFICULT_SERVICE_MAX + UNUTILIZED_LEAVE_MAX + SERVICE_LOCATION_MAX,
        rows: [
          { label: "Period of service", formula: "1 mark/year", max: SERVICE_PERIOD_MAX },
          { label: "Difficult service (current)", formula: "25 marks", max: DIFFICULT_SERVICE_CURRENT_MARKS },
          { label: "Difficult service (previous)", formula: "Base 15 or distance tier", max: DIFFICULT_SERVICE_MAX, tiers: "≥150km: 15 | ≥100km: 10 | ≥75km: 5 + 0.5/extra period" },
          { label: "Unutilized leave", formula: `${UNUTILIZED_LEAVE_MARKS_PER_YEAR}/yr, max 5`, max: UNUTILIZED_LEAVE_MAX },
          { label: "Service location", formula: "Level-based", max: SERVICE_LOCATION_MAX, tiers: "Same school 10 | Zone 7.5 | Province 5 | Education inst 2.5" },
        ],
      },
      {
        heading: "Distance",
        max: RESIDENCE_DISTANCE_MAX_64 + WORKPLACE_DISTANCE_MAX,
        rows: [
          { label: "Residence to school", formula: "Tiered by km", max: RESIDENCE_DISTANCE_MAX_64, tiers: "≤1km: 10 | ≤3km: 8 | ≤5km: 6 | >5km: 4" },
          { label: "Workplace to school", formula: "Tiered by km", max: WORKPLACE_DISTANCE_MAX, tiers: "≥100km: 25 | ≥70km: 20 | ≥40km: 15 | ≥20km: 10 | <20km: 5" },
        ],
      },
    ],
  },
  {
    id: "6.5",
    title: "6.5 - Transfer Applications",
    subtitle: "Teachers transferring from distant stations",
    totalMax: CATEGORY_MAX_MARKS,
    sections: [
      {
        heading: "Transfer criteria",
        max: TRANSFER_DISTANCE_MAX + TRANSFER_SERVICE_PERIOD_MAX + TRANSFER_PREVIOUS_PERIOD_MAX + TRANSFER_ELAPSED_MAX,
        rows: [
          { label: "Previous-to-new distance", formula: "Tiered by km", max: TRANSFER_DISTANCE_MAX, tiers: ">150km: 35 | >100km: 28 | >50km: 21" },
          { label: "Period of service", formula: "1 mark/year", max: TRANSFER_SERVICE_PERIOD_MAX },
          { label: "Period at previous workplace", formula: "Tiered by years", max: TRANSFER_PREVIOUS_PERIOD_MAX, tiers: "≥3yrs: 10 | ≥2yrs: 8 | ≥1yr: 5" },
          { label: "Time since transfer", formula: "Tiered by years", max: TRANSFER_ELAPSED_MAX, tiers: "≤1yr: 5 | ≤2yrs: 4 | ≤3yrs: 3 | ≤4yrs: 2 | ≤5yrs: 1" },
        ],
      },
      {
        heading: "Proximity & leave",
        max: PROXIMITY_MAX_65 + UNUTILIZED_LEAVE_MAX,
        rows: [
          { label: "Proximity", formula: `${PROXIMITY_PER_SCHOOL_65}/school`, max: PROXIMITY_MAX_65 },
          { label: "Unutilized leave", formula: `${UNUTILIZED_LEAVE_MARKS_PER_YEAR}/yr`, max: UNUTILIZED_LEAVE_MAX },
        ],
      },
    ],
  },
  {
    id: "6.6",
    title: "6.6 - Foreign Employment",
    subtitle: "Parents who worked abroad with child",
    totalMax: CATEGORY_MAX_MARKS,
    sections: [
      {
        heading: "Criteria",
        max: ABROAD_PERIOD_MAX + EMPLOYMENT_PURPOSE_MAX + PROXIMITY_MAX_66,
        rows: [
          { label: "Period abroad with child", formula: "Tiered by years", max: ABROAD_PERIOD_MAX, tiers: "≥3yrs: 25 | ≥2yrs: 15 | ≥1yr: 10" },
          { label: "Employment purpose", formula: "Category-based", max: EMPLOYMENT_PURPOSE_MAX, tiers: "Board duties 40 | Personal 30 | Government 25 | Education 20" },
          { label: "Proximity", formula: `${PROXIMITY_PER_SCHOOL_66}/school`, max: PROXIMITY_MAX_66 },
        ],
      },
    ],
  },
];

const deedAgeTable = DEED_AGE_WEIGHTS.map((d) => ({ label: `≥${d.minYears} yrs`, pct: `${Math.round(d.weight * 100)}%` }));

function MarkAllocationPage() {
  const [activeTab, setActiveTab] = useState("6.1");
  const activeCat = categories.find((c) => c.id === activeTab) ?? categories[0];

  return (
    <TooltipProvider>
      <main className="min-h-svh overflow-hidden bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)] p-4 md:p-6 xl:p-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Admin / Reference</p>
            <h1 className="mt-1 font-heading text-[clamp(1.7rem,3vw,2.6rem)] leading-tight">Mark allocation</h1>
            <p className="mt-1.5 max-w-[60ch] text-sm text-muted-foreground">
              How the G1 {INTAKE_YEAR_DEFAULT} marking scheme distributes 100 marks across sub-categories for each admission type.
            </p>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={(v) => { if (v) setActiveTab(v); }}>
                <div className="border-b px-4 pt-3">
                  <TabsList variant="line" className="scroll-shadow-x w-full justify-start overflow-x-auto">
                    {categories.map((cat) => (
                      <TabsTrigger key={cat.id} value={cat.id} className="shrink-0">
                        {cat.id}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                <div className="p-4 md:p-6">
                  <TabsContent value={activeTab}>
                    <CategoryDetail cat={activeCat} />
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>

          {activeTab === "6.1" && (
            <Card className="mt-4">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">Deed transfer age-based scoring</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
                  {deedAgeTable.map((d) => (
                    <div key={d.label} className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
                      <span className="block text-xs text-muted-foreground">{d.label}</span>
                      <span className="block text-sm font-bold tabular-nums mt-0.5">{d.pct}</span>
                    </div>
                  ))}
                  <div className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
                    <span className="block text-xs text-muted-foreground">&lt;6 mo</span>
                    <span className="block text-sm font-bold tabular-nums mt-0.5">5%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mt-4 grid grid-cols-3 md:grid-cols-6 gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`rounded-xl border px-3 py-2.5 text-left transition-all ${activeTab === cat.id ? "border-primary bg-primary/5 shadow-sm" : "bg-card hover:bg-muted/50 hover:border-border/80"}`}
              >
                <span className="block text-[0.65rem] font-bold text-primary">{cat.id}</span>
                <span className="block text-xs font-medium mt-0.5 leading-tight">{cat.title.split("-")[1]?.trim()}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </TooltipProvider>
  );
}

function CategoryDetail({ cat }: { cat: (typeof categories)[number] }) {
  return (
    <div className="grid gap-5">
      <div>
        <h2 className="font-heading text-xl">{cat.title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{cat.subtitle}</p>
      </div>

      {cat.sections.map((section) => {
        const sectionTotal = section.rows.reduce((s, r) => s + r.max, 0);
        return (
          <div key={section.heading}>
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-sm font-semibold">{section.heading}</h3>
              <span className="text-xs text-muted-foreground font-mono tabular-nums">{sectionTotal} / {section.max}</span>
            </div>
            <div className="rounded-xl border bg-card overflow-hidden">
              {section.rows.map((row, i) => (
                <div
                  key={row.label}
                  className={`group flex items-center gap-4 px-4 py-2.5 ${i < section.rows.length - 1 ? "border-b border-border/50" : ""} hover:bg-muted/30 transition-colors`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">{row.label}</span>
                  </div>
                  <div className="hidden sm:block flex-1">
                    <Tooltip>
                      <TooltipTrigger className="text-xs text-muted-foreground hover:text-foreground transition-colors font-mono">
                        {row.formula}
                      </TooltipTrigger>
                      {row.tiers && (
                        <TooltipContent side="top" className="max-w-sm whitespace-normal leading-relaxed">
                          {row.tiers}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </div>
                  <div className="w-36 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${(row.max / cat.totalMax) * 100}%`,
                            backgroundColor: row.max >= 20 ? "var(--color-primary)" : row.max >= 10 ? "color-mix(in oklch, var(--color-primary) 60%, transparent)" : "color-mix(in oklch, var(--color-primary) 35%, transparent)",
                          }}
                        />
                      </div>
                      <span className="shrink-0 w-8 text-right font-mono text-xs tabular-nums font-medium">{row.max}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold">Category total</span>
        <span className="text-lg font-bold tabular-nums text-primary">{cat.totalMax} marks</span>
      </div>
    </div>
  );
}
