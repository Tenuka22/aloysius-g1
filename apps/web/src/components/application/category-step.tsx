import {
  CATEGORY_TYPES,
  type CategoryApplication,
  type CategoryType,
  type ScoringInputs,
  useApplicationStore,
} from "@/lib/application-store";
import { Button } from "@aloysius-g1/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@aloysius-g1/ui/components/card";
import { Checkbox } from "@aloysius-g1/ui/components/checkbox";
import { Field, FieldLabel } from "@aloysius-g1/ui/components/field";
import { Input } from "@aloysius-g1/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@aloysius-g1/ui/components/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aloysius-g1/ui/components/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aloysius-g1/ui/components/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aloysius-g1/ui/components/tooltip";
import { SchoolMapPicker } from "./school-map-picker";
import { scoreCategory, documentMarks61, additionalDocsMarks61, electoralMarks61, proximityMarks61, proximityMarks, yearsFromDate, yearsBetween, deedAgeWeight, OL_CEILINGS, AL_CEILINGS, gradeRate, SPORTS_LEVEL_MARKS, LEADERSHIP_ROLE_MARKS, SIBLING_PREFECT_LEVEL_MARKS, SIBLING_EXAM_MARKS, MAIN_DOCUMENT_MARKS_63, STUDENT_SOCIETIES_ROLE_MARKS, OTHER_ACTIVITY_MARKS, DEGREE_MARKS } from "@/lib/scoring";

const CATEGORY_LABELS: Record<CategoryType, string> = {
  "6.1": "6.1 – Residence Verification & Proximity",
  "6.2": "6.2 – Alumi",
  "6.3": "6.3 – Siblings",
  "6.4": "6.4 – Period of Service & Distance",
  "6.5": "6.5 – Transfer Applications",
  "6.6": "6.6 – Foreign Employment",
};

const TAB_LABELS: Record<CategoryType, string> = {
  "6.1": "Residence & Proximity",
  "6.2": "Alumi",
  "6.3": "Siblings",
  "6.4": "Service & Distance",
  "6.5": "Transfer",
  "6.6": "Foreign Employment",
};

const MAIN_DOCUMENT_OPTIONS = [
  ["title-deed-applicant", "Title deed – applicant"],
  ["title-deed-parents", "Title deed – parents"],
  ["feeder-electoral-5yrs", "Feeder-area electoral register / birth certificate (min 5 years)"],
  ["lease-deed", "Lease deed"],
  ["municipal-ds-certificate", "Municipal council / Divisional Secretariat certificate"],
  ["other-documents", "Other documents"],
] as const;

const ADDITIONAL_DOC_OPTIONS = [
  ["nic", "NIC"],
  ["driving-license", "Driving licence"],
  ["landline-bill", "Landline bill"],
  ["marriage-certificate", "Marriage certificate"],
  ["life-insurance-policy", "Life insurance policy"],
  ["school-leaving-certificate", "School leaving certificate"],
  ["child-birth-certificate", "Child birth certificate"],
  ["vehicle-registration", "Vehicle registration"],
  ["bank-passbook", "Bank passbook"],
] as const;

const YEAR_OPTIONS = [0, 1, 2, 3, 4, 5];

const ELECTORAL_YEAR_OPTIONS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025] as const;

const OL_SUBJECT_OPTIONS = [
  ["6", "6 subjects"],
  ["8", "8 subjects"],
  ["9", "9 subjects"],
] as const;

const AL_SUBJECT_OPTIONS = [
  ["3", "3 subjects (New Syllabus)"],
  ["4", "4 subjects (Old Syllabus)"],
] as const;

const SPORTS_LEVEL_OPTIONS = [
  ["inter-house", "Inter-House"],
  ["zonal", "Zonal"],
  ["district", "District"],
  ["provincial", "Provincial"],
  ["national", "National"],
  ["international", "International"],
] as const;

const LEADERSHIP_ROLE_OPTIONS = [
  ["prefect-primary", "Primary Student Prefect"],
  ["prefect-junior", "Junior Student Prefect"],
  ["prefect-senior", "Senior Student Prefect"],
  ["deputy-head-prefect", "Deputy Head Prefect"],
  ["head-prefect", "Head Prefect"],
  ["first-team-vice-captain", "First Team Sports Vice-Captain"],
  ["first-team-captain", "First Team Sports Captain"],
] as const;

const STUDENT_SOCIETIES_ROLE_OPTIONS = [
  ["committee-member", "Committee Member"],
  ["vice-president", "Vice President / Vice Secretary / Vice Treasurer"],
  ["president", "President / Secretary / Treasurer"],
] as const;

const OTHER_ACTIVITY_OPTIONS = [
  ["junior-band-leader", "Junior Band Leader"],
  ["junior-band-member", "Junior Band Member"],
  ["senior-band-leader", "Senior Band Leader"],
  ["senior-band-member", "Senior Band Member"],
  ["scout-leader", "Scout Leader"],
  ["scout-member", "Scout Member"],
  ["cub-scout", "Cub Scout"],
  ["cadet-team-leader", "Cadet Team Leader"],
  ["cadet-team-member", "Cadet Team Member"],
  ["debating-team-leader", "Debating Team Leader"],
  ["debating-team-member", "Debating Team Member"],
  ["st-john-ambulance-leader", "St. John Ambulance Leader"],
  ["st-john-ambulance-member", "St. John Ambulance Member"],
  ["other", "Other"],
] as const;

const DEGREE_OPTIONS = [
  ["first-degree", "First degree (UGC approved)"],
  ["postgraduate", "Postgraduate Degree"],
  ["doctorate", "Doctorate (Ph.D.)"],
  ["chartered-professional", "Chartered Professional Degree / NVQ 7"],
] as const;

const SIBLING_EXAM_OPTIONS = [
  ["scholarship", "Grade 5 Scholarship passed (0.5)"],
  ["ol", "G.C.E. (O/L) qualified (1)"],
  ["al", "G.C.E. (A/L) qualified (1.5)"],
] as const;

const SIBLING_DOCUMENT_OPTIONS = [
  ["title-deed-applicant-spouse", "Title deed – applicant / spouse"],
  ["title-deed-parents", "Title deed – parents"],
  ["feeder-electoral-5yrs", "Feeder-area electoral register / birth certificate (min 5 years)"],
  ["lease-deed", "Lease deed"],
  ["municipal-ds-rentact-cert", "Municipal / DS certificate or Rent Act registration"],
  ["other-documents", "Other acceptable documents"],
] as const;

function parseNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        min={0}
        step="1"
        value={value ?? ""}
        placeholder="Enter a number"
        onChange={(event) => onChange(parseNumber(event.target.value))}
      />
    </Field>
  );
}

function YearsSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (years: number) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value != null ? String(value) : null}
        onValueChange={(next) => onChange(Number(next))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Select years" />
        </SelectTrigger>
        <SelectContent>
          {YEAR_OPTIONS.map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year === 1 ? "1 year" : `${year} years`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function DateField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id} className="flex items-center gap-1.5">
        {label}
        {hint && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="text-muted-foreground text-xs cursor-help">ⓘ</TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs whitespace-normal">
                {hint}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </FieldLabel>
      <Input
        id={id}
        type="date"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || undefined)}
      />
    </Field>
  );
}

function MarkBadge({ marks, max, hint }: { marks: number; max: number; hint: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-help tabular-nums">
          {marks.toLocaleString(undefined, { maximumFractionDigits: 2 })} / {max}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs whitespace-pre-line text-xs leading-relaxed">
          {hint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ElectoralYearSelect({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number | undefined;
  onChange: (year: number | undefined) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id} className="flex items-center gap-1.5">
        {label}
        {hint && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="text-muted-foreground text-xs cursor-help">ⓘ</TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs whitespace-normal">
                {hint}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </FieldLabel>
      <Select
        value={value != null ? String(value) : null}
        onValueChange={(next) => onChange(next === "none" ? undefined : Number(next))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Select year first registered" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Not registered</SelectItem>
          {ELECTORAL_YEAR_OPTIONS.map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function RadioOption({ id, value, label }: { id: string; value: string; label: string }) {
  return (
    <FieldLabel htmlFor={id} className="flex w-fit cursor-pointer items-center gap-2 font-normal">
      <RadioGroupItem id={id} value={value} />
      {label}
    </FieldLabel>
  );
}

function DocumentTypeSelect({
  category,
  onChange,
  options = MAIN_DOCUMENT_OPTIONS,
}: {
  category: CategoryApplication;
  onChange: (patch: Partial<ScoringInputs>) => void;
  options?: readonly (readonly [string, string])[];
}) {
  const value = category.scoringInputs.mainDocumentType ?? null;
  return (
    <Field>
      <FieldLabel htmlFor={`main-document-type-${category.id}`}>Main residence document</FieldLabel>
      <Select
        value={value}
        onValueChange={(next) => onChange({ mainDocumentType: String(next) })}
      >
        <SelectTrigger id={`main-document-type-${category.id}`} className="w-full">
          <SelectValue placeholder="Select document type" />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function AdditionalDocsCheckboxGroup({
  category,
  onChange,
}: {
  category: CategoryApplication;
  onChange: (patch: Partial<ScoringInputs>) => void;
}) {
  const docs = category.scoringInputs.additionalDocs ?? [];
  const toggleDoc = (doc: string) => {
    onChange({
      additionalDocs: docs.includes(doc) ? docs.filter((existing) => existing !== doc) : [...docs, doc],
    });
  };
  return (
    <Field className="col-span-2">
      <FieldLabel>Supporting documents held</FieldLabel>
      <div className="grid gap-2 sm:grid-cols-2">
        {ADDITIONAL_DOC_OPTIONS.map(([doc, docLabel]) => (
          <label key={doc} className="flex items-center gap-2 text-sm">
            <Checkbox
              className="size-4"
              checked={docs.includes(doc)}
              onCheckedChange={() => toggleDoc(doc)}
            />
            {docLabel}
          </label>
        ))}
      </div>
    </Field>
  );
}

function Category61Fields({
  category,
  onChange,
}: {
  category: CategoryApplication;
  onChange: (patch: Partial<ScoringInputs>) => void;
}) {
  const inputs = category.scoringInputs;
  const docMarks = documentMarks61(inputs);
  const addlMarks = additionalDocsMarks61(inputs);
  const electoral = electoralMarks61(inputs);
  const prox = proximityMarks61(inputs);
  const mother = inputs.electoralMotherSince ? Math.min(5, 2025 - inputs.electoralMotherSince) : 0;
  const father = inputs.electoralFatherSince ? Math.min(5, 2025 - inputs.electoralFatherSince) : 0;
  const electoralMotherMarks = mother * 2.5;
  const electoralFatherMarks = father * 2.5;
  const deedYears = yearsFromDate(inputs.deedTransferDate);
  const deedWeight = deedAgeWeight(deedYears);
  const deedPct = Math.round(deedWeight * 100);
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Main residence document</span>
            <MarkBadge marks={docMarks} max={20} hint={"Document marks (max 20):\n• Title deed – applicant: 20\n• Title deed – parents: 16\n• Feeder electoral 5yr: 15\n• Lease deed: 10\n• Municipal/DS certificate: 5\n• Other documents: 4\n\nDeed age multiplier:\n• 5+ years = 100%\n• 4 years = 80%\n• 3 years = 60%\n• 2 years = 40%\n• 1 year = 20%\n• 6 months = 10%\n• <6 months = 5%"} />
          </div>
          <DocumentTypeSelect category={category} onChange={onChange} />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Document registration date</span>
            {inputs.deedTransferDate && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {Math.floor(deedYears)} yr{Math.floor(deedYears) !== 1 ? "s" : ""} old · {deedPct}%
              </span>
            )}
          </div>
          <DateField
            id={`deed-transfer-date-${category.id}`}
            label="Date of deed transfer / document registration"
            hint="When was the residence document transferred to the applicant's name? The earlier the date, the higher the marks."
            value={inputs.deedTransferDate}
            onChange={(deedTransferDate) => onChange({ deedTransferDate })}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Supporting documents</span>
          <MarkBadge marks={addlMarks} max={5} hint={"1 mark per document, max 5.\n\nAccepted documents:\n• NIC\n• Driving licence\n• Landline bill\n• Marriage certificate\n• Life insurance policy\n• School leaving certificate\n• Child birth certificate\n• Vehicle registration\n• Bank passbook"} />
        </div>
        <AdditionalDocsCheckboxGroup category={category} onChange={onChange} />
      </div>
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Electoral register – mother</span>
          </div>
          <ElectoralYearSelect
            id={`electoral-mother-year-${category.id}`}
            label="Year mother first registered"
            hint="2.5 marks per year registered (2020–2024). Combined with father, max 25 marks."
            value={inputs.electoralMotherSince}
            onChange={(electoralMotherSince) => onChange({ electoralMotherSince })}
          />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Electoral register – father</span>
          </div>
          <ElectoralYearSelect
            id={`electoral-father-year-${category.id}`}
            label="Year father first registered"
            hint="2.5 marks per year registered (2020–2024). Combined with mother, max 25 marks."
            value={inputs.electoralFatherSince}
            onChange={(electoralFatherSince) => onChange({ electoralFatherSince })}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 border-t pt-3">
        <span className="text-sm font-medium">Electoral register total</span>
        <MarkBadge marks={electoral} max={25} hint={"2.5 marks per person-year.\n\nMother + father combined,\nmax 5 years each = 25 marks.\n\nExample: Both 5 years = 25"} />
      </div>
      <div className="grid gap-1.5 border-t pt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Nearby schools</span>
          <MarkBadge marks={prox} max={50} hint={"Max 50 marks.\nDeduct 5 per school within radius\n(excluding St. Aloysius).\n\nNo other schools = 50 marks\n10 schools = 0 marks"} />
        </div>
      </div>
    </div>
  );
}

function CountSelect({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: number | undefined;
  options: readonly (readonly [string, string])[];
  placeholder: string;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value != null ? String(value) : null}
        onValueChange={(next) => onChange(next === "none" ? undefined : Number(next))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Not attempted</SelectItem>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function StringSelect({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string | undefined;
  options: readonly (readonly [string, string])[];
  placeholder: string;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value ?? null}
        onValueChange={(next) => onChange(next === "none" ? undefined : String(next))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function GradeCounts({
  category,
  prefix,
  grades,
  totalCount,
  onChange,
}: {
  category: CategoryApplication;
  prefix: string;
  grades: readonly string[];
  totalCount: number;
  onChange: (patch: Partial<ScoringInputs>) => void;
}) {
  const keyFor = (grade: string) => `${prefix}Grade${grade}` as keyof ScoringInputs;
  const inputs = category.scoringInputs;

  // Calculate sum of all grades
  const totalSum = grades.reduce((sum, grade) => {
    const key = keyFor(grade);
    return sum + ((inputs[key] as number) ?? 0);
  }, 0);
  const isOverLimit = totalSum > totalCount;

  return (
    <div className="col-span-2 grid grid-cols-4 gap-3 max-md:col-span-1 max-md:grid-cols-2">
      {grades.map((grade) => {
        const key = keyFor(grade);
        const currentValue = (inputs[key] as number) ?? 0;

        // Sum of all grades except this one
        const sumWithoutThis = grades.reduce((sum, g) => {
          if (g === grade) return sum;
          const k = keyFor(g);
          return sum + ((inputs[k] as number) ?? 0);
        }, 0);
        const remaining = totalCount - sumWithoutThis;
        const isThisOver = currentValue > remaining;

        return (
          <Field key={`${category.id}-${key}`}>
            <FieldLabel htmlFor={`${prefix}-grade-${grade}-${category.id}`}>
              {grade} passes
            </FieldLabel>
            <Input
              id={`${prefix}-grade-${grade}-${category.id}`}
              type="number"
              min={0}
              max={totalCount}
              step="1"
              value={currentValue || ""}
              placeholder="0"
              className={isThisOver ? "border-red-500 focus-visible:ring-red-500" : ""}
              onChange={(event) => {
                const val = event.target.value === "" ? 0 : Number(event.target.value);
                onChange({ [key]: val } as Partial<ScoringInputs>);
              }}
              onBlur={(event) => {
                const val = event.target.value === "" ? 0 : Number(event.target.value);
                if (val > remaining) {
                  onChange({ [key]: remaining } as Partial<ScoringInputs>);
                }
              }}
            />
          </Field>
        );
      })}
      {isOverLimit && (
        <p className="col-span-2 text-sm text-red-500 max-md:col-span-1">
          Total ({totalSum}) exceeds {totalCount} subjects
        </p>
      )}
    </div>
  );
}

function Category62Fields({
  category,
  onChange,
}: {
  category: CategoryApplication;
  onChange: (patch: Partial<ScoringInputs>) => void;
}) {
  const inputs = category.scoringInputs;
  const id = category.id;
  const years = yearsBetween(inputs.alumniStartDate, inputs.alumniEndDate);
  const yearsMarks = Math.min(years * 2, 26);
  const scholarshipMarks = inputs.grade5ScholarshipPassed ? 3 : 0;

  // Sports / co-curricular marks
  const sportsBase = SPORTS_LEVEL_MARKS[inputs.sportsLevel ?? ""] ?? 0;
  const sportsMarks = Math.min(sportsBase * (inputs.sportsCount ?? (sportsBase > 0 ? 1 : 0)), 10);
  const leadershipMarks = LEADERSHIP_ROLE_MARKS[inputs.leadershipRole ?? ""] ?? 0;
  const studentSocietiesMarks = STUDENT_SOCIETIES_ROLE_MARKS[inputs.studentSocietiesRole ?? ""] ?? 0;
  const otherActivityMarks = OTHER_ACTIVITY_MARKS[inputs.otherActivity ?? ""] ?? 0;

  // Past Pupils' Association marks
  let pastPupilsMarks = 0;
  if (inputs.pastPupilsLifeMember) pastPupilsMarks += 10;
  else if (inputs.pastPupilsMembershipStart && inputs.pastPupilsMembershipEnd) {
    const years = yearsBetween(inputs.pastPupilsMembershipStart, inputs.pastPupilsMembershipEnd);
    pastPupilsMarks += Math.min(years * 0.5, 10);
  }
  if (inputs.pastPupilsCommitteeMember) pastPupilsMarks += 1;
  if (inputs.pastPupilsExecutiveOffice) pastPupilsMarks += 3;
  pastPupilsMarks = Math.min(pastPupilsMarks, 10);

  // Degree marks
  const degreeMarks = DEGREE_MARKS[inputs.highestDegree ?? ""] ?? 0;
  const diplomaMarks = inputs.hasDiploma ? 2 : 0;

  // Contribution marks
  let contributionMarks = 0;
  if (inputs.sportsMeetContribution) contributionMarks += 0.5;
  if (inputs.shramadanaContribution) contributionMarks += 0.5;
  contributionMarks = Math.min(contributionMarks, 2);
  const projectMarks = inputs.schoolProjectsContribution ? 5 : 0;

  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      {/* Years educated */}
      <div className="grid gap-1.5 col-span-2 max-md:col-span-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Years educated at this school</span>
          <MarkBadge marks={yearsMarks} max={26} hint={"2 marks per year, max 13 years.\n\nCurrent: " + Math.floor(years) + " years = " + yearsMarks + " marks"} />
        </div>
        <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
          <DateField
            id={`alumni-start-${id}`}
            label="Date started at this school"
            hint="When did the parent start attending St. Aloysius?"
            value={inputs.alumniStartDate}
            onChange={(alumniStartDate) => onChange({ alumniStartDate })}
          />
          <DateField
            id={`alumni-end-${id}`}
            label="Date left this school"
            hint="When did the parent leave St. Aloysius?"
            value={inputs.alumniEndDate}
            onChange={(alumniEndDate) => onChange({ alumniEndDate })}
          />
        </div>
      </div>

      {/* Grade 5 Scholarship */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Grade 5 Scholarship</span>
          <MarkBadge marks={scholarshipMarks} max={3} hint={"Passed = 3 marks\nNot passed = 0 marks"} />
        </div>
        <label className="mt-1 flex items-center gap-2 self-end text-sm">
          <Checkbox
            className="size-4"
            checked={inputs.grade5ScholarshipPassed === true}
            onCheckedChange={(checked) => onChange({ grade5ScholarshipPassed: checked === true })}
          />
          Passed Grade 5 Scholarship Examination
        </label>
      </div>

      {/* G.C.E. (O/L) */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">G.C.E. (O/L) result</span>
          <MarkBadge marks={(() => { let m = 0; const c = inputs.olSubjectCount; const t = c != null ? OL_CEILINGS[c] : undefined; if (t && c != null) { for (const g of ["S","C","B","A"]) { m += (inputs[`olGrade${g}` as "olGradeS"] ?? 0) * gradeRate(t, c, g); } } return Math.min(m, 10); })()} max={10} hint={"Marks per subject by grade:\n• S: varies by subject count\n• C: varies by subject count\n• B/D: varies by subject count\n• A: 9 subjects only\n\nMax 10 marks"} />
        </div>
        <CountSelect
          id={`ol-subject-count-${id}`}
          label="Number of subjects"
          value={inputs.olSubjectCount}
          options={OL_SUBJECT_OPTIONS}
          placeholder="Select O/L subject count"
          onChange={(olSubjectCount) => onChange({ olSubjectCount })}
        />
        {inputs.olSubjectCount != null && (
          <GradeCounts
            category={category}
            prefix="ol"
            grades={inputs.olSubjectCount === 9 ? ["S", "C", "B", "A"] : ["S", "C", "B"]}
            totalCount={inputs.olSubjectCount}
            onChange={onChange}
          />
        )}
      </div>

      {/* G.C.E. (A/L) */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">G.C.E. (A/L) result</span>
          <MarkBadge marks={(() => { let m = 0; const c = inputs.alSubjectCount; const t = c != null ? AL_CEILINGS[c] : undefined; if (t && c != null) { for (const g of ["S","C","B","A"]) { m += (inputs[`alGrade${g}` as "alGradeS"] ?? 0) * gradeRate(t, c, g); } } return Math.min(m, 12); })()} max={12} hint={"Marks per subject by grade:\n• S: 2.00 (3 subj) / 1.50 (4 subj)\n• C: 2.66 (3 subj) / 2.00 (4 subj)\n• B: 3.33 (3 subj) / 2.50 (4 subj)\n• A: 4.00 (3 subj) / 3.00 (4 subj)\n\nMax 12 marks"} />
        </div>
        <CountSelect
          id={`al-subject-count-${id}`}
          label="Number of subjects"
          value={inputs.alSubjectCount}
          options={AL_SUBJECT_OPTIONS}
          placeholder="Select A/L subject count"
          onChange={(alSubjectCount) => onChange({ alSubjectCount })}
        />
        {inputs.alSubjectCount != null && (
          <GradeCounts category={category} prefix="al" grades={["S", "C", "B", "A"]} totalCount={inputs.alSubjectCount} onChange={onChange} />
        )}
      </div>

      {/* Sports / co-curricular */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Sports / co-curricular</span>
          <MarkBadge marks={sportsMarks} max={10} hint={"Marks per achievement by level:\n• Inter-House: 0.5\n• Zonal: 1\n• District: 2\n• Provincial: 3\n• National: 4.75\n• International: 5\n\nMultiply by count, max 10"} />
        </div>
        <StringSelect
          id={`sports-level-${id}`}
          label="Highest level"
          value={inputs.sportsLevel}
          options={SPORTS_LEVEL_OPTIONS}
          placeholder="Select highest level"
          onChange={(sportsLevel) => onChange({ sportsLevel })}
        />
        <NumberField
          id={`sports-count-${id}`}
          label="Achievements at that level"
          value={inputs.sportsCount}
          onChange={(sportsCount) => onChange({ sportsCount })}
        />
      </div>

      {/* Leadership role */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Leadership role</span>
          <MarkBadge marks={leadershipMarks} max={5} hint={"Marks by role:\n• Primary Student Prefect: 1\n• Junior Student Prefect: 1.5\n• Senior Student Prefect: 3\n• Deputy Head Prefect: 4\n• Head Prefect: 5\n• First Team Vice-Captain: 1.5\n• First Team Captain: 2\n\nMax 5 marks"} />
        </div>
        <StringSelect
          id={`leadership-role-${id}`}
          label="Highest role held"
          value={inputs.leadershipRole}
          options={LEADERSHIP_ROLE_OPTIONS}
          placeholder="Select leadership role"
          onChange={(leadershipRole) => onChange({ leadershipRole })}
        />
      </div>

      {/* Student Societies */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Student Societies</span>
          <MarkBadge marks={studentSocietiesMarks} max={5} hint={"Marks by role:\n• Committee Member: 0.5\n• Vice President / Vice Secretary / Vice Treasurer: 0.75\n• President / Secretary / Treasurer: 1\n\nMax 5 marks"} />
        </div>
        <StringSelect
          id={`student-societies-role-${id}`}
          label="Highest role held"
          value={inputs.studentSocietiesRole}
          options={STUDENT_SOCIETIES_ROLE_OPTIONS}
          placeholder="Select society role"
          onChange={(studentSocietiesRole) => onChange({ studentSocietiesRole })}
        />
      </div>

      {/* Other Activities */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Other Activities</span>
          <MarkBadge marks={otherActivityMarks} max={5} hint={"Marks by activity:\n• Junior Band Leader: 2\n• Junior Band Member: 1\n• Senior Band Leader: 2\n• Senior Band Member: 1\n• Scout Leader: 2\n• Scout Member: 1\n• Cub Scout: 1\n• Cadet Team Leader: 2\n• Cadet Team Member: 1\n• Debating Team Leader: 2\n• Debating Team Member: 1\n• St. John Ambulance Leader: 2\n• St. John Ambulance Member: 1\n• Other: 1\n\nMax 5 marks"} />
        </div>
        <StringSelect
          id={`other-activity-${id}`}
          label="Activity"
          value={inputs.otherActivity}
          options={OTHER_ACTIVITY_OPTIONS}
          placeholder="Select activity"
          onChange={(otherActivity) => onChange({ otherActivity })}
        />
        {inputs.otherActivity === "other" && (
          <Field>
            <FieldLabel htmlFor={`other-activity-name-${id}`}>Specify activity</FieldLabel>
            <Input
              id={`other-activity-name-${id}`}
              type="text"
              value={inputs.otherActivityName ?? ""}
              placeholder="Enter activity name"
              onChange={(event) => onChange({ otherActivityName: event.target.value || undefined })}
            />
          </Field>
        )}
      </div>

      {/* Past Pupils' Association */}
      <div className="grid gap-1.5 col-span-2 max-md:col-span-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Past Pupils' Association</span>
          <MarkBadge marks={pastPupilsMarks} max={10} hint={(() => {
            const start = inputs.pastPupilsMembershipStart;
            const end = inputs.pastPupilsMembershipEnd;
            const years = (start && end) ? yearsBetween(start, end).toFixed(1) : "0";
            const yearMarks = (parseFloat(years) * 0.5).toFixed(1);
            return `Life Membership: +10 marks\nOR Membership period: 0.5 × ${years} yrs = ${yearMarks} marks (max 10)\n\nCommittee Membership: +1 mark (0.25 × 4 yrs, max 3)\nExecutive Office Post: +3 marks (1.5 × 2, max 3)\n\nMax total: 10 marks`;
          })()} />
        </div>
        <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              className="size-4"
              checked={inputs.pastPupilsLifeMember === true}
              onCheckedChange={(checked) => onChange({ pastPupilsLifeMember: checked === true })}
            />
            Life Membership
          </label>
          <DateField
            id={`past-pupils-start-${id}`}
            label="Membership start date"
            hint="When did the parent join the Past Pupils' Association?"
            value={inputs.pastPupilsMembershipStart}
            onChange={(pastPupilsMembershipStart) => onChange({ pastPupilsMembershipStart })}
          />
          <DateField
            id={`past-pupils-end-${id}`}
            label="Membership end date"
            hint="When did the parent's membership end (or current date if still a member)?"
            value={inputs.pastPupilsMembershipEnd}
            onChange={(pastPupilsMembershipEnd) => onChange({ pastPupilsMembershipEnd })}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              className="size-4"
              checked={inputs.pastPupilsCommitteeMember === true}
              onCheckedChange={(checked) => onChange({ pastPupilsCommitteeMember: checked === true })}
            />
            Committee Membership
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              className="size-4"
              checked={inputs.pastPupilsExecutiveOffice === true}
              onCheckedChange={(checked) => onChange({ pastPupilsExecutiveOffice: checked === true })}
            />
            Executive Office Post
          </label>
        </div>
      </div>

      {/* University Degrees */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">University Degrees (UGC)</span>
          <MarkBadge marks={degreeMarks} max={5} hint={"Marks by qualification:\n• First degree (UGC approved): 3\n• Postgraduate Degree: 4\n• Doctorate (Ph.D.): 5\n• Chartered Professional / NVQ 7: 3\n\nMax 5 marks"} />
        </div>
        <StringSelect
          id={`highest-degree-${id}`}
          label="Highest qualification"
          value={inputs.highestDegree}
          options={DEGREE_OPTIONS}
          placeholder="Select highest degree"
          onChange={(highestDegree) => onChange({ highestDegree })}
        />
      </div>

      {/* Diploma */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Diploma / Higher Diploma</span>
          <MarkBadge marks={diplomaMarks} max={2} hint={"Diploma / Higher Diploma / NVQ 5, 6\n(More than 2 years): 2 marks\n\nOtherwise: 0 marks"} />
        </div>
        <label className="mt-1 flex items-center gap-2 self-end text-sm">
          <Checkbox
            className="size-4"
            checked={inputs.hasDiploma === true}
            onCheckedChange={(checked) => onChange({ hasDiploma: checked === true })}
          />
          Diploma / Higher Diploma / NVQ 5, 6 (more than 2 years)
        </label>
      </div>

      {/* Contribution to School Activities */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Contribution to School Activities</span>
          <MarkBadge marks={contributionMarks} max={2} hint={"Sports Meet: 0.5 marks\nShramadana (Community Service): 0.5 marks\n\nMax 2 marks"} />
        </div>
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              className="size-4"
              checked={inputs.sportsMeetContribution === true}
              onCheckedChange={(checked) => onChange({ sportsMeetContribution: checked === true })}
            />
            Sports Meet
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              className="size-4"
              checked={inputs.shramadanaContribution === true}
              onCheckedChange={(checked) => onChange({ shramadanaContribution: checked === true })}
            />
            Shramadana (Community Service)
          </label>
        </div>
      </div>

      {/* Contribution to School Projects */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Contribution to School Projects</span>
          <MarkBadge marks={projectMarks} max={5} hint={"Contributed to school projects:\n5 marks\n\nOtherwise: 0 marks"} />
        </div>
        <label className="mt-1 flex items-center gap-2 self-end text-sm">
          <Checkbox
            className="size-4"
            checked={inputs.schoolProjectsContribution === true}
            onCheckedChange={(checked) => onChange({ schoolProjectsContribution: checked === true })}
          />
          Contributed to school projects
        </label>
      </div>
    </div>
  );
}

function Category63Fields({
  category,
  onChange,
}: {
  category: CategoryApplication;
  onChange: (patch: Partial<ScoringInputs>) => void;
}) {
  const inputs = category.scoringInputs;
  const id = category.id;
  const siblingsMarks = Math.min((inputs.siblingsCurrentlyStudyingCount ?? 0) * 2, 20);
  const studiedHereMarks = inputs.siblingStudiedAtAppliedSchool ? 5 : 0;
  const multipleApplyingMarks = inputs.twoOrMoreSiblingsApplying ? 5 : 0;
  const prefectMarks = Math.min((SIBLING_PREFECT_LEVEL_MARKS[inputs.siblingPrefectLevel ?? ""] ?? 0) * (inputs.siblingPrefectCount ?? 0), 2);
  const examMarks = Math.min(SIBLING_EXAM_MARKS[inputs.siblingExamAchievement ?? ""] ?? 0, 2);
  const praiseworthyMarks = inputs.siblingPraiseworthyAchievement ? 2 : 0;
  const supportMarks = inputs.parentsSupportRendered ? 4 : 0;
  const cocurricularTotal = Math.min(prefectMarks + examMarks + praiseworthyMarks + supportMarks, 10);
  const documentMarks = Math.min(MAIN_DOCUMENT_MARKS_63[inputs.mainDocumentType ?? ""] ?? 0, 10);
  const mother = inputs.electoralMotherSince ? Math.min(5, 2025 - inputs.electoralMotherSince) : 0;
  const father = inputs.electoralFatherSince ? Math.min(5, 2025 - inputs.electoralFatherSince) : 0;
  const electoralMarks = Math.min((mother + father) * 2, 20);
  const prox = proximityMarks61(inputs);
  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Siblings currently studying</span>
          <MarkBadge marks={siblingsMarks} max={20} hint={"2 marks per sibling, max 10.\n\nCurrent: " + (inputs.siblingsCurrentlyStudyingCount ?? 0) + " sibling(s) = " + siblingsMarks + " marks"} />
        </div>
        <NumberField
          id={`siblings-count-${id}`}
          label="Number of siblings"
          value={inputs.siblingsCurrentlyStudyingCount}
          onChange={(siblingsCurrentlyStudyingCount) => onChange({ siblingsCurrentlyStudyingCount })}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Sibling studied at applied school</span>
          <MarkBadge marks={studiedHereMarks} max={5} hint={"If sibling studied at St. Aloysius:\n5 marks\n\nOtherwise: 0 marks"} />
        </div>
        <label className="mt-1 flex items-center gap-2 self-end text-sm">
          <Checkbox
            className="size-4"
            checked={inputs.siblingStudiedAtAppliedSchool === true}
            onCheckedChange={(checked) => onChange({ siblingStudiedAtAppliedSchool: checked === true })}
          />
          Applying to the school where the sibling studied
        </label>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Two or more siblings applying</span>
          <MarkBadge marks={multipleApplyingMarks} max={5} hint={"If 2+ siblings applying to same school:\n5 marks\n\nOtherwise: 0 marks"} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            className="size-4"
            checked={inputs.twoOrMoreSiblingsApplying === true}
            onCheckedChange={(checked) => onChange({ twoOrMoreSiblingsApplying: checked === true })}
          />
          Two or more siblings applying to other grades of the same school
        </label>
      </div>
      <div className="grid gap-1.5 col-span-2 max-md:col-span-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Sibling co-curricular &amp; prefect</span>
          <MarkBadge marks={cocurricularTotal} max={10} hint={"Prefect skill: 0.25–2 per achievement\nExam: 0.5 (scholarship) / 1 (O/L) / 1.5 (A/L)\nPraiseworthy: 2\nParent support: 4\n\nMax 10 marks"} />
        </div>
        <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
          <StringSelect
            id={`sibling-prefect-level-${id}`}
            label="Sibling prefect skill level"
            value={inputs.siblingPrefectLevel}
            options={SPORTS_LEVEL_OPTIONS}
            placeholder="Select highest level"
            onChange={(siblingPrefectLevel) => onChange({ siblingPrefectLevel })}
          />
          <NumberField
            id={`sibling-prefect-count-${id}`}
            label="Achievements at that level"
            value={inputs.siblingPrefectCount}
            onChange={(siblingPrefectCount) => onChange({ siblingPrefectCount })}
          />
          <StringSelect
            id={`sibling-exam-${id}`}
            label="Sibling examination achievement"
            value={inputs.siblingExamAchievement}
            options={SIBLING_EXAM_OPTIONS}
            placeholder="Select achievement"
            onChange={(siblingExamAchievement) => onChange({ siblingExamAchievement })}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              className="size-4"
              checked={inputs.siblingPraiseworthyAchievement === true}
              onCheckedChange={(checked) => onChange({ siblingPraiseworthyAchievement: checked === true })}
            />
            Praiseworthy achievement (Prefect / Student Leader / Band Leader)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              className="size-4"
              checked={inputs.parentsSupportRendered === true}
              onCheckedChange={(checked) => onChange({ parentsSupportRendered: checked === true })}
            />
            Support rendered by parents
          </label>
        </div>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Residence document</span>
          <MarkBadge marks={documentMarks} max={10} hint={"Document marks (max 10):\n• Title deed – applicant/spouse: 10\n• Title deed – parents: 6\n• Feeder electoral 5yr: 6\n• Lease deed: 4\n• Municipal/DS/Rent Act: 4\n• Other documents: 2"} />
        </div>
        <DocumentTypeSelect category={category} onChange={onChange} options={SIBLING_DOCUMENT_OPTIONS} />
      </div>
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Electoral register</span>
          </div>
          <ElectoralYearSelect
            id={`electoral-mother-year-${id}`}
            label="Year mother first registered"
            hint="2 marks per year registered (2020–2024). Combined with father, max 20 marks."
            value={inputs.electoralMotherSince}
            onChange={(electoralMotherSince) => onChange({ electoralMotherSince })}
          />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Electoral register</span>
          </div>
          <ElectoralYearSelect
            id={`electoral-father-year-${id}`}
            label="Year father first registered"
            hint="2 marks per year registered (2020–2024). Combined with mother, max 20 marks."
            value={inputs.electoralFatherSince}
            onChange={(electoralFatherSince) => onChange({ electoralFatherSince })}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 border-t pt-3">
        <span className="text-sm font-medium">Electoral register total</span>
        <MarkBadge marks={electoralMarks} max={20} hint={"2 marks per person-year.\n\nMother + father combined,\nmax 5 years each = 20 marks.\n\nExample: Both 5 years = 20"} />
      </div>
      <div className="grid gap-1.5 border-t pt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Nearby schools</span>
          <MarkBadge marks={prox} max={30} hint={"Max 30 marks.\nDeduct 3 per school within radius\n(excluding St. Aloysius).\n\nNo other schools = 30 marks\n10 schools = 0 marks"} />
        </div>
      </div>
    </div>
  );
}

function Category64Fields({
  category,
  onChange,
}: {
  category: CategoryApplication;
  onChange: (patch: Partial<ScoringInputs>) => void;
}) {
  const inputs = category.scoringInputs;
  const serviceMarks = Math.min(yearsFromDate(inputs.serviceStartDate), 20);
  let difficultMarks = 0;
  if (inputs.difficultServiceType === "current") {
    difficultMarks = 25;
  } else if (inputs.difficultServiceType === "previous") {
    const previousBase = 15;
    let distance = 0;
    const km = inputs.difficultServiceDistanceKm;
    if (km != null && km >= 150) distance = 15;
    else if (km != null && km > 100) distance = 10;
    else if (km != null && km > 75) distance = 5;
    difficultMarks = Math.max(previousBase, distance) + (inputs.difficultServiceExtraPeriods ?? 0) * 0.5;
  }
  difficultMarks = Math.min(difficultMarks, 25);
  const leaveMarks = Math.min((inputs.unutilizedLeaveYears ?? 0) * 2, 10);
  const locationMap: Record<string, number> = { "same-school": 10, zone: 7.5, province: 5, "education-institution": 2.5 };
  const locationMarks = Math.min(locationMap[inputs.serviceLocationLevel ?? ""] ?? 0, 10);
  const resKm = inputs.residenceToSchoolKm;
  let residenceDistance = 4;
  if (resKm != null && resKm <= 1) residenceDistance = 10;
  else if (resKm != null && resKm <= 3) residenceDistance = 8;
  else if (resKm != null && resKm <= 5) residenceDistance = 6;
  const workKm = inputs.workplaceToSchoolKm;
  let workplaceDistance = 5;
  if (workKm != null && workKm >= 100) workplaceDistance = 25;
  else if (workKm != null && workKm >= 70) workplaceDistance = 20;
  else if (workKm != null && workKm >= 40) workplaceDistance = 15;
  else if (workKm != null && workKm >= 20) workplaceDistance = 10;
  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Period of service</span>
          <MarkBadge marks={serviceMarks} max={20} hint={"1 mark per year of service, max 20.\n\nCurrent: " + Math.floor(yearsFromDate(inputs.serviceStartDate)) + " years = " + serviceMarks + " marks"} />
        </div>
        <DateField
          id={`service-start-${category.id}`}
          label="Date of first appointment"
          hint="When did the parent start their teaching service?"
          value={inputs.serviceStartDate}
          onChange={(serviceStartDate) => onChange({ serviceStartDate })}
        />
      </div>
      <div className="grid gap-1.5 col-span-2 max-md:col-span-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Difficult service</span>
          <MarkBadge marks={difficultMarks} max={25} hint={"Current school: 25 marks\nPrevious school: max(15, distance bonus) + extra periods\n\nDistance bonus:\n• 150+ km: 15\n• 100–150 km: 10\n• 75–100 km: 5\n\n+0.5 per extra period of 6 months"} />
        </div>
        <Field>
          <FieldLabel>Type of difficult service</FieldLabel>
          <RadioGroup
            value={inputs.difficultServiceType ?? ""}
            onValueChange={(next) => onChange({ difficultServiceType: next as ScoringInputs["difficultServiceType"] })}
            className="flex flex-wrap gap-x-6 gap-y-2"
          >
            <RadioOption id={`dst-current-${category.id}`} value="current" label="Current school" />
            <RadioOption id={`dst-previous-${category.id}`} value="previous" label="Previous school" />
            <RadioOption id={`dst-none-${category.id}`} value="none" label="None" />
          </RadioGroup>
        </Field>
        {inputs.difficultServiceType === "previous" && (
          <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
            <NumberField
              id={`difficult-distance-${category.id}`}
              label="Distance to previous difficult service school (km)"
              value={inputs.difficultServiceDistanceKm}
              onChange={(difficultServiceDistanceKm) => onChange({ difficultServiceDistanceKm })}
            />
            <NumberField
              id={`difficult-periods-${category.id}`}
              label="Extra periods served (count)"
              value={inputs.difficultServiceExtraPeriods}
              onChange={(difficultServiceExtraPeriods) => onChange({ difficultServiceExtraPeriods })}
            />
          </div>
        )}
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Unutilized leave</span>
          <MarkBadge marks={leaveMarks} max={10} hint={"2 marks per year of unutilized leave, max 5 years.\n\nCurrent: " + (inputs.unutilizedLeaveYears ?? 0) + " years = " + leaveMarks + " marks"} />
        </div>
        <YearsSelect
          id={`unutilized-leave-${category.id}`}
          label="Years"
          value={inputs.unutilizedLeaveYears}
          onChange={(unutilizedLeaveYears) => onChange({ unutilizedLeaveYears })}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Service location</span>
          <MarkBadge marks={locationMarks} max={10} hint={"Same school: 10\nZone: 7.5\nProvince: 5\nEducation institution: 2.5"} />
        </div>
        <Field>
          <FieldLabel>Service location level</FieldLabel>
          <RadioGroup
            value={inputs.serviceLocationLevel ?? ""}
            onValueChange={(next) => onChange({ serviceLocationLevel: String(next) })}
            className="flex flex-wrap gap-x-6 gap-y-2"
          >
            <RadioOption id={`sll-same-school-${category.id}`} value="same-school" label="Same school" />
            <RadioOption id={`sll-zone-${category.id}`} value="zone" label="Zone" />
            <RadioOption id={`sll-province-${category.id}`} value="province" label="Province" />
            <RadioOption id={`sll-education-institution-${category.id}`} value="education-institution" label="Education institution" />
          </RadioGroup>
        </Field>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Residence to school</span>
          <MarkBadge marks={residenceDistance} max={10} hint={"Within 1 km: 10\n1–3 km: 8\n3–5 km: 6\n>5 km: 4"} />
        </div>
        <NumberField
          id={`residence-to-school-${category.id}`}
          label="Distance (km)"
          value={inputs.residenceToSchoolKm}
          onChange={(residenceToSchoolKm) => onChange({ residenceToSchoolKm })}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Workplace to school</span>
          <MarkBadge marks={workplaceDistance} max={25} hint={"100+ km: 25\n70–100 km: 20\n40–70 km: 15\n20–40 km: 10\n<20 km: 5"} />
        </div>
        <NumberField
          id={`workplace-to-school-${category.id}`}
          label="Distance (km)"
          value={inputs.workplaceToSchoolKm}
          onChange={(workplaceToSchoolKm) => onChange({ workplaceToSchoolKm })}
        />
      </div>
    </div>
  );
}

function Category65Fields({
  category,
  onChange,
}: {
  category: CategoryApplication;
  onChange: (patch: Partial<ScoringInputs>) => void;
}) {
  const inputs = category.scoringInputs;
  const km = inputs.previousWorkplaceDistanceKm;
  let distanceMarks = 0;
  if (km != null && km > 150) distanceMarks = 35;
  else if (km != null && km > 100) distanceMarks = 28;
  else if (km != null && km >= 50) distanceMarks = 21;
  const periodMarks = Math.min(yearsFromDate(inputs.serviceStartDate), 10);
  const prevYears = yearsFromDate(inputs.previousWorkplaceStartDate);
  let previousPeriodMarks = 0;
  if (prevYears >= 3) previousPeriodMarks = 10;
  else if (prevYears >= 2) previousPeriodMarks = 8;
  else if (prevYears >= 1) previousPeriodMarks = 5;
  const elapsed = yearsFromDate(inputs.transferDate);
  let elapsedMarks = 0;
  if (elapsed <= 1) elapsedMarks = 5;
  else if (elapsed <= 2) elapsedMarks = 4;
  else if (elapsed <= 3) elapsedMarks = 3;
  else if (elapsed <= 4) elapsedMarks = 2;
  else if (elapsed <= 5) elapsedMarks = 1;
  const leaveMarks = Math.min((inputs.unutilizedLeaveYears ?? 0) * 2, 10);
  const prox = proximityMarks(inputs, 3, 30);
  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Previous workplace distance</span>
          <MarkBadge marks={distanceMarks} max={35} hint={">150 km: 35\n100–150 km: 28\n50–100 km: 21\n<50 km: 0\n\nMust be ≥50 km"} />
        </div>
        <NumberField
          id={`prev-workplace-distance-${category.id}`}
          label="Distance (km)"
          value={inputs.previousWorkplaceDistanceKm}
          onChange={(previousWorkplaceDistanceKm) => onChange({ previousWorkplaceDistanceKm })}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Period of service</span>
          <MarkBadge marks={periodMarks} max={10} hint={"1 mark per year, max 10.\n\nCurrent: " + Math.floor(yearsFromDate(inputs.serviceStartDate)) + " years = " + periodMarks + " marks"} />
        </div>
        <DateField
          id={`transfer-service-start-${category.id}`}
          label="Date of first appointment"
          hint="When did the parent start their teaching service?"
          value={inputs.serviceStartDate}
          onChange={(serviceStartDate) => onChange({ serviceStartDate })}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Period at previous workplace</span>
          <MarkBadge marks={previousPeriodMarks} max={10} hint={"3+ years: 10\n2–3 years: 8\n1–2 years: 5\n<1 year: 0"} />
        </div>
        <DateField
          id={`prev-workplace-start-${category.id}`}
          label="Date started at previous workplace"
          hint="When did the parent start working at the previous school?"
          value={inputs.previousWorkplaceStartDate}
          onChange={(previousWorkplaceStartDate) => onChange({ previousWorkplaceStartDate })}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Time since transfer</span>
          <MarkBadge marks={elapsedMarks} max={5} hint={"Within 1 year: 5\n1–2 years: 4\n2–3 years: 3\n3–4 years: 2\n4–5 years: 1\n>5 years: 0"} />
        </div>
        <DateField
          id={`transfer-date-${category.id}`}
          label="Date of transfer"
          hint="When was the transfer received?"
          value={inputs.transferDate}
          onChange={(transferDate) => onChange({ transferDate })}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Unutilized leave</span>
          <MarkBadge marks={leaveMarks} max={10} hint={"2 marks per year, max 5 years.\n\nCurrent: " + (inputs.unutilizedLeaveYears ?? 0) + " years = " + leaveMarks + " marks"} />
        </div>
        <YearsSelect
          id={`transfer-unutilized-leave-${category.id}`}
          label="Years"
          value={inputs.unutilizedLeaveYears}
          onChange={(unutilizedLeaveYears) => onChange({ unutilizedLeaveYears })}
        />
      </div>
      <div className="grid gap-1.5 border-t pt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Nearby schools</span>
          <MarkBadge marks={prox} max={30} hint={"Max 30 marks.\nDeduct 3 per school within radius\n(excluding St. Aloysius).\n\nNo other schools = 30 marks\n10 schools = 0 marks"} />
        </div>
      </div>
    </div>
  );
}

function Category66Fields({
  category,
  onChange,
}: {
  category: CategoryApplication;
  onChange: (patch: Partial<ScoringInputs>) => void;
}) {
  const inputs = category.scoringInputs;
  const abroad = yearsBetween(inputs.abroadStartDate, inputs.abroadEndDate);
  let abroadMarks = 0;
  if (abroad >= 3) abroadMarks = 25;
  else if (abroad >= 2) abroadMarks = 15;
  else if (abroad >= 1) abroadMarks = 10;
  const purposeMap: Record<string, number> = { board: 40, personal: 30, government: 25, education: 20 };
  const purposeMarks = Math.min(purposeMap[inputs.employmentPurpose ?? ""] ?? 0, 40);
  const prox = proximityMarks(inputs, 3.5, 35);
  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Period abroad with child</span>
          <MarkBadge marks={abroadMarks} max={25} hint={"Continuous 3+ years: 25\n2–3 years: 15\n1–2 years: 10\n<1 year: 0\n\nMust be 2024.07–2025.06"} />
        </div>
        <DateField
          id={`abroad-start-${category.id}`}
          label="Date left Sri Lanka"
          hint="When did the parent leave for foreign employment?"
          value={inputs.abroadStartDate}
          onChange={(abroadStartDate) => onChange({ abroadStartDate })}
        />
        <DateField
          id={`abroad-end-${category.id}`}
          label="Date returned to Sri Lanka"
          hint="When did the parent return?"
          value={inputs.abroadEndDate}
          onChange={(abroadEndDate) => onChange({ abroadEndDate })}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Employment purpose</span>
          <MarkBadge marks={purposeMarks} max={40} hint={"Board duties: 40\nPersonal: 30\nGovernment: 25\nEducation: 20\n\nMin 2 years abroad"} />
        </div>
        <Field>
          <FieldLabel>Purpose of foreign employment</FieldLabel>
          <RadioGroup
            value={inputs.employmentPurpose ?? ""}
            onValueChange={(next) => onChange({ employmentPurpose: next as ScoringInputs["employmentPurpose"] })}
            className="flex flex-wrap gap-x-6 gap-y-2"
          >
            <RadioOption id={`ep-board-${category.id}`} value="board" label="Board" />
            <RadioOption id={`ep-personal-${category.id}`} value="personal" label="Personal" />
            <RadioOption id={`ep-government-${category.id}`} value="government" label="Government" />
            <RadioOption id={`ep-education-${category.id}`} value="education" label="Education" />
          </RadioGroup>
        </Field>
      </div>
      <div className="grid gap-1.5 border-t pt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Nearby schools</span>
          <MarkBadge marks={prox} max={35} hint={"Max 35 marks.\nDeduct 3.5 per school within radius\n(excluding St. Aloysius).\n\nNo other schools = 35 marks\n10 schools = 0 marks"} />
        </div>
      </div>
    </div>
  );
}

function CategoryLockedSummary({ category }: { category: CategoryApplication }) {
  const score = scoreCategory(category);
  return (
    <div className="grid gap-3 text-sm">
      {score.breakdown.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">{row.label}</span>
          <span className="font-mono tabular-nums">
            {row.marks.toLocaleString(undefined, { maximumFractionDigits: 2 })} / {row.max}
          </span>
        </div>
      ))}
    </div>
  );
}

function CategoryCard({
  category,
  occurrence,
  centerLat,
  centerLng,
  onUpdate,
  onRemove,
}: {
  category: CategoryApplication;
  occurrence?: number;
  centerLat?: number;
  centerLng?: number;
  onUpdate: (patch: Partial<ScoringInputs>) => void;
  onRemove: () => void;
}) {
  const draft = useApplicationStore();
  const selectedSchoolIds = category.scoringInputs.schoolsWithinRadius ?? [];
  const score = scoreCategory(category);
  const hasCenter = centerLat != null && centerLng != null;
  const locked = category.locked;
  return (
    <Card className={locked ? "border-muted bg-muted/30" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {CATEGORY_LABELS[category.categoryType]}
          {occurrence != null && (
            <span className="text-muted-foreground font-normal"> – entry {occurrence}</span>
          )}
          {locked && <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Locked</span>}
        </CardTitle>
        <CardAction className="flex gap-1">
          <Button
            type="button"
            variant={locked ? "default" : "ghost"}
            size="sm"
            onClick={() => draft.updateCategoryInputs(category.id, { locked: !locked } as Partial<ScoringInputs>)}
          >
            {locked ? "Edit" : "Lock"}
          </Button>
          {!locked && (
            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onRemove}>
              Remove
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-5">
        {locked ? (
          <CategoryLockedSummary category={category} />
        ) : (
          <>
            {category.categoryType === "6.1" && <Category61Fields category={category} onChange={onUpdate} />}
            {category.categoryType === "6.2" && <Category62Fields category={category} onChange={onUpdate} />}
            {category.categoryType === "6.3" && <Category63Fields category={category} onChange={onUpdate} />}
            {category.categoryType === "6.4" && <Category64Fields category={category} onChange={onUpdate} />}
            {category.categoryType === "6.5" && <Category65Fields category={category} onChange={onUpdate} />}
            {category.categoryType === "6.6" && <Category66Fields category={category} onChange={onUpdate} />}
          </>
        )}
        {hasCenter && (category.categoryType === "6.1" || category.categoryType === "6.3") ? (
          <div className="grid gap-2 border-t pt-5">
            <p className="text-sm font-medium">Nearby schools</p>
            <p className="text-sm text-muted-foreground">
              Select the schools within reach of the home location. Choices apply to this category&apos;s proximity scoring.
            </p>
            {locked ? (
              <p className="text-sm text-muted-foreground">
                {selectedSchoolIds.length > 0
                  ? `${selectedSchoolIds.length} school(s) selected`
                  : "No schools selected"}
              </p>
            ) : (
              <SchoolMapPicker
                centerLat={centerLat}
                centerLng={centerLng}
                selectedIds={selectedSchoolIds}
                highlightSchoolId="st-aloysius-galle"
                marksPerSchool={category.categoryType === "6.1" ? 5 : category.categoryType === "6.3" ? 3 : category.categoryType === "6.5" ? 3 : category.categoryType === "6.6" ? 3.5 : 5}
                onToggle={(schoolId) =>
                  onUpdate({
                    schoolsWithinRadius: selectedSchoolIds.includes(schoolId)
                      ? selectedSchoolIds.filter((existing) => existing !== schoolId)
                      : [...selectedSchoolIds, schoolId],
                  })
                }
              />
            )}
          </div>
        ) : (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            Complete the location step to choose nearby schools for this category.
          </p>
        )}
        <div className="grid gap-2 border-t pt-5">
          <p className="text-sm font-medium">Example marks – {CATEGORY_LABELS[category.categoryType]}</p>
          <div className="grid gap-1">
            {score.breakdown.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-mono tabular-nums">
                  {row.marks.toLocaleString(undefined, { maximumFractionDigits: 2 })} / {row.max}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t pt-2 text-base font-semibold">
            <span>Indicative total</span>
            <span className="font-mono tabular-nums">{score.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} / 100</span>
          </div>
          <p className="text-xs text-muted-foreground">
            This is a baseline estimate calculated from your answers. The interview panel checks your original
            documents and may adjust these marks at the interview.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CategoryStep() {
  const draft = useApplicationStore();
  const { latitude, longitude } = draft.selectedLocation;

  const categoriesByType = new Map<CategoryType, CategoryApplication[]>();
  for (const cat of draft.categories) {
    const list = categoriesByType.get(cat.categoryType) ?? [];
    list.push(cat);
    categoriesByType.set(cat.categoryType, list);
  }

  const firstTypeWithEntries = CATEGORY_TYPES.find((t) => (categoriesByType.get(t)?.length ?? 0) > 0) ?? CATEGORY_TYPES[0];

  return (
    <div className="grid gap-6 max-w-[860px]">
      <div className="mb-1">
        <h3 className="font-heading text-2xl">Marking scheme categories</h3>
        <p className="text-sm text-muted-foreground">
          Add every circular category that applies to your application. A category can be added more than once, for
          example one entry per parent&apos;s service record, and each entry lists the schools near the home location.
        </p>
      </div>

      <Tabs defaultValue={firstTypeWithEntries}>
        <TabsList className="flex-wrap h-auto gap-1">
          {CATEGORY_TYPES.map((type) => {
            const count = categoriesByType.get(type)?.length ?? 0;
            return (
              <TabsTrigger key={type} value={type} className="text-xs">
                {TAB_LABELS[type]}{count > 0 ? ` (${count})` : ""}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {CATEGORY_TYPES.map((type) => {
          const entries = categoriesByType.get(type) ?? [];
          return (
            <TabsContent key={type} value={type} className="grid gap-4 mt-4">
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => draft.addCategory(type)}
              >
                + Add {CATEGORY_LABELS[type]}
              </Button>

              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-lg border p-4">
                  No entries added yet. Click the button above to add one.
                </p>
              ) : (
                <div className="grid gap-5">
                  {entries.map((category, idx) => {
                    const occurrence =
                      entries.length > 1
                        ? entries.slice(0, idx + 1).length
                        : undefined;
                    return (
                      <CategoryCard
                        key={category.id}
                        category={category}
                        occurrence={occurrence}
                        centerLat={latitude ?? undefined}
                        centerLng={longitude ?? undefined}
                        onUpdate={(patch) => draft.updateCategoryInputs(category.id, patch)}
                        onRemove={() => draft.removeCategory(category.id)}
                      />
                    );
                  })}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
