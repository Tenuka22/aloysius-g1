import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DropdownProps } from "react-day-picker";
import { Calendar } from "@aloysius-g1/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@aloysius-g1/ui/components/popover";
import {
  CATEGORY_TYPES,
  type CategoryApplication,
  type CategoryType,
  type ScoringInputs,
  useApplicationStore,
} from "@/lib/application-store";
import { STATUS_ERROR, MARK_TOOLTIP, CATEGORY_COLORS } from "@/lib/color-classes";
import { compatibleSchoolsWithinRadius } from "@/lib/school-utils";
import { HOME_SCHOOL_ID, getHomeSchoolDisplayName } from "@/lib/school-config";
import {
  CATEGORY_MAX_MARKS,
  MAIN_DOCUMENT_MAX_61,
  ADDITIONAL_DOC_MAX_61,
  ELECTORAL_MAX_61,
  PROXIMITY_PER_SCHOOL_61,
  PROXIMITY_MAX_61,
  YEARS_EDUCATED_MARKS_PER_YEAR,
  YEARS_EDUCATED_MAX,
  GRADE5_SCHOLARSHIP_MARKS,
  SPORTS_MAX,
  LEADERSHIP_MAX,
  STUDENT_SOCIETIES_MAX,
  OTHER_ACTIVITIES_MAX,
  PAST_PUPILS_LIFE_MEMBER_MARKS,
  PAST_PUPILS_YEARLY_MARKS,
  PAST_PUPILS_MEMBERSHIP_MAX,
  PAST_PUPILS_TOTAL_MAX,
  DEGREE_MAX,
  DIPLOMA_MARKS,
  SPORTS_MEET_CONTRIBUTION,
  SHRAMADANA_CONTRIBUTION,
  CONTRIBUTION_MAX,
  SCHOOL_PROJECTS_MARKS,
  SIBLING_MARKS_PER_SIBLING,
  SIBLING_STUDYING_MAX,
  SIBLING_STUDIED_HERE_MARKS,
  SIBLING_MULTIPLE_APPLYING_MARKS,
  SIBLING_PREFECT_MAX,
  SIBLING_EXAM_MAX,
  SIBLING_PRAISEWORTHY_MARKS,
  SIBLING_SUPPORT_MARKS,
  SIBLING_COCURRICULAR_TOTAL_MAX,
  MAIN_DOCUMENT_MAX_63,
  ELECTORAL_MARKS_PER_PERSON_YEAR_63,
  ELECTORAL_MAX_63,
  PROXIMITY_PER_SCHOOL_63,
  PROXIMITY_MAX_63,
  SERVICE_PERIOD_MAX,
  DIFFICULT_SERVICE_CURRENT_MARKS,
  DIFFICULT_SERVICE_PREVIOUS_BASE,
  DIFFICULT_SERVICE_MAX,
  DIFFICULT_EXTRA_PERIOD_MARKS,
  UNUTILIZED_LEAVE_MARKS_PER_YEAR,
  UNUTILIZED_LEAVE_MAX,
  SERVICE_LOCATION_MARKS,
  SERVICE_LOCATION_MAX,
  RESIDENCE_DISTANCE_TIERS_64,
  RESIDENCE_DISTANCE_FALLBACK_64,
  RESIDENCE_DISTANCE_MAX_64,
  WORKPLACE_DISTANCE_MAX,
  TRANSFER_DISTANCE_MAX,
  TRANSFER_SERVICE_PERIOD_MAX,
  TRANSFER_PREVIOUS_PERIOD_MAX,
  TRANSFER_ELAPSED_MAX,
  PROXIMITY_PER_SCHOOL_65,
  PROXIMITY_MAX_65,
  ABROAD_PERIOD_MAX,
  EMPLOYMENT_PURPOSE_MARKS,
  EMPLOYMENT_PURPOSE_MAX,
  PROXIMITY_PER_SCHOOL_66,
  PROXIMITY_MAX_66,
} from "@/lib/marking-scheme";
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
import {
  scoreCategory,
  documentMarks61,
  additionalDocsMarks61,
  electoralMarks61,
  proximityMarks61,
  proximityMarks,
  yearsFromDate,
  yearsBetween,
  deedAgeWeight,
  MAIN_DOCUMENT_MARKS_61,
  OL_CEILINGS,
  AL_CEILINGS,
  gradeRate,
  SPORTS_LEVEL_MARKS,
  LEADERSHIP_ROLE_MARKS,
  SIBLING_PREFECT_LEVEL_MARKS,
  SIBLING_EXAM_MARKS,
  MAIN_DOCUMENT_MARKS_63,
  STUDENT_SOCIETIES_ROLE_MARKS,
  OTHER_ACTIVITY_MARKS,
  DEGREE_MARKS,
  electoralYearsRegistered,
  difficultDistanceMarks,
  workplaceDistanceMarks,
  tieredDistanceMarks,
  transferDistanceMarks,
  previousPeriodMarks as previousPeriodMarksFn,
  transferElapsedMarks as transferElapsedMarksFn,
  abroadPeriodMarks,
} from "@/lib/scoring";
import { Flag } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export type FlagProps = {
  flaggedInputs?: Set<string>;
  onToggleInputFlag?: (key: string) => void;
};

type TFn = ReturnType<typeof useTranslation>["t"];

function getCategoryLabels(t: TFn) {
  return {
    "6.1": t("appForm.categoryLabels.6_1"),
    "6.2": t("appForm.categoryLabels.6_2"),
    "6.3": t("appForm.categoryLabels.6_3"),
    "6.4": t("appForm.categoryLabels.6_4"),
    "6.5": t("appForm.categoryLabels.6_5"),
    "6.6": t("appForm.categoryLabels.6_6"),
  };
}

function getTabLabels(t: TFn) {
  return {
    "6.1": t("category.tabLabels.6_1"),
    "6.2": t("category.tabLabels.6_2"),
    "6.3": t("category.tabLabels.6_3"),
    "6.4": t("category.tabLabels.6_4"),
    "6.5": t("category.tabLabels.6_5"),
    "6.6": t("category.tabLabels.6_6"),
  };
}

function getCategoryMeta(t: TFn) {
  return {
    "6.1": { description: t("category.meta.6_1.description"), maxMarks: CATEGORY_MAX_MARKS },
    "6.2": { description: t("category.meta.6_2.description"), maxMarks: CATEGORY_MAX_MARKS },
    "6.3": { description: t("category.meta.6_3.description"), maxMarks: CATEGORY_MAX_MARKS },
    "6.4": { description: t("category.meta.6_4.description"), maxMarks: CATEGORY_MAX_MARKS },
    "6.5": { description: t("category.meta.6_5.description"), maxMarks: CATEGORY_MAX_MARKS },
    "6.6": { description: t("category.meta.6_6.description"), maxMarks: CATEGORY_MAX_MARKS },
  };
}

// Every discrete choice (radio option / dropdown item) shows how many marks it
// is worth, so applicants can see how marks are allocated before choosing --
// not just after, in a hover-only tooltip.
function markSuffix(t: TFn, marks: number) {
  return t("category.common.marksSuffix", { marks: marks.toLocaleString(undefined, { maximumFractionDigits: 2 }) });
}
function withMarks(options: readonly (readonly [string, string])[], marksMap: Record<string, number>, t: TFn) {
  return options.map(([value, label]) => [value, `${label} \u2014 ${markSuffix(t, marksMap[value] ?? 0)}`] as const);
}

function getMainDocumentOptions(t: TFn) {
  return withMarks([
    ["title-deed-applicant", t("category.mainDocumentOptions.titleDeedApplicant")],
    ["title-deed-parents", t("category.mainDocumentOptions.titleDeedParents")],
    ["feeder-electoral-5yrs", t("category.mainDocumentOptions.feederElectoral5yrs")],
    ["lease-deed", t("category.mainDocumentOptions.leaseDeed")],
    ["municipal-ds-certificate", t("category.mainDocumentOptions.municipalDsCertificate")],
    ["other-documents", t("category.mainDocumentOptions.otherDocuments")],
  ] as const, MAIN_DOCUMENT_MARKS_61, t);
}

function getAdditionalDocOptions(t: TFn) {
  return [
    ["nic", t("category.additionalDocOptions.nic")],
    ["driving-license", t("category.additionalDocOptions.drivingLicense")],
    ["landline-bill", t("category.additionalDocOptions.landlineBill")],
    ["marriage-certificate", t("category.additionalDocOptions.marriageCertificate")],
    ["life-insurance-policy", t("category.additionalDocOptions.lifeInsurancePolicy")],
    ["school-leaving-certificate", t("category.additionalDocOptions.schoolLeavingCertificate")],
    ["child-birth-certificate", t("category.additionalDocOptions.childBirthCertificate")],
    ["vehicle-registration", t("category.additionalDocOptions.vehicleRegistration")],
    ["bank-passbook", t("category.additionalDocOptions.bankPassbook")],
  ] as const;
}

function getOlSubjectOptions(t: TFn) {
  return [
    ["6", t("category.olSubjectOptions.6")],
    ["8", t("category.olSubjectOptions.8")],
    ["9", t("category.olSubjectOptions.9")],
  ] as const;
}

function getAlSubjectOptions(t: TFn) {
  return [
    ["3", t("category.alSubjectOptions.3")],
    ["4", t("category.alSubjectOptions.4")],
  ] as const;
}

function getSportsLevelOptions(t: TFn, marksMap: Record<string, number> = SPORTS_LEVEL_MARKS) {
  return withMarks([
    ["inter-house", t("category.sportsLevelOptions.interHouse")],
    ["zonal", t("category.sportsLevelOptions.zonal")],
    ["district", t("category.sportsLevelOptions.district")],
    ["provincial", t("category.sportsLevelOptions.provincial")],
    ["national", t("category.sportsLevelOptions.national")],
    ["international", t("category.sportsLevelOptions.international")],
  ] as const, marksMap, t);
}

function getLeadershipRoleOptions(t: TFn) {
  return withMarks([
    ["prefect-primary", t("category.leadershipRoleOptions.prefectPrimary")],
    ["prefect-junior", t("category.leadershipRoleOptions.prefectJunior")],
    ["prefect-senior", t("category.leadershipRoleOptions.prefectSenior")],
    ["deputy-head-prefect", t("category.leadershipRoleOptions.deputyHeadPrefect")],
    ["head-prefect", t("category.leadershipRoleOptions.headPrefect")],
    ["first-team-vice-captain", t("category.leadershipRoleOptions.firstTeamViceCaptain")],
    ["first-team-captain", t("category.leadershipRoleOptions.firstTeamCaptain")],
  ] as const, LEADERSHIP_ROLE_MARKS, t);
}

function getStudentSocietiesRoleOptions(t: TFn) {
  return withMarks([
    ["committee-member", t("category.studentSocietiesRoleOptions.committeeMember")],
    ["vice-president", t("category.studentSocietiesRoleOptions.vicePresident")],
    ["president", t("category.studentSocietiesRoleOptions.president")],
  ] as const, STUDENT_SOCIETIES_ROLE_MARKS, t);
}

function getOtherActivityOptions(t: TFn) {
  return withMarks([
    ["junior-band-leader", t("category.otherActivityOptions.juniorBandLeader")],
    ["junior-band-member", t("category.otherActivityOptions.juniorBandMember")],
    ["senior-band-leader", t("category.otherActivityOptions.seniorBandLeader")],
    ["senior-band-member", t("category.otherActivityOptions.seniorBandMember")],
    ["scout-leader", t("category.otherActivityOptions.scoutLeader")],
    ["scout-member", t("category.otherActivityOptions.scoutMember")],
    ["cub-scout", t("category.otherActivityOptions.cubScout")],
    ["cadet-team-leader", t("category.otherActivityOptions.cadetTeamLeader")],
    ["cadet-team-member", t("category.otherActivityOptions.cadetTeamMember")],
    ["debating-team-leader", t("category.otherActivityOptions.debatingTeamLeader")],
    ["debating-team-member", t("category.otherActivityOptions.debatingTeamMember")],
    ["st-john-ambulance-leader", t("category.otherActivityOptions.stJohnAmbulanceLeader")],
    ["st-john-ambulance-member", t("category.otherActivityOptions.stJohnAmbulanceMember")],
    ["other", t("category.otherActivityOptions.other")],
  ] as const, OTHER_ACTIVITY_MARKS, t);
}

function getDegreeOptions(t: TFn) {
  return withMarks([
    ["first-degree", t("category.degreeOptions.firstDegree")],
    ["postgraduate", t("category.degreeOptions.postgraduate")],
    ["doctorate", t("category.degreeOptions.doctorate")],
    ["chartered-professional", t("category.degreeOptions.charteredProfessional")],
  ] as const, DEGREE_MARKS, t);
}

function getSiblingExamOptions(t: TFn) {
  return withMarks([
    ["scholarship", t("category.siblingExamOptions.scholarship")],
    ["ol", t("category.siblingExamOptions.ol")],
    ["al", t("category.siblingExamOptions.al")],
  ] as const, SIBLING_EXAM_MARKS, t);
}

function getSiblingDocumentOptions(t: TFn) {
  return withMarks([
    ["title-deed-applicant-spouse", t("category.siblingDocumentOptions.titleDeedApplicantSpouse")],
    ["title-deed-parents", t("category.siblingDocumentOptions.titleDeedParents")],
    ["feeder-electoral-5yrs", t("category.siblingDocumentOptions.feederElectoral5yrs")],
    ["lease-deed", t("category.siblingDocumentOptions.leaseDeed")],
    ["municipal-ds-rentact-cert", t("category.siblingDocumentOptions.municipalDsRentactCert")],
    ["other-documents", t("category.siblingDocumentOptions.otherDocuments")],
  ] as const, MAIN_DOCUMENT_MARKS_63, t);
}

const YEAR_OPTIONS = [0, 1, 2, 3, 4, 5];

const ELECTORAL_YEAR_OPTIONS = [2020, 2021, 2022, 2023, 2024] as const;

const PROXIMITY_CATEGORY_CONFIG: Partial<Record<CategoryType, { marksPerSchool: number; maxMarks: number }>> = {
  "6.1": { marksPerSchool: PROXIMITY_PER_SCHOOL_61, maxMarks: PROXIMITY_MAX_61 },
  "6.3": { marksPerSchool: PROXIMITY_PER_SCHOOL_63, maxMarks: PROXIMITY_MAX_63 },
  "6.5": { marksPerSchool: PROXIMITY_PER_SCHOOL_65, maxMarks: PROXIMITY_MAX_65 },
  "6.6": { marksPerSchool: PROXIMITY_PER_SCHOOL_66, maxMarks: PROXIMITY_MAX_66 },
};

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
  const { t } = useTranslation();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        min={0}
        step="1"
        value={value ?? ""}
        placeholder={t("category.common.enterNumber")}
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
  const { t } = useTranslation();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value != null ? String(value) : null}
        onValueChange={(next) => onChange(Number(next))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={t("category.common.selectYears")} />
        </SelectTrigger>
        <SelectContent>
          {YEAR_OPTIONS.map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year === 1 ? t("category.common.year") : t("category.common.years", { count: year })}
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
      <CalendarDatePicker id={id} value={value} onChange={onChange} />
    </Field>
  );
}

function CalendarDatePicker({
  id,
  value,
  onChange,
  minDate,
  maxDate,
}: {
  id: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const parsedDate = value ? new Date(value + "T00:00:00") : undefined;
  // Bound the year dropdown by default - without min/max, react-day-picker
  // renders an effectively unbounded year list, which breaks the nested
  // Select popover's floating-ui positioning (it renders detached at the top
  // of the viewport instead of anchored under the trigger).
  const now = new Date();
  const effectiveMinDate = minDate ?? new Date(now.getFullYear() - 100, 0, 1);
  const effectiveMaxDate = maxDate ?? new Date(now.getFullYear() + 5, 11, 31);

  return (
    <Popover
      open={open}
      onOpenChange={(isOpen, details) => {
        if (!isOpen && details.reason === "outside-press") {
          const target = details.event?.target as HTMLElement | undefined;
          if (target?.tagName === "SELECT" || target?.closest?.("[data-slot='calendar']")) {
            details.cancel();
            return;
          }
        }
        setOpen(isOpen);
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 md:text-sm [&>span]:line-clamp-1"
        >
          <span className={parsedDate ? "" : "text-muted-foreground"}>
            {parsedDate ? format(parsedDate, "dd/MM/yyyy") : "dd/mm/yyyy"}
          </span>
          <CalendarIcon className="size-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsedDate}
          defaultMonth={parsedDate ?? maxDate ?? now}
          captionLayout="dropdown"
          startMonth={effectiveMinDate}
          endMonth={effectiveMaxDate}
          disabled={(date) => (maxDate != null && date > maxDate) || (minDate != null && date < minDate)}
          components={{ Dropdown: NativeCalendarDropdown }}
          onSelect={(date) => {
            if (date) {
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, "0");
              const d = String(date.getDate()).padStart(2, "0");
              onChange(`${y}-${m}-${d}`);
            } else {
              onChange(undefined);
            }
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// A native <select> for the calendar's month/year navigation, instead of the
// shared Calendar's own popover-based Select - nesting that Select's
// floating popover inside this component's own Popover breaks floating-ui's
// position calculation (it renders detached at the top of the viewport). A
// native select has no popover of its own, so there's nothing to conflict.
function NativeCalendarDropdown({ options, value, onChange, disabled, "aria-label": ariaLabel }: DropdownProps) {
  return (
    <select
      value={value != null ? String(value) : ""}
      onChange={(event) => onChange?.(event)}
      disabled={disabled}
      aria-label={ariaLabel}
      className="h-7 w-fit rounded-md border border-input bg-transparent px-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {options?.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function MarkBadge({ marks, max, hint }: { marks: number; max: number; hint: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className={`${MARK_TOOLTIP} cursor-help tabular-nums`}>
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
  const { t } = useTranslation();
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
          <SelectValue placeholder={t("category.common.selectYearFirstRegistered")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t("category.common.notRegistered")}</SelectItem>
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

function RadioOption({ id, value, label, marks }: { id: string; value: string; label: string; marks?: number }) {
  const { t } = useTranslation();
  return (
    <FieldLabel htmlFor={id} className="flex w-fit cursor-pointer items-center gap-2 font-normal">
      <RadioGroupItem id={id} value={value} />
      {label}
      {marks != null && <span className="text-xs text-muted-foreground">({markSuffix(t, marks)})</span>}
    </FieldLabel>
  );
}

function DocumentTypeSelect({
  category,
  onChange,
  options,
}: {
  category: CategoryApplication;
  onChange: (patch: Partial<ScoringInputs>) => void;
  options: readonly (readonly [string, string])[];
}) {
  const { t } = useTranslation();
  const value = category.scoringInputs.mainDocumentType ?? null;
  return (
    <Field>
      <FieldLabel htmlFor={`main-document-type-${category.id}`} className="sr-only">{t("category.mainDocument.title")}</FieldLabel>
      <Select
        value={value}
        onValueChange={(next) => onChange({ mainDocumentType: String(next) })}
      >
        <SelectTrigger id={`main-document-type-${category.id}`} className="w-full">
          <SelectValue placeholder={t("category.mainDocument.placeholder")} />
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
  options,
}: {
  category: CategoryApplication;
  onChange: (patch: Partial<ScoringInputs>) => void;
  options: readonly (readonly [string, string])[];
}) {
  const { t } = useTranslation();
  const docs = category.scoringInputs.additionalDocs ?? [];
  const toggleDoc = (doc: string) => {
    onChange({
      additionalDocs: docs.includes(doc) ? docs.filter((existing) => existing !== doc) : [...docs, doc],
    });
  };
  return (
    <Field className="col-span-2">
      <FieldLabel>{t("category.additionalDocs.title")}</FieldLabel>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map(([doc, docLabel]) => (
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

function FlagButton({ fieldKey, flaggedInputs, onToggleInputFlag }: { fieldKey: string } & FlagProps) {
  const { t } = useTranslation();
  if (!onToggleInputFlag || !flaggedInputs) return null;
  const isFlagged = flaggedInputs.has(fieldKey);
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleInputFlag(fieldKey); }}
      className={`rounded-md p-1 transition-colors ${isFlagged ? `${STATUS_ERROR.bgSolid} ${STATUS_ERROR.text} ${STATUS_ERROR.hoverBg}` : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
      title={isFlagged ? t("category.common.flagTitle.flagged") : t("category.common.flagTitle.unflagged")}
    >
      <Flag size={12} />
    </button>
  );
}

export function Category61Fields({
  category,
  onChange,
  centerLat,
  centerLng,
  flaggedInputs,
  onToggleInputFlag,
}: {
  category: CategoryApplication;
  onChange: (patch: Partial<ScoringInputs>) => void;
  centerLat?: number;
  centerLng?: number;
} & FlagProps) {
  const { t } = useTranslation();
  const inputs = category.scoringInputs;
  const docMarks = documentMarks61(inputs);
  const addlMarks = additionalDocsMarks61(inputs);
  const electoral = electoralMarks61(inputs);
  const prox = proximityMarks61(inputs);
  const deedYears = yearsFromDate(inputs.deedTransferDate);
  const deedWeight = deedAgeWeight(deedYears);
  const deedPct = Math.round(deedWeight * 100);
  const selectedSchoolIds = inputs.schoolsWithinRadius ?? [];
  const hasCenter = centerLat != null && centerLng != null;
  const mainDocumentOptions = getMainDocumentOptions(t);
  const additionalDocOptions = getAdditionalDocOptions(t);
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.61.mainDocument.label")}</span>
          <MarkBadge marks={docMarks} max={MAIN_DOCUMENT_MAX_61} hint={t("category.61.mainDocument.hint")} />
          <FlagButton fieldKey="mainDocumentType" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
          </div>
          <DocumentTypeSelect category={category} onChange={onChange} options={mainDocumentOptions} />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t("category.61.documentRegistrationDate")}</span>
            <FlagButton fieldKey="deedTransferDate" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
            {inputs.deedTransferDate && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {Math.floor(deedYears)} yr{Math.floor(deedYears) !== 1 ? "s" : ""} old · {deedPct}%
              </span>
            )}
          </div>
          <DateField
            id={`deed-transfer-date-${category.id}`}
            label={t("category.61.deedTransferDate.label")}
            hint={t("category.61.deedTransferDate.hint")}
            value={inputs.deedTransferDate}
            onChange={(deedTransferDate) => onChange({ deedTransferDate })}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.61.supportingDocs.label")}</span>
          <MarkBadge marks={addlMarks} max={ADDITIONAL_DOC_MAX_61} hint={t("category.61.supportingDocs.hint")} />
          <FlagButton fieldKey="additionalDocs" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <AdditionalDocsCheckboxGroup category={category} onChange={onChange} options={additionalDocOptions} />
      </div>
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t("category.61.electoralMother.label")}</span>
            <FlagButton fieldKey="electoralMotherSince" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
          </div>
          <ElectoralYearSelect
            id={`electoral-mother-year-${category.id}`}
            label={t("category.61.electoralMother.yearLabel")}
            hint={t("category.61.electoralMother.hint")}
            value={inputs.electoralMotherSince}
            onChange={(electoralMotherSince) => onChange({ electoralMotherSince })}
          />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t("category.61.electoralFather.label")}</span>
            <FlagButton fieldKey="electoralFatherSince" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
          </div>
          <ElectoralYearSelect
            id={`electoral-father-year-${category.id}`}
            label={t("category.61.electoralFather.yearLabel")}
            hint={t("category.61.electoralFather.hint")}
            value={inputs.electoralFatherSince}
            onChange={(electoralFatherSince) => onChange({ electoralFatherSince })}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 border-t pt-3">
        <span className="text-sm font-medium">{t("category.61.electoralTotal")}</span>
        <MarkBadge marks={electoral} max={ELECTORAL_MAX_61} hint={t("category.61.electoralTotal.hint")} />
      </div>
      <div className="grid gap-1.5 border-t pt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.61.nearbySchools.label")}</span>
          <MarkBadge marks={prox} max={PROXIMITY_MAX_61} hint={t("category.61.nearbySchools.hint", { school: getHomeSchoolDisplayName() })} />
          <FlagButton fieldKey="schoolsWithinRadius" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
          {selectedSchoolIds.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{t("category.common.selected", { count: selectedSchoolIds.length })}</span>
          )}
        </div>
        {hasCenter ? (
          <SchoolMapPicker
            centerLat={centerLat!}
            centerLng={centerLng!}
            selectedIds={selectedSchoolIds}
            highlightSchoolId={HOME_SCHOOL_ID}
            marksPerSchool={PROXIMITY_PER_SCHOOL_61}
            onToggle={(schoolId) =>
              onChange({
                schoolsWithinRadius: selectedSchoolIds.includes(schoolId)
                  ? selectedSchoolIds.filter((id) => id !== schoolId)
                  : [...selectedSchoolIds, schoolId],
              })
            }
          />
        ) : (
          <p className="text-xs text-muted-foreground">{t("category.noHomeLocation")}</p>
        )}
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
  const { t } = useTranslation();
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
          <SelectItem value="none">{t("category.common.notAttempted")}</SelectItem>
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
  const { t } = useTranslation();
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
          <SelectItem value="none">{t("category.common.none")}</SelectItem>
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
  const { t } = useTranslation();
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
              {t("category.common.gradePasses", { grade })}
            </FieldLabel>
            <Input
              id={`${prefix}-grade-${grade}-${category.id}`}
              type="number"
              min={0}
              max={totalCount}
              step="1"
              value={currentValue || ""}
              placeholder="0"
              className={isThisOver ? `${STATUS_ERROR.border} ${STATUS_ERROR.focusRing}` : ""}
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
        <p className={`col-span-2 text-sm ${STATUS_ERROR.text} max-md:col-span-1`}>
          {t("category.common.totalExceeds", { total: totalSum, max: totalCount })}
        </p>
      )}
    </div>
  );
}

export function Category62Fields({
  category,
  onChange,
  flaggedInputs,
  onToggleInputFlag,
}: {
  category: CategoryApplication;
  onChange: (patch: Partial<ScoringInputs>) => void;
} & FlagProps) {
  const { t } = useTranslation();
  const inputs = category.scoringInputs;
  const id = category.id;
  const years = yearsBetween(inputs.alumniStartDate, inputs.alumniEndDate);
  const yearsMarks = Math.min(years * YEARS_EDUCATED_MARKS_PER_YEAR, YEARS_EDUCATED_MAX);
  const scholarshipMarks = inputs.grade5ScholarshipPassed ? GRADE5_SCHOLARSHIP_MARKS : 0;

  // Sports / co-curricular marks
  const sportsBase = SPORTS_LEVEL_MARKS[inputs.sportsLevel ?? ""] ?? 0;
  const sportsMarks = Math.min(sportsBase * (inputs.sportsCount ?? (sportsBase > 0 ? 1 : 0)), SPORTS_MAX);
  const leadershipMarks = LEADERSHIP_ROLE_MARKS[inputs.leadershipRole ?? ""] ?? 0;
  const studentSocietiesMarks = STUDENT_SOCIETIES_ROLE_MARKS[inputs.studentSocietiesRole ?? ""] ?? 0;
  const otherActivityMarks = OTHER_ACTIVITY_MARKS[inputs.otherActivity ?? ""] ?? 0;

  // Past Pupils' Association marks
  let pastPupilsMarks = 0;
  if (inputs.pastPupilsLifeMember) pastPupilsMarks += PAST_PUPILS_LIFE_MEMBER_MARKS;
  else if (inputs.pastPupilsMembershipStart && inputs.pastPupilsMembershipEnd) {
    const years = yearsBetween(inputs.pastPupilsMembershipStart, inputs.pastPupilsMembershipEnd);
    pastPupilsMarks += Math.min(years * PAST_PUPILS_YEARLY_MARKS, PAST_PUPILS_MEMBERSHIP_MAX);
  }
  if (inputs.pastPupilsCommitteeMember) pastPupilsMarks += 1;
  if (inputs.pastPupilsExecutiveOffice) pastPupilsMarks += 3;
  pastPupilsMarks = Math.min(pastPupilsMarks, PAST_PUPILS_TOTAL_MAX);

  // Degree marks
  const degreeMarks = DEGREE_MARKS[inputs.highestDegree ?? ""] ?? 0;
  const diplomaMarks = inputs.hasDiploma ? DIPLOMA_MARKS : 0;

  // Contribution marks
  let contributionMarks = 0;
  if (inputs.sportsMeetContribution) contributionMarks += SPORTS_MEET_CONTRIBUTION;
  if (inputs.shramadanaContribution) contributionMarks += SHRAMADANA_CONTRIBUTION;
  contributionMarks = Math.min(contributionMarks, CONTRIBUTION_MAX);
  const projectMarks = inputs.schoolProjectsContribution ? SCHOOL_PROJECTS_MARKS : 0;

  const olSubjectOptions = getOlSubjectOptions(t);
  const alSubjectOptions = getAlSubjectOptions(t);
  const sportsLevelOptions = getSportsLevelOptions(t);
  const leadershipRoleOptions = getLeadershipRoleOptions(t);
  const studentSocietiesRoleOptions = getStudentSocietiesRoleOptions(t);
  const otherActivityOptions = getOtherActivityOptions(t);
  const degreeOptions = getDegreeOptions(t);

  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      {/* Years educated */}
      <div className="grid gap-1.5 col-span-2 max-md:col-span-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.62.yearsEducated.label")}</span>
          <MarkBadge marks={yearsMarks} max={YEARS_EDUCATED_MAX} hint={t("category.62.yearsEducated.hint", { years: Math.floor(years), marks: yearsMarks })} />
          <FlagButton fieldKey="alumniStartDate" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
          <DateField
            id={`alumni-start-${id}`}
            label={t("category.62.startDate.label")}
            hint={t("category.62.startDate.hint", { school: getHomeSchoolDisplayName() })}
            value={inputs.alumniStartDate}
            onChange={(alumniStartDate) => onChange({ alumniStartDate })}
          />
          <DateField
            id={`alumni-end-${id}`}
            label={t("category.62.endDate.label")}
            hint={t("category.62.endDate.hint", { school: getHomeSchoolDisplayName() })}
            value={inputs.alumniEndDate}
            onChange={(alumniEndDate) => onChange({ alumniEndDate })}
          />
        </div>
      </div>

      {/* Grade 5 Scholarship */}
      <div className="col-span-2 grid content-start gap-2 rounded-xl border border-border/70 bg-muted/10 p-3 sm:flex sm:items-center sm:justify-between sm:gap-4 max-md:col-span-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.62.grade5Scholarship.label")}</span>
          <MarkBadge marks={scholarshipMarks} max={GRADE5_SCHOLARSHIP_MARKS} hint={t("category.62.grade5Scholarship.hint")} />
          <FlagButton fieldKey="grade5ScholarshipPassed" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <label className="mt-1 flex items-start gap-2 text-sm leading-relaxed">
          <Checkbox
            className="size-4"
            checked={inputs.grade5ScholarshipPassed === true}
            onCheckedChange={(checked) => onChange({ grade5ScholarshipPassed: checked === true })}
          />
          {t("category.62.grade5Scholarship.checkbox")}
        </label>
      </div>

      {/* G.C.E. (O/L) */}
      <div className="grid content-start gap-1.5 rounded-xl border border-border/70 bg-muted/10 p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.62.olResult.label")}</span>
          <MarkBadge marks={(() => { let m = 0; const c = inputs.olSubjectCount; const t2 = c != null ? OL_CEILINGS[c] : undefined; if (t2 && c != null) { for (const g of ["S","C","B","A"]) { m += (inputs[`olGrade${g}` as "olGradeS"] ?? 0) * gradeRate(t2, c, g); } } return Math.min(m, 10); })()} max={10} hint={t("category.62.olResult.hint")} />
        </div>
        <CountSelect
          id={`ol-subject-count-${id}`}
          label={t("category.62.olResult.subjectCount")}
          value={inputs.olSubjectCount}
          options={olSubjectOptions}
          placeholder={t("category.62.olResult.subjectCountPlaceholder")}
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
      <div className="grid content-start gap-1.5 rounded-xl border border-border/70 bg-muted/10 p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.62.alResult.label")}</span>
          <MarkBadge marks={(() => { let m = 0; const c = inputs.alSubjectCount; const t2 = c != null ? AL_CEILINGS[c] : undefined; if (t2 && c != null) { for (const g of ["S","C","B","A"]) { m += (inputs[`alGrade${g}` as "alGradeS"] ?? 0) * gradeRate(t2, c, g); } } return Math.min(m, 12); })()} max={12} hint={t("category.62.alResult.hint")} />
        </div>
        <CountSelect
          id={`al-subject-count-${id}`}
          label={t("category.62.alResult.subjectCount")}
          value={inputs.alSubjectCount}
          options={alSubjectOptions}
          placeholder={t("category.62.alResult.subjectCountPlaceholder")}
          onChange={(alSubjectCount) => onChange({ alSubjectCount })}
        />
        {inputs.alSubjectCount != null && (
          <GradeCounts category={category} prefix="al" grades={["S", "C", "B", "A"]} totalCount={inputs.alSubjectCount} onChange={onChange} />
        )}
      </div>

      {/* Sports / co-curricular */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.62.sports.label")}</span>
          <MarkBadge marks={sportsMarks} max={SPORTS_MAX} hint={t("category.62.sports.hint")} />
          <FlagButton fieldKey="sportsLevel" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <StringSelect
          id={`sports-level-${id}`}
          label={t("category.62.sports.highestLevel")}
          value={inputs.sportsLevel}
          options={sportsLevelOptions}
          placeholder={t("category.62.sports.highestLevelPlaceholder")}
          onChange={(sportsLevel) => onChange({ sportsLevel })}
        />
        <NumberField
          id={`sports-count-${id}`}
          label={t("category.62.sports.achievements")}
          value={inputs.sportsCount}
          onChange={(sportsCount) => onChange({ sportsCount })}
        />
      </div>

      {/* Leadership role */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.62.leadership.label")}</span>
          <MarkBadge marks={leadershipMarks} max={LEADERSHIP_MAX} hint={t("category.62.leadership.hint")} />
          <FlagButton fieldKey="leadershipRole" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <StringSelect
          id={`leadership-role-${id}`}
          label={t("category.62.leadership.highestRole")}
          value={inputs.leadershipRole}
          options={leadershipRoleOptions}
          placeholder={t("category.62.leadership.highestRolePlaceholder")}
          onChange={(leadershipRole) => onChange({ leadershipRole })}
        />
      </div>

      {/* Student Societies */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.62.studentSocieties.label")}</span>
          <MarkBadge marks={studentSocietiesMarks} max={STUDENT_SOCIETIES_MAX} hint={t("category.62.studentSocieties.hint")} />
          <FlagButton fieldKey="studentSocietiesRole" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <StringSelect
          id={`student-societies-role-${id}`}
          label={t("category.62.studentSocieties.highestRole")}
          value={inputs.studentSocietiesRole}
          options={studentSocietiesRoleOptions}
          placeholder={t("category.62.studentSocieties.highestRolePlaceholder")}
          onChange={(studentSocietiesRole) => onChange({ studentSocietiesRole })}
        />
      </div>

      {/* Other Activities */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.62.otherActivities.label")}</span>
          <MarkBadge marks={otherActivityMarks} max={OTHER_ACTIVITIES_MAX} hint={t("category.62.otherActivities.hint")} />
          <FlagButton fieldKey="otherActivity" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <StringSelect
          id={`other-activity-${id}`}
          label={t("category.62.otherActivities.activityLabel")}
          value={inputs.otherActivity}
          options={otherActivityOptions}
          placeholder={t("category.62.otherActivities.activityPlaceholder")}
          onChange={(otherActivity) => onChange({ otherActivity })}
        />
        {inputs.otherActivity === "other" && (
          <Field>
            <FieldLabel htmlFor={`other-activity-name-${id}`}>{t("category.62.otherActivities.specifyLabel")}</FieldLabel>
            <Input
              id={`other-activity-name-${id}`}
              type="text"
              value={inputs.otherActivityName ?? ""}
              placeholder={t("category.62.otherActivities.specifyPlaceholder")}
              onChange={(event) => onChange({ otherActivityName: event.target.value || undefined })}
            />
          </Field>
        )}
      </div>

      {/* Past Pupils' Association */}
      <div className="grid gap-1.5 col-span-2 max-md:col-span-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.62.pastPupils.label")}</span>
          <MarkBadge marks={pastPupilsMarks} max={PAST_PUPILS_TOTAL_MAX} hint={(() => {
            const start = inputs.pastPupilsMembershipStart;
            const end = inputs.pastPupilsMembershipEnd;
            const yrs = (start && end) ? yearsBetween(start, end).toFixed(1) : "0";
            const yearMarks = (parseFloat(yrs) * 0.5).toFixed(1);
            return t("category.62.pastPupils.hint", { years: yrs, yearMarks });
          })()} />
          <FlagButton fieldKey="pastPupilsLifeMember" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              className="size-4"
              checked={inputs.pastPupilsLifeMember === true}
              onCheckedChange={(checked) => onChange({ pastPupilsLifeMember: checked === true })}
            />
            {t("category.62.pastPupils.lifeMembership")}
          </label>
          <DateField
            id={`past-pupils-start-${id}`}
            label={t("category.62.pastPupils.startDate.label")}
            hint={t("category.62.pastPupils.startDate.hint")}
            value={inputs.pastPupilsMembershipStart}
            onChange={(pastPupilsMembershipStart) => onChange({ pastPupilsMembershipStart })}
          />
          <DateField
            id={`past-pupils-end-${id}`}
            label={t("category.62.pastPupils.endDate.label")}
            hint={t("category.62.pastPupils.endDate.hint")}
            value={inputs.pastPupilsMembershipEnd}
            onChange={(pastPupilsMembershipEnd) => onChange({ pastPupilsMembershipEnd })}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              className="size-4"
              checked={inputs.pastPupilsCommitteeMember === true}
              onCheckedChange={(checked) => onChange({ pastPupilsCommitteeMember: checked === true })}
            />
            {t("category.62.pastPupils.committeeMembership")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              className="size-4"
              checked={inputs.pastPupilsExecutiveOffice === true}
              onCheckedChange={(checked) => onChange({ pastPupilsExecutiveOffice: checked === true })}
            />
            {t("category.62.pastPupils.executiveOffice")}
          </label>
        </div>
      </div>

      {/* University Degrees */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.62.degrees.label")}</span>
          <MarkBadge marks={degreeMarks} max={DEGREE_MAX} hint={t("category.62.degrees.hint")} />
          <FlagButton fieldKey="highestDegree" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <StringSelect
          id={`highest-degree-${id}`}
          label={t("category.62.degrees.highestQualification")}
          value={inputs.highestDegree}
          options={degreeOptions}
          placeholder={t("category.62.degrees.highestQualificationPlaceholder")}
          onChange={(highestDegree) => onChange({ highestDegree })}
        />
      </div>

      {/* Diploma */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.62.diploma.label")}</span>
          <MarkBadge marks={diplomaMarks} max={DIPLOMA_MARKS} hint={t("category.62.diploma.hint")} />
          <FlagButton fieldKey="hasDiploma" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <label className="mt-1 flex items-start gap-2 text-sm leading-relaxed">
          <Checkbox
            className="size-4"
            checked={inputs.hasDiploma === true}
            onCheckedChange={(checked) => onChange({ hasDiploma: checked === true })}
          />
          {t("category.62.diploma.checkbox")}
        </label>
      </div>

      {/* Contribution to School Activities */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.62.contribution.label")}</span>
          <MarkBadge marks={contributionMarks} max={CONTRIBUTION_MAX} hint={t("category.62.contribution.hint")} />
          <FlagButton fieldKey="sportsMeetContribution" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              className="size-4"
              checked={inputs.sportsMeetContribution === true}
              onCheckedChange={(checked) => onChange({ sportsMeetContribution: checked === true })}
            />
            {t("category.62.contribution.sportsMeet")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              className="size-4"
              checked={inputs.shramadanaContribution === true}
              onCheckedChange={(checked) => onChange({ shramadanaContribution: checked === true })}
            />
            {t("category.62.contribution.shramadana")}
          </label>
        </div>
      </div>

      {/* Contribution to School Projects */}
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.62.schoolProjects.label")}</span>
          <MarkBadge marks={projectMarks} max={SCHOOL_PROJECTS_MARKS} hint={t("category.62.schoolProjects.hint")} />
          <FlagButton fieldKey="schoolProjectsContribution" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <label className="mt-1 flex items-start gap-2 text-sm leading-relaxed">
          <Checkbox
            className="size-4"
            checked={inputs.schoolProjectsContribution === true}
            onCheckedChange={(checked) => onChange({ schoolProjectsContribution: checked === true })}
          />
          {t("category.62.schoolProjects.checkbox")}
        </label>
      </div>
    </div>
  );
}

export function Category63Fields({
  category,
  onChange,
  centerLat,
  centerLng,
  flaggedInputs,
  onToggleInputFlag,
}: {
  category: CategoryApplication;
  onChange: (patch: Partial<ScoringInputs>) => void;
  centerLat?: number;
  centerLng?: number;
} & FlagProps) {
  const { t } = useTranslation();
  const inputs = category.scoringInputs;
  const id = category.id;
  const selectedSchoolIds = inputs.schoolsWithinRadius ?? [];
  const hasCenter = centerLat != null && centerLng != null;
  const siblingsMarks = Math.min((inputs.siblingsCurrentlyStudyingCount ?? 0) * SIBLING_MARKS_PER_SIBLING, SIBLING_STUDYING_MAX);
  const studiedHereMarks = inputs.siblingStudiedAtAppliedSchool ? SIBLING_STUDIED_HERE_MARKS : 0;
  const multipleApplyingMarks = inputs.twoOrMoreSiblingsApplying ? SIBLING_MULTIPLE_APPLYING_MARKS : 0;
  const prefectMarks = Math.min((SIBLING_PREFECT_LEVEL_MARKS[inputs.siblingPrefectLevel ?? ""] ?? 0) * (inputs.siblingPrefectCount ?? 0), SIBLING_PREFECT_MAX);
  const examMarks = Math.min(SIBLING_EXAM_MARKS[inputs.siblingExamAchievement ?? ""] ?? 0, SIBLING_EXAM_MAX);
  const praiseworthyMarks = inputs.siblingPraiseworthyAchievement ? SIBLING_PRAISEWORTHY_MARKS : 0;
  const supportMarks = inputs.parentsSupportRendered ? SIBLING_SUPPORT_MARKS : 0;
  const cocurricularTotal = Math.min(prefectMarks + examMarks + praiseworthyMarks + supportMarks, SIBLING_COCURRICULAR_TOTAL_MAX);
  const documentMarks = Math.min(MAIN_DOCUMENT_MARKS_63[inputs.mainDocumentType ?? ""] ?? 0, MAIN_DOCUMENT_MAX_63);
  const mother = electoralYearsRegistered(inputs.electoralMotherSince);
  const father = electoralYearsRegistered(inputs.electoralFatherSince);
  const electoralMarks = Math.min((mother + father) * ELECTORAL_MARKS_PER_PERSON_YEAR_63, ELECTORAL_MAX_63);
  const prox = proximityMarks(inputs, PROXIMITY_PER_SCHOOL_63, PROXIMITY_MAX_63);

  const siblingDocumentOptions = getSiblingDocumentOptions(t);
  const siblingExamOptions = getSiblingExamOptions(t);
  const siblingPrefectLevelOptions = getSportsLevelOptions(t, SIBLING_PREFECT_LEVEL_MARKS);

  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.63.siblingsStudying.label")}</span>
          <MarkBadge marks={siblingsMarks} max={SIBLING_STUDYING_MAX} hint={t("category.63.siblingsStudying.hint", { count: inputs.siblingsCurrentlyStudyingCount ?? 0, marks: siblingsMarks })} />
          <FlagButton fieldKey="siblingsCurrentlyStudyingCount" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <NumberField
          id={`siblings-count-${id}`}
          label={t("category.63.siblingsStudying.countLabel")}
          value={inputs.siblingsCurrentlyStudyingCount}
          onChange={(siblingsCurrentlyStudyingCount) => onChange({ siblingsCurrentlyStudyingCount })}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.63.studiedHere.label")}</span>
          <MarkBadge marks={studiedHereMarks} max={SIBLING_STUDIED_HERE_MARKS} hint={t("category.63.studiedHere.hint", { school: getHomeSchoolDisplayName() })} />
          <FlagButton fieldKey="siblingStudiedAtAppliedSchool" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <label className="mt-1 flex items-start gap-2 text-sm leading-relaxed">
          <Checkbox
            className="size-4"
            checked={inputs.siblingStudiedAtAppliedSchool === true}
            onCheckedChange={(checked) => onChange({ siblingStudiedAtAppliedSchool: checked === true })}
          />
          {t("category.63.studiedHere.checkbox")}
        </label>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.63.multipleSiblings.label")}</span>
          <MarkBadge marks={multipleApplyingMarks} max={SIBLING_MULTIPLE_APPLYING_MARKS} hint={t("category.63.multipleSiblings.hint")} />
          <FlagButton fieldKey="twoOrMoreSiblingsApplying" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            className="size-4"
            checked={inputs.twoOrMoreSiblingsApplying === true}
            onCheckedChange={(checked) => onChange({ twoOrMoreSiblingsApplying: checked === true })}
          />
          {t("category.63.multipleSiblings.checkbox")}
        </label>
      </div>
      <div className="grid gap-1.5 col-span-2 max-md:col-span-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.63.cocurricular.label")}</span>
          <MarkBadge marks={cocurricularTotal} max={SIBLING_COCURRICULAR_TOTAL_MAX} hint={t("category.63.cocurricular.hint")} />
          <FlagButton fieldKey="siblingPrefectLevel" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
          <StringSelect
            id={`sibling-prefect-level-${id}`}
            label={t("category.63.cocurricular.prefectLevel")}
            value={inputs.siblingPrefectLevel}
            options={siblingPrefectLevelOptions}
            placeholder={t("category.63.cocurricular.prefectLevelPlaceholder")}
            onChange={(siblingPrefectLevel) => onChange({ siblingPrefectLevel })}
          />
          <NumberField
            id={`sibling-prefect-count-${id}`}
            label={t("category.63.cocurricular.achievements")}
            value={inputs.siblingPrefectCount}
            onChange={(siblingPrefectCount) => onChange({ siblingPrefectCount })}
          />
          <StringSelect
            id={`sibling-exam-${id}`}
            label={t("category.63.cocurricular.examAchievement")}
            value={inputs.siblingExamAchievement}
            options={siblingExamOptions}
            placeholder={t("category.63.cocurricular.examAchievementPlaceholder")}
            onChange={(siblingExamAchievement) => onChange({ siblingExamAchievement })}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              className="size-4"
              checked={inputs.siblingPraiseworthyAchievement === true}
              onCheckedChange={(checked) => onChange({ siblingPraiseworthyAchievement: checked === true })}
            />
            {t("category.63.cocurricular.praiseworthy")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              className="size-4"
              checked={inputs.parentsSupportRendered === true}
              onCheckedChange={(checked) => onChange({ parentsSupportRendered: checked === true })}
            />
            {t("category.63.cocurricular.parentSupport")}
          </label>
        </div>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.63.residenceDocument.label")}</span>
          <MarkBadge marks={documentMarks} max={MAIN_DOCUMENT_MAX_63} hint={t("category.63.residenceDocument.hint")} />
          <FlagButton fieldKey="mainDocumentType" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <DocumentTypeSelect category={category} onChange={onChange} options={siblingDocumentOptions} />
      </div>
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <div className="grid gap-1.5">
          <ElectoralYearSelect
            id={`electoral-mother-year-${id}`}
            label={t("category.63.electoralMother.yearLabel")}
            hint={t("category.63.electoralMother.hint")}
            value={inputs.electoralMotherSince}
            onChange={(electoralMotherSince) => onChange({ electoralMotherSince })}
          />
        </div>
        <div className="grid gap-1.5">
          <ElectoralYearSelect
            id={`electoral-father-year-${id}`}
            label={t("category.63.electoralFather.yearLabel")}
            hint={t("category.63.electoralFather.hint")}
            value={inputs.electoralFatherSince}
            onChange={(electoralFatherSince) => onChange({ electoralFatherSince })}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 border-t pt-3">
        <span className="text-sm font-medium">{t("category.63.electoralTotal")}</span>
          <MarkBadge marks={electoralMarks} max={ELECTORAL_MAX_63} hint={t("category.63.electoralTotal.hint")} />
          <FlagButton fieldKey="electoralMotherSince" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
      <div className="grid gap-1.5 border-t pt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.61.nearbySchools.label")}</span>
          <MarkBadge marks={prox} max={PROXIMITY_MAX_63} hint={t("category.63.nearbySchools.hint", { school: getHomeSchoolDisplayName() })} />
          <FlagButton fieldKey="schoolsWithinRadius" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
      </div>
    </div>
  );
}

export function Category64Fields({
  category,
  onChange,
  flaggedInputs,
  onToggleInputFlag,
}: {
  category: CategoryApplication;
  onChange: (patch: Partial<ScoringInputs>) => void;
} & FlagProps) {
  const { t } = useTranslation();
  const inputs = category.scoringInputs;
  const serviceMarks = Math.min(yearsFromDate(inputs.serviceStartDate), SERVICE_PERIOD_MAX);
  let difficultMarks = 0;
  if (inputs.difficultServiceType === "current") {
    difficultMarks = DIFFICULT_SERVICE_CURRENT_MARKS;
  } else if (inputs.difficultServiceType === "previous") {
    const km = inputs.difficultServiceDistanceKm;
    const distance = difficultDistanceMarks(km);
    difficultMarks = Math.max(DIFFICULT_SERVICE_PREVIOUS_BASE, distance) + (inputs.difficultServiceExtraPeriods ?? 0) * DIFFICULT_EXTRA_PERIOD_MARKS;
  }
  difficultMarks = Math.min(difficultMarks, DIFFICULT_SERVICE_MAX);
  const leaveMarks = Math.min((inputs.unutilizedLeaveYears ?? 0) * UNUTILIZED_LEAVE_MARKS_PER_YEAR, UNUTILIZED_LEAVE_MAX);
  const locationMap: Record<string, number> = SERVICE_LOCATION_MARKS;
  const locationMarks = Math.min(locationMap[inputs.serviceLocationLevel ?? ""] ?? 0, SERVICE_LOCATION_MAX);
  const resKm = inputs.residenceToSchoolKm;
  const residenceDistance = tieredDistanceMarks(resKm, RESIDENCE_DISTANCE_TIERS_64, RESIDENCE_DISTANCE_FALLBACK_64);
  const workKm = inputs.workplaceToSchoolKm;
  const workplaceDistance = workplaceDistanceMarks(workKm);
  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.64.servicePeriod.label")}</span>
          <MarkBadge marks={serviceMarks} max={SERVICE_PERIOD_MAX} hint={t("category.64.servicePeriod.hint", { years: Math.floor(yearsFromDate(inputs.serviceStartDate)), marks: serviceMarks })} />
          <FlagButton fieldKey="serviceStartDate" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <DateField
          id={`service-start-${category.id}`}
          label={t("category.64.servicePeriod.dateLabel")}
          hint={t("category.64.servicePeriod.dateHint")}
          value={inputs.serviceStartDate}
          onChange={(serviceStartDate) => onChange({ serviceStartDate })}
        />
      </div>
      <div className="grid gap-1.5 col-span-2 max-md:col-span-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.64.difficultService.label")}</span>
          <MarkBadge marks={difficultMarks} max={DIFFICULT_SERVICE_MAX} hint={t("category.64.difficultService.hint")} />
          <FlagButton fieldKey="difficultServiceType" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <Field>
          <FieldLabel>{t("category.64.difficultService.typeLabel")}</FieldLabel>
          <RadioGroup
            value={inputs.difficultServiceType ?? ""}
            onValueChange={(next) => onChange({ difficultServiceType: next as ScoringInputs["difficultServiceType"] })}
            className="flex flex-wrap gap-x-6 gap-y-2"
          >
            <RadioOption id={`dst-current-${category.id}`} value="current" label={t("category.64.difficultService.currentSchool")} marks={DIFFICULT_SERVICE_CURRENT_MARKS} />
            <RadioOption id={`dst-previous-${category.id}`} value="previous" label={t("category.64.difficultService.previousSchool")} />
            <RadioOption id={`dst-none-${category.id}`} value="none" label={t("category.64.difficultService.none")} marks={0} />
          </RadioGroup>
        </Field>
        {inputs.difficultServiceType === "previous" && (
          <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
            <NumberField
              id={`difficult-distance-${category.id}`}
              label={t("category.64.difficultService.distanceKm")}
              value={inputs.difficultServiceDistanceKm}
              onChange={(difficultServiceDistanceKm) => onChange({ difficultServiceDistanceKm })}
            />
            <NumberField
              id={`difficult-periods-${category.id}`}
              label={t("category.64.difficultService.extraPeriods")}
              value={inputs.difficultServiceExtraPeriods}
              onChange={(difficultServiceExtraPeriods) => onChange({ difficultServiceExtraPeriods })}
            />
          </div>
        )}
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.64.unutilizedLeave.label")}</span>
          <MarkBadge marks={leaveMarks} max={UNUTILIZED_LEAVE_MAX} hint={t("category.64.unutilizedLeave.hint", { years: inputs.unutilizedLeaveYears ?? 0, marks: leaveMarks })} />
          <FlagButton fieldKey="unutilizedLeaveYears" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <YearsSelect
          id={`unutilized-leave-${category.id}`}
          label={t("category.64.unutilizedLeave.yearsLabel")}
          value={inputs.unutilizedLeaveYears}
          onChange={(unutilizedLeaveYears) => onChange({ unutilizedLeaveYears })}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.64.serviceLocation.label")}</span>
          <MarkBadge marks={locationMarks} max={SERVICE_LOCATION_MAX} hint={t("category.64.serviceLocation.hint")} />
          <FlagButton fieldKey="serviceLocationLevel" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <Field>
          <FieldLabel>{t("category.64.serviceLocation.levelLabel")}</FieldLabel>
          <RadioGroup
            value={inputs.serviceLocationLevel ?? ""}
            onValueChange={(next) => onChange({ serviceLocationLevel: String(next) })}
            className="flex flex-wrap gap-x-6 gap-y-2"
          >
            <RadioOption id={`sll-same-school-${category.id}`} value="same-school" label={t("category.64.serviceLocation.sameSchool")} marks={SERVICE_LOCATION_MARKS["same-school"]} />
            <RadioOption id={`sll-zone-${category.id}`} value="zone" label={t("category.64.serviceLocation.zone")} marks={SERVICE_LOCATION_MARKS.zone} />
            <RadioOption id={`sll-province-${category.id}`} value="province" label={t("category.64.serviceLocation.province")} marks={SERVICE_LOCATION_MARKS.province} />
            <RadioOption id={`sll-education-institution-${category.id}`} value="education-institution" label={t("category.64.serviceLocation.educationInstitution")} marks={SERVICE_LOCATION_MARKS["education-institution"]} />
          </RadioGroup>
        </Field>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.64.residenceToSchool.label")}</span>
          <MarkBadge marks={residenceDistance} max={RESIDENCE_DISTANCE_MAX_64} hint={t("category.64.residenceToSchool.hint")} />
          <FlagButton fieldKey="residenceToSchoolKm" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <NumberField
          id={`residence-to-school-${category.id}`}
          label={t("category.64.residenceToSchool.distanceLabel")}
          value={inputs.residenceToSchoolKm}
          onChange={(residenceToSchoolKm) => onChange({ residenceToSchoolKm })}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.64.workplaceToSchool.label")}</span>
          <MarkBadge marks={workplaceDistance} max={WORKPLACE_DISTANCE_MAX} hint={t("category.64.workplaceToSchool.hint")} />
          <FlagButton fieldKey="workplaceToSchoolKm" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <NumberField
          id={`workplace-to-school-${category.id}`}
          label={t("category.64.workplaceToSchool.distanceLabel")}
          value={inputs.workplaceToSchoolKm}
          onChange={(workplaceToSchoolKm) => onChange({ workplaceToSchoolKm })}
        />
      </div>
    </div>
  );
}

export function Category65Fields({
  category,
  onChange,
  centerLat,
  centerLng,
  flaggedInputs,
  onToggleInputFlag,
}: {
  category: CategoryApplication;
  onChange: (patch: Partial<ScoringInputs>) => void;
  centerLat?: number;
  centerLng?: number;
} & FlagProps) {
  const { t } = useTranslation();
  const inputs = category.scoringInputs;
  const selectedSchoolIds = inputs.schoolsWithinRadius ?? [];
  const hasCenter = centerLat != null && centerLng != null;
  const km = inputs.previousWorkplaceDistanceKm;
  const distanceMarks = transferDistanceMarks(km);
  const periodMarks = Math.min(yearsFromDate(inputs.serviceStartDate), TRANSFER_SERVICE_PERIOD_MAX);
  const prevYears = yearsFromDate(inputs.previousWorkplaceStartDate);
  const previousPeriodMarks = previousPeriodMarksFn(prevYears);
  const elapsed = yearsFromDate(inputs.transferDate);
  const elapsedMarks = inputs.transferDate ? transferElapsedMarksFn(elapsed) : 0;
  const leaveMarks = Math.min((inputs.unutilizedLeaveYears ?? 0) * UNUTILIZED_LEAVE_MARKS_PER_YEAR, UNUTILIZED_LEAVE_MAX);
  const prox = proximityMarks(inputs, PROXIMITY_PER_SCHOOL_65, PROXIMITY_MAX_65);
  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.65.prevWorkplaceDistance.label")}</span>
          <MarkBadge marks={distanceMarks} max={TRANSFER_DISTANCE_MAX} hint={t("category.65.prevWorkplaceDistance.hint")} />
          <FlagButton fieldKey="previousWorkplaceDistanceKm" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <NumberField
          id={`prev-workplace-distance-${category.id}`}
          label={t("category.65.prevWorkplaceDistance.distanceLabel")}
          value={inputs.previousWorkplaceDistanceKm}
          onChange={(previousWorkplaceDistanceKm) => onChange({ previousWorkplaceDistanceKm })}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.65.servicePeriod.label")}</span>
          <MarkBadge marks={periodMarks} max={TRANSFER_SERVICE_PERIOD_MAX} hint={t("category.65.servicePeriod.hint", { years: Math.floor(yearsFromDate(inputs.serviceStartDate)), marks: periodMarks })} />
          <FlagButton fieldKey="serviceStartDate" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <DateField
          id={`transfer-service-start-${category.id}`}
          label={t("category.65.servicePeriod.dateLabel")}
          hint={t("category.65.servicePeriod.dateHint")}
          value={inputs.serviceStartDate}
          onChange={(serviceStartDate) => onChange({ serviceStartDate })}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.65.prevWorkplacePeriod.label")}</span>
          <MarkBadge marks={previousPeriodMarks} max={TRANSFER_PREVIOUS_PERIOD_MAX} hint={t("category.65.prevWorkplacePeriod.hint")} />
          <FlagButton fieldKey="previousWorkplaceStartDate" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <DateField
          id={`prev-workplace-start-${category.id}`}
          label={t("category.65.prevWorkplacePeriod.dateLabel")}
          hint={t("category.65.prevWorkplacePeriod.dateHint")}
          value={inputs.previousWorkplaceStartDate}
          onChange={(previousWorkplaceStartDate) => onChange({ previousWorkplaceStartDate })}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.65.timeSinceTransfer.label")}</span>
          <MarkBadge marks={elapsedMarks} max={TRANSFER_ELAPSED_MAX} hint={t("category.65.timeSinceTransfer.hint")} />
          <FlagButton fieldKey="transferDate" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <DateField
          id={`transfer-date-${category.id}`}
          label={t("category.65.timeSinceTransfer.dateLabel")}
          hint={t("category.65.timeSinceTransfer.dateHint")}
          value={inputs.transferDate}
          onChange={(transferDate) => onChange({ transferDate })}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.65.unutilizedLeave.label")}</span>
          <MarkBadge marks={leaveMarks} max={UNUTILIZED_LEAVE_MAX} hint={t("category.65.unutilizedLeave.hint", { years: inputs.unutilizedLeaveYears ?? 0, marks: leaveMarks })} />
          <FlagButton fieldKey="unutilizedLeaveYears" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <YearsSelect
          id={`transfer-unutilized-leave-${category.id}`}
          label={t("category.65.unutilizedLeave.yearsLabel")}
          value={inputs.unutilizedLeaveYears}
          onChange={(unutilizedLeaveYears) => onChange({ unutilizedLeaveYears })}
        />
      </div>
      <div className="grid gap-1.5 border-t pt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.61.nearbySchools.label")}</span>
          <MarkBadge marks={prox} max={PROXIMITY_MAX_63} hint={t("category.65.nearbySchools.hint", { school: getHomeSchoolDisplayName() })} />
          <FlagButton fieldKey="schoolsWithinRadius" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
          {selectedSchoolIds.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{t("category.common.selected", { count: selectedSchoolIds.length })}</span>
          )}
        </div>
        {hasCenter ? (
          <SchoolMapPicker
            centerLat={centerLat!}
            centerLng={centerLng!}
            selectedIds={selectedSchoolIds}
            highlightSchoolId={HOME_SCHOOL_ID}
            marksPerSchool={PROXIMITY_PER_SCHOOL_65}
            onToggle={(schoolId) =>
              onChange({
                schoolsWithinRadius: selectedSchoolIds.includes(schoolId)
                  ? selectedSchoolIds.filter((sid) => sid !== schoolId)
                  : [...selectedSchoolIds, schoolId],
              })
            }
          />
        ) : (
          <p className="text-xs text-muted-foreground">{t("category.noHomeLocation")}</p>
        )}
      </div>
    </div>
  );
}

export function Category66Fields({
  category,
  onChange,
  centerLat,
  centerLng,
  flaggedInputs,
  onToggleInputFlag,
}: {
  category: CategoryApplication;
  onChange: (patch: Partial<ScoringInputs>) => void;
  centerLat?: number;
  centerLng?: number;
} & FlagProps) {
  const { t } = useTranslation();
  const inputs = category.scoringInputs;
  const selectedSchoolIds = inputs.schoolsWithinRadius ?? [];
  const hasCenter = centerLat != null && centerLng != null;
  const abroad = yearsBetween(inputs.abroadStartDate, inputs.abroadEndDate);
  const abroadMarks = abroadPeriodMarks(abroad);
  const purposeMap: Record<string, number> = EMPLOYMENT_PURPOSE_MARKS;
  const purposeMarks = Math.min(purposeMap[inputs.employmentPurpose ?? ""] ?? 0, EMPLOYMENT_PURPOSE_MAX);
  const prox = proximityMarks(inputs, PROXIMITY_PER_SCHOOL_66, PROXIMITY_MAX_66);
  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.66.periodAbroad.label")}</span>
          <MarkBadge marks={abroadMarks} max={ABROAD_PERIOD_MAX} hint={t("category.66.periodAbroad.hint")} />
          <FlagButton fieldKey="abroadStartDate" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <DateField
          id={`abroad-start-${category.id}`}
          label={t("category.66.periodAbroad.dateLeft")}
          hint={t("category.66.periodAbroad.dateLeftHint")}
          value={inputs.abroadStartDate}
          onChange={(abroadStartDate) => onChange({ abroadStartDate })}
        />
        <DateField
          id={`abroad-end-${category.id}`}
          label={t("category.66.periodAbroad.dateReturned")}
          hint={t("category.66.periodAbroad.dateReturnedHint")}
          value={inputs.abroadEndDate}
          onChange={(abroadEndDate) => onChange({ abroadEndDate })}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.66.employmentPurpose.label")}</span>
          <MarkBadge marks={purposeMarks} max={EMPLOYMENT_PURPOSE_MAX} hint={t("category.66.employmentPurpose.hint")} />
          <FlagButton fieldKey="employmentPurpose" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
        </div>
        <Field>
          <FieldLabel>{t("category.66.employmentPurpose.purposeLabel")}</FieldLabel>
          <RadioGroup
            value={inputs.employmentPurpose ?? ""}
            onValueChange={(next) => onChange({ employmentPurpose: next as ScoringInputs["employmentPurpose"] })}
            className="flex flex-wrap gap-x-6 gap-y-2"
          >
            <RadioOption id={`ep-board-${category.id}`} value="board" label={t("category.66.employmentPurpose.board")} marks={EMPLOYMENT_PURPOSE_MARKS.board} />
            <RadioOption id={`ep-personal-${category.id}`} value="personal" label={t("category.66.employmentPurpose.personal")} marks={EMPLOYMENT_PURPOSE_MARKS.personal} />
            <RadioOption id={`ep-government-${category.id}`} value="government" label={t("category.66.employmentPurpose.government")} marks={EMPLOYMENT_PURPOSE_MARKS.government} />
            <RadioOption id={`ep-education-${category.id}`} value="education" label={t("category.66.employmentPurpose.education")} marks={EMPLOYMENT_PURPOSE_MARKS.education} />
          </RadioGroup>
        </Field>
      </div>
      <div className="grid gap-1.5 border-t pt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("category.61.nearbySchools.label")}</span>
          <MarkBadge marks={prox} max={PROXIMITY_MAX_66} hint={t("category.66.nearbySchools.hint", { school: getHomeSchoolDisplayName() })} />
          <FlagButton fieldKey="schoolsWithinRadius" flaggedInputs={flaggedInputs} onToggleInputFlag={onToggleInputFlag} />
          {selectedSchoolIds.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{t("category.common.selected", { count: selectedSchoolIds.length })}</span>
          )}
        </div>
        {hasCenter ? (
          <SchoolMapPicker
            centerLat={centerLat!}
            centerLng={centerLng!}
            selectedIds={selectedSchoolIds}
            highlightSchoolId={HOME_SCHOOL_ID}
            marksPerSchool={PROXIMITY_PER_SCHOOL_66}
            onToggle={(schoolId) =>
              onChange({
                schoolsWithinRadius: selectedSchoolIds.includes(schoolId)
                  ? selectedSchoolIds.filter((sid) => sid !== schoolId)
                  : [...selectedSchoolIds, schoolId],
              })
            }
          />
        ) : (
          <p className="text-xs text-muted-foreground">{t("category.noHomeLocation")}</p>
        )}
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
  categoryLabels,
  categoryMeta,
  t,
}: {
  category: CategoryApplication;
  occurrence?: number;
  centerLat?: number;
  centerLng?: number;
  onUpdate: (patch: Partial<ScoringInputs>) => void;
  onRemove: () => void;
  categoryLabels: Record<CategoryType, string>;
  categoryMeta: Record<CategoryType, { description: string; maxMarks: number }>;
  t: TFn;
}) {
  const draft = useApplicationStore();
  const selectedSchoolIds = category.scoringInputs.schoolsWithinRadius ?? [];
  const score = scoreCategory(category);
  const hasCenter = centerLat != null && centerLng != null;
  const locked = category.locked;
  const proximityConfig = PROXIMITY_CATEGORY_CONFIG[category.categoryType];

  // Nearby schools default to the objective geometry + gender-compatibility
  // computation (radius from home to the applied-to school, excluding
  // incompatible-gender schools), but the applicant can now manually
  // uncheck/include compatible schools \u2014 so this only seeds the initial
  // value once per category (when nothing has been chosen yet), it never
  // re-asserts the computed set over a manual edit afterwards.
  const seededSchoolsRef = useRef(false);
  useEffect(() => {
    if (!proximityConfig || !hasCenter || locked || seededSchoolsRef.current) return;
    if (category.scoringInputs.schoolsWithinRadius !== undefined) {
      seededSchoolsRef.current = true;
      return;
    }
    seededSchoolsRef.current = true;
    const { schoolIds } = compatibleSchoolsWithinRadius(centerLat!, centerLng!, HOME_SCHOOL_ID);
    onUpdate({ schoolsWithinRadius: schoolIds });
  }, [proximityConfig, hasCenter, locked, centerLat, centerLng, category.scoringInputs.schoolsWithinRadius, onUpdate]);

  return (
    <Card className={locked ? "border-2 border-muted bg-muted/30" : `border-2 ${CATEGORY_COLORS[category.categoryType].border}`}>
      <CardHeader className="border-b bg-muted/20">
        <div className="grid min-w-0 gap-1">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{t("category.sectionHeading.markingCategoryBadge")}</span>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {categoryLabels[category.categoryType]}
            {occurrence != null && (
              <span className="text-muted-foreground font-normal">{t("category.sectionHeading.entryNumber", { number: occurrence })}</span>
            )}
            {locked && <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{t("category.sectionHeading.locked")}</span>}
          </CardTitle>
          <CardDescription>{categoryMeta[category.categoryType].description}</CardDescription>
        </div>
        <CardAction className="grid gap-2 justify-items-end">
          <div className="grid gap-0.5 rounded-lg border bg-background px-3 py-2 text-right">
            <span className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">{t("category.sectionHeading.indicativeScore")}</span>
            <strong className="font-mono text-lg tabular-nums">
              {score.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}<span className="text-sm font-normal text-muted-foreground"> / {categoryMeta[category.categoryType].maxMarks}</span>
            </strong>
          </div>
          <div className="flex gap-1">
          <Button
            type="button"
            variant={locked ? "default" : "ghost"}
            size="sm"
            onClick={() => draft.updateCategoryInputs(category.id, { locked: !locked } as Partial<ScoringInputs>)}
          >
            {locked ? t("category.buttons.edit") : t("category.buttons.lock")}
          </Button>
          {!locked && (
            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onRemove}>
              {t("category.buttons.remove")}
            </Button>
          )}
          </div>
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
        {proximityConfig && hasCenter ? (
          <div className="grid gap-2 border-t pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                <p className="text-sm font-medium sr-only">{t("category.nearbySchools.title")}</p>
                <p className="text-xs text-muted-foreground">{t("category.nearbySchools.calculated")}</p>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {t("category.nearbySchools.selectedCount", { count: selectedSchoolIds.length, marksPerSchool: proximityConfig.marksPerSchool })}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("category.nearbySchools.explanation", { maxMarks: proximityConfig.maxMarks, marksPerSchool: proximityConfig.marksPerSchool })}
            </p>
            {locked ? (
              <p className="text-sm text-muted-foreground">
                {selectedSchoolIds.length > 0
                  ? t("category.nearbySchools.lockedSchools", { count: selectedSchoolIds.length })
                  : t("category.nearbySchools.lockedNoSchools")}
              </p>
            ) : (
              <SchoolMapPicker
                centerLat={centerLat}
                centerLng={centerLng}
                selectedIds={selectedSchoolIds}
            highlightSchoolId={HOME_SCHOOL_ID}
                marksPerSchool={proximityConfig.marksPerSchool}
                onToggle={(schoolId) =>
                  onUpdate({
                    schoolsWithinRadius: selectedSchoolIds.includes(schoolId)
                      ? selectedSchoolIds.filter((id) => id !== schoolId)
                      : [...selectedSchoolIds, schoolId],
                  })
                }
              />
            )}
          </div>
        ) : proximityConfig ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            {t("category.nearbySchools.noLocationHint")}
          </p>
        ) : null}
        <div className="grid gap-2 border-t pt-5">
          <p className="text-sm font-medium">{t("category.exampleMarks.heading", { category: categoryLabels[category.categoryType] })}</p>
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
            <span>{t("category.exampleMarks.indicativeTotal")}</span>
            <span className="font-mono tabular-nums">{score.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} / 100</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("category.exampleMarks.disclaimer")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CategoryStep() {
  const { t } = useTranslation();
  const draft = useApplicationStore();
  const { latitude, longitude } = draft.selectedLocation;

  const categoryLabels = getCategoryLabels(t);
  const tabLabels = getTabLabels(t);
  const categoryMeta = getCategoryMeta(t);

  const categoriesByType = new Map<CategoryType, CategoryApplication[]>();
  for (const cat of draft.categories) {
    const list = categoriesByType.get(cat.categoryType) ?? [];
    list.push(cat);
    categoriesByType.set(cat.categoryType, list);
  }

  const firstTypeWithEntries = CATEGORY_TYPES.find((categoryType) => (categoriesByType.get(categoryType)?.length ?? 0) > 0) ?? CATEGORY_TYPES[0];
  const categoryCount = draft.categories.length;

  return (
    <div className="grid w-full grid-cols-1 gap-6">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <h3 className="font-heading text-2xl">{t("category.sectionHeading.markingScheme")}</h3>
          <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
            {t("category.sectionHeading.description")}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{categoryCount}</span>
            <div className="grid gap-0.5">
              <strong className="text-sm">{t("category.sectionHeading.categoriesSelected", { count: categoryCount, plural: categoryCount === 1 ? "category" : "categories" })}</strong>
              <span className="text-xs text-muted-foreground">{t("category.sectionHeading.addRemoveHint")}</span>
            </div>
          </div>
          <span className="text-xs font-semibold text-primary">{t("category.sectionHeading.draftSaves")}</span>
        </div>
      </div>

      <Tabs defaultValue={firstTypeWithEntries}>
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1">
          {CATEGORY_TYPES.map((categoryType) => {
            const count = categoriesByType.get(categoryType)?.length ?? 0;
            const colors = CATEGORY_COLORS[categoryType];
            return (
              <TabsTrigger key={categoryType} value={categoryType} className={`shrink-0 flex items-center gap-1.5 text-xs ${colors.activeBg}`}>
                <span className={`size-1.5 shrink-0 rounded-full ${colors.dot}`} />
                {tabLabels[categoryType]}{count > 0 ? ` (${count})` : ""}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {CATEGORY_TYPES.map((categoryType) => {
          const entries = categoriesByType.get(categoryType) ?? [];
          return (
            <TabsContent key={categoryType} value={categoryType} className="grid grid-cols-1 gap-4 mt-4">
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-start py-2 text-left whitespace-normal"
                onClick={() => draft.addCategory(categoryType)}
              >
                {t("category.buttons.addCategory", { category: categoryLabels[categoryType] })}
              </Button>

              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-lg border p-4">
                  {t("category.noEntries")}
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
                        categoryLabels={categoryLabels}
                        categoryMeta={categoryMeta}
                        t={t}
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
