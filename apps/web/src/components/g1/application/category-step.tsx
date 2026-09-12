import { CATEGORY_COLORS, MARK_TOOLTIP, MISSING_INPUT, STATUS_ERROR, STATUS_WARNING } from "@/lib/color-classes";
import {
  CATEGORY_TYPES,
  type CategoryApplication,
  type CategoryType,
  type ScoringInputs,
  type OtherContributionEntry,
  type SocietyEntry,
  type SportsEntry,
  useApplicationStore,
} from "@/lib/g1/application-store";
import {
  ABROAD_PERIOD_MAX,
  ADDITIONAL_DOC_MAX_61,
  AL_MAX_MARKS,
  CATEGORY_MAX_MARKS,
  CONTRIBUTION_MAX,
  DEGREE_MAX,
  DIFFICULT_DISTANCE_RATE_TIERS,
  DIFFICULT_SERVICE_CURRENT_RATE,
  DIFFICULT_SERVICE_MAX,
  DIFFICULT_SERVICE_PREVIOUS_RATE,
  DIPLOMA_MARKS,
  electoralRegisterYears,
  ELECTORAL_MARKS_PER_PERSON_YEAR_63,
  ELECTORAL_MAX_61,
  ELECTORAL_MAX_63,
  EMPLOYMENT_PURPOSE_MARKS,
  EMPLOYMENT_PURPOSE_MAX,
  GRADE5_SCHOLARSHIP_MARKS,
  LEADERSHIP_MAX,
  MAIN_DOCUMENT_MAX_61,
  MAIN_DOCUMENT_MAX_63,
  OL_MAX_MARKS,
  OTHER_ACTIVITIES_MAX,
  PAST_PUPILS_LIFE_MEMBER_MARKS_PER_YEAR,
  PAST_PUPILS_LIFE_MEMBER_MAX,
  PAST_PUPILS_MEMBERSHIP_MAX,
  PAST_PUPILS_COMMITTEE_MARKS_PER_YEAR,
  PAST_PUPILS_EXECUTIVE_MARKS,
  PAST_PUPILS_EXECUTIVE_COUNT,
  PAST_PUPILS_COMMITTEE_EXECUTIVE_MAX,
  PAST_PUPILS_TOTAL_MAX,
  PAST_PUPILS_YEARLY_MARKS,
  PROXIMITY_MAX_61,
  PROXIMITY_MAX_63,
  PROXIMITY_MAX_65,
  PROXIMITY_MAX_66,
  PROXIMITY_PER_SCHOOL_61,
  PROXIMITY_PER_SCHOOL_63,
  PROXIMITY_PER_SCHOOL_65,
  PROXIMITY_PER_SCHOOL_66,
  RESIDENCE_DISTANCE_FALLBACK_64,
  RESIDENCE_DISTANCE_MAX_64,
  RESIDENCE_DISTANCE_TIERS_64,
  SCHOOL_PROJECTS_MARKS,
  CONTRIBUTION_PATH1_SAME_SCHOOL_RATE,
  CONTRIBUTION_PATH1_ELSEWHERE_RATE,
  CONTRIBUTION_PATH1_SAME_SCHOOL_MAX,
  CONTRIBUTION_PATH1_ELSEWHERE_MAX,
  CONTRIBUTION_PATH2_RATE_PER_ITEM,
  CONTRIBUTION_PATH2_ITEM_MAX,
  SCHOOL_EDUCATION_CONTRIBUTION_MAX,
  SERVICE_PERIOD_MAX,
  SHRAMADANA_CONTRIBUTION,
  SIBLING_COCURRICULAR_TOTAL_MAX,
  SIBLING_EXAM_MAX,
  SIBLING_MARKS_PER_GRADE,
  SIBLING_MULTIPLE_STUDYING_MARKS,
  SIBLING_LEADERSHIP_MARKS,
  SIBLING_SPORTS_MAX,
  SIBLING_STUDIED_HERE_MARKS,
  SIBLING_GRADES_MAX,
  SIBLING_SUPPORT_MARKS,
  SPORTS_MAX,
  CARNIVAL_CONTRIBUTION,
  STUDENT_SOCIETIES_MAX,
  TRANSFER_DISTANCE_MAX,
  TRANSFER_ELAPSED_MAX,
  TRANSFER_PREVIOUS_PERIOD_MAX,
  TRANSFER_SERVICE_PERIOD_MAX,
  UNUTILIZED_LEAVE_MARKS_PER_YEAR,
  UNUTILIZED_LEAVE_MAX,
  WORKPLACE_DISTANCE_MAX,
  YEARS_EDUCATED_MARKS_PER_YEAR,
  YEARS_EDUCATED_MAX,
} from "@/lib/g1/marking-scheme";
import { HOME_SCHOOL_ID, getHomeSchoolDisplayName } from "@/lib/g1/school-config";
import { compatibleSchoolsWithinRadius } from "@/lib/g1/school-utils";
import {
  AL_CEILINGS,
  DEGREE_MARKS,
  LEADERSHIP_ROLE_MARKS,
  MAIN_DOCUMENT_MARKS_61,
  MAIN_DOCUMENT_MARKS_63,
  OL_CEILINGS,
  OTHER_ACTIVITY_MARKS,
  SIBLING_EXAM_MARKS,
  SIBLING_SPORTS_LEVEL_MARKS,
  SPORTS_LEVEL_MARKS,
  STUDENT_SOCIETIES_ROLE_MARKS,
  abroadPeriodMarks,
  additionalDocsMarks61,
  deedAgeWeight,
  contributionMarks64,
  difficultServiceCurrentMarks,
  difficultServicePreviousMarks,
  difficultServiceDistanceMarks,
  documentMarks61,
  electoralMarks61,
  electoralYearsRegistered,
  gradeRate,
  previousPeriodMarks as previousPeriodMarksFn,
  proximityMarks,
  proximityMarks61,
  scoreCategory,
  tieredDistanceMarks,
  transferDistanceMarks,
  transferElapsedMarks as transferElapsedMarksFn,
  workplaceDistanceMarks,
  yearsBetween,
  yearsFromDate,
  yearsAndMonthsBetween,
  wholeYearsFromDate,
} from "@/lib/g1/scoring";
import { useTranslation } from "@/lib/i18n";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@aloysius-admissions/ui/components/alert-dialog";
import { Button } from "@aloysius-admissions/ui/components/button";
import { buttonVariants } from "@aloysius-admissions/ui/components/button";
import { Calendar } from "@aloysius-admissions/ui/components/calendar";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@aloysius-admissions/ui/components/card";
import { CardFooter } from "@aloysius-admissions/ui/components/card";
import { Checkbox } from "@aloysius-admissions/ui/components/checkbox";
import { Separator } from "@aloysius-admissions/ui/components/separator";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@aloysius-admissions/ui/components/empty";
import { Field, FieldLabel } from "@aloysius-admissions/ui/components/field";
import { Input } from "@aloysius-admissions/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@aloysius-admissions/ui/components/popover";
import { RadioGroup, RadioGroupItem } from "@aloysius-admissions/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@aloysius-admissions/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableRow,
} from "@aloysius-admissions/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aloysius-admissions/ui/components/tabs";
import { Textarea } from "@aloysius-admissions/ui/components/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@aloysius-admissions/ui/components/tooltip";
import { cn } from "@aloysius-admissions/ui/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Flag, MapPin, Plus, X as XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DropdownProps } from "react-day-picker";
import { SchoolMapPicker } from "./school-map-picker";

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
  return t("category.common.marksSuffix", {
    marks: marks.toLocaleString(undefined, { maximumFractionDigits: 2 }),
  });
}
function withMarks(
  options: readonly (readonly [string, string])[],
  marksMap: Record<string, number>,
  t: TFn,
) {
  return options.map(
    ([value, label]) => [value, `${label} - ${markSuffix(t, marksMap[value] ?? 0)}`] as const,
  );
}

function getMainDocumentOptions(t: TFn) {
  return withMarks(
    [
      ["title-deed-applicant", t("category.mainDocumentOptions.titleDeedApplicant")],
      ["title-deed-parents", t("category.mainDocumentOptions.titleDeedParents")],
      ["feeder-electoral-5yrs", t("category.mainDocumentOptions.feederElectoral5yrs")],
      ["lease-deed", t("category.mainDocumentOptions.leaseDeed")],
      ["municipal-ds-certificate", t("category.mainDocumentOptions.municipalDsCertificate")],
      ["other-documents", t("category.mainDocumentOptions.otherDocuments")],
    ] as const,
    MAIN_DOCUMENT_MARKS_61,
    t,
  );
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
    ["10", t("category.olSubjectOptions.10")],
  ] as const;
}

function getAlSubjectOptions(t: TFn) {
  return [
    ["3", t("category.alSubjectOptions.3")],
    ["4", t("category.alSubjectOptions.4")],
  ] as const;
}

function getLeadershipRoleOptions(t: TFn) {
  return withMarks(
    [
      ["prefect-primary", t("category.leadershipRoleOptions.prefectPrimary")],
      ["prefect-junior", t("category.leadershipRoleOptions.prefectJunior")],
      ["prefect-senior", t("category.leadershipRoleOptions.prefectSenior")],
      ["deputy-head-prefect", t("category.leadershipRoleOptions.deputyHeadPrefect")],
      ["head-prefect", t("category.leadershipRoleOptions.headPrefect")],
      ["first-team-vice-captain", t("category.leadershipRoleOptions.firstTeamViceCaptain")],
      ["first-team-captain", t("category.leadershipRoleOptions.firstTeamCaptain")],
    ] as const,
    LEADERSHIP_ROLE_MARKS,
    t,
  );
}

function getStudentSocietiesRoleOptions(t: TFn) {
  return withMarks(
    [
      ["committee-member", t("category.studentSocietiesRoleOptions.committeeMember")],
      ["vice-president", t("category.studentSocietiesRoleOptions.vicePresident")],
      ["president", t("category.studentSocietiesRoleOptions.president")],
    ] as const,
    STUDENT_SOCIETIES_ROLE_MARKS,
    t,
  );
}

function getOtherActivityOptions(t: TFn) {
  return withMarks(
    [
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
    ] as const,
    OTHER_ACTIVITY_MARKS,
    t,
  );
}

function getDegreeOptions(t: TFn) {
  return withMarks(
    [
      ["first-degree", t("category.degreeOptions.firstDegree")],
      ["postgraduate", t("category.degreeOptions.postgraduate")],
      ["doctorate", t("category.degreeOptions.doctorate")],
      ["chartered-professional", t("category.degreeOptions.charteredProfessional")],
    ] as const,
    DEGREE_MARKS,
    t,
  );
}

function getSiblingExamOptions(t: TFn) {
  return withMarks(
    [
      ["scholarship", t("category.siblingExamOptions.scholarship")],
      ["ol", t("category.siblingExamOptions.ol")],
      ["al", t("category.siblingExamOptions.al")],
    ] as const,
    SIBLING_EXAM_MARKS,
    t,
  );
}

function getSiblingDocumentOptions(t: TFn) {
  return withMarks(
    [
      [
        "title-deed-applicant-spouse",
        t("category.siblingDocumentOptions.titleDeedApplicantSpouse"),
      ],
      ["title-deed-parents", t("category.siblingDocumentOptions.titleDeedParents")],
      ["feeder-electoral-5yrs", t("category.siblingDocumentOptions.feederElectoral5yrs")],
      ["lease-deed", t("category.siblingDocumentOptions.leaseDeed")],
      ["municipal-ds-rentact-cert", t("category.siblingDocumentOptions.municipalDsRentactCert")],
      ["other-documents", t("category.siblingDocumentOptions.otherDocuments")],
    ] as const,
    MAIN_DOCUMENT_MARKS_63,
    t,
  );
}

const YEAR_OPTIONS = [0, 1, 2, 3, 4, 5];

const PROXIMITY_CATEGORY_CONFIG: Partial<
  Record<CategoryType, { marksPerSchool: number; maxMarks: number }>
> = {
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
  missing = false,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** Amber-highlight the box while it is empty, so a 0 marks badge has a
   * visible cause (this field still needs a value). */
  missing?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Field>
      <FieldLabel htmlFor={id} className={cn(missing && MISSING_INPUT.label)}>
        {label}
      </FieldLabel>
      <Input
        id={id}
        type="number"
        min={0}
        step="1"
        value={value ?? ""}
        placeholder={t("category.common.enterNumber")}
        className={cn(missing && MISSING_INPUT.control)}
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
  missing = false,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (years: number) => void;
  /** Amber-highlight the select while nothing is chosen yet. */
  missing?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Field>
      <FieldLabel htmlFor={id} className={cn(missing && MISSING_INPUT.label)}>
        {label}
      </FieldLabel>
      <Select
        value={value != null ? String(value) : null}
        onValueChange={(next) => onChange(Number(next))}
      >
        <SelectTrigger id={id} className={cn("w-full", missing && MISSING_INPUT.control)}>
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

/** Parses a stored `YYYY-MM-DD` value for use as a Calendar min/maxDate. */
function parseDateOrUndefined(value: string | undefined): Date | undefined {
  return value ? new Date(`${value}T00:00:00`) : undefined;
}

function DateField({
  id,
  label,
  hint,
  value,
  onChange,
  minDate,
  maxDate,
  missing = false,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
  /** Amber-highlight the date box while no date is set. */
  missing?: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id} className={cn("flex items-center gap-1.5", missing && MISSING_INPUT.label)}>
        {label}
        {hint && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="text-muted-foreground text-xs cursor-help">
                ⓘ
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs whitespace-normal">
                {hint}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </FieldLabel>
      <CalendarDatePicker
        id={id}
        value={value}
        onChange={onChange}
        minDate={minDate}
        maxDate={maxDate}
        missing={missing}
      />
    </Field>
  );
}

function CalendarDatePicker({
  id,
  value,
  onChange,
  minDate,
  maxDate,
  missing = false,
}: {
  id: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
  missing?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const parsedDate = value ? new Date(`${value}T00:00:00`) : undefined;
  // Bound the year dropdown by default - without min/max, react-day-picker
  // renders an effectively unbounded year list, which breaks the nested
  // Select popover's floating-ui positioning (it renders detached at the top
  // of the viewport instead of anchored under the trigger).
  const now = new Date();
  const effectiveMinDate = minDate ?? new Date(now.getFullYear() - 100, 0, 1);
  const effectiveMaxDate = maxDate ?? new Date(now.getFullYear() + 5, 11, 31);

  return (
    <div className="relative w-full">
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
      <PopoverTrigger
        id={id}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 md:text-sm [&>span]:line-clamp-1",
          missing && MISSING_INPUT.control,
        )}
      >
        <span className={parsedDate ? "" : "text-muted-foreground"}>
          {parsedDate ? format(parsedDate, "dd/MM/yyyy") : "dd/mm/yyyy"}
        </span>
        {!parsedDate && <CalendarIcon className="size-4 opacity-50" />}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsedDate}
          defaultMonth={parsedDate ?? maxDate ?? now}
          captionLayout="dropdown"
          startMonth={effectiveMinDate}
          endMonth={effectiveMaxDate}
          disabled={(date) =>
            (maxDate != null && date > maxDate) || (minDate != null && date < minDate)
          }
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
    {parsedDate && (
      <button
        type="button"
        aria-label="Clear date"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={(event) => {
          event.stopPropagation();
          onChange(undefined);
        }}
      >
        <XIcon className="size-3.5" />
      </button>
    )}
    </div>
  );
}

// A native <select> for the calendar's month/year navigation, instead of the
// shared Calendar's own popover-based Select - nesting that Select's
// floating popover inside this component's own Popover breaks floating-ui's
// position calculation (it renders detached at the top of the viewport). A
// native select has no popover of its own, so there's nothing to conflict.
function NativeCalendarDropdown({
  options,
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: DropdownProps) {
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

function ElectoralYearCheckboxes({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number[] | undefined;
  onChange: (years: number[]) => void;
}) {
  const years = electoralRegisterYears();
  const selected = value ?? [];
  const toggle = (year: number) => {
    onChange(selected.includes(year) ? selected.filter((existing) => existing !== year) : [...selected, year]);
  };
  return (
    <Field>
      <FieldLabel htmlFor={id} className="flex items-center gap-1.5">
        {label}
        {hint && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="text-muted-foreground text-xs cursor-help">
                
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs whitespace-normal">
                {hint}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </FieldLabel>
      <div className="flex flex-wrap gap-4" id={id}>
        {years.map((year) => (
          <label
            key={year}
            htmlFor={`${id}-${year}`}
            className="flex items-center gap-2 text-sm cursor-pointer"
      >
            <Checkbox
              id={`${id}-${year}`}
              className="size-5"
              checked={selected.includes(year)}
              onCheckedChange={() => toggle(year)}
            />
              {year}
          </label>
          ))}
      </div>
    </Field>
  );
}

function RadioOption({
  id,
  value,
  label,
  marks,
  note,
}: { id: string; value: string; label: string; marks?: number; note?: string }) {
  const { t } = useTranslation();
  return (
    <FieldLabel htmlFor={id} className="flex w-fit cursor-pointer items-center gap-2 font-normal">
      <RadioGroupItem id={id} value={value} />
      {label}
      {marks != null && (
        <span className="text-xs text-muted-foreground">({markSuffix(t, marks)})</span>
      )}
      {note != null && <span className="text-xs text-muted-foreground">({note})</span>}
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
      <FieldLabel htmlFor={`main-document-type-${category.id}`} className="sr-only">
        {t("category.mainDocument.title")}
      </FieldLabel>
      <Select value={value} onValueChange={(next) => onChange({ mainDocumentType: String(next) })}>
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
      additionalDocs: docs.includes(doc)
        ? docs.filter((existing) => existing !== doc)
        : [...docs, doc],
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

/** Checkbox matrix for up to 5 named sports, each with a checkbox per
 * competition level - a sport can have more than one level checked (e.g.
 * achieved at Zonal one year, National another), each contributing its own
 * marks; the section-level cap still applies. */
function SportsTable({
  id,
  entries,
  columns,
  onChange,
  field = "sportsEntries",
  rowCount = 5,
  nameColumnLabel,
  namePlaceholder,
}: {
  id: string;
  entries: SportsEntry[];
  columns: readonly (readonly [string, string, number])[];
  onChange: (patch: Partial<ScoringInputs>) => void;
  field?: "sportsEntries" | "siblingSportsEntries";
  rowCount?: number;
  nameColumnLabel: string;
  namePlaceholder: (number: number) => string;
}) {
  const rowIndexes = Array.from({ length: rowCount }, (_, index) => index);
  return (
    <div className="overflow-x-auto">
      <table className="table-fixed text-sm border-collapse">
        <thead>
          <tr>
            <th className="w-32 text-left pb-1.5 pr-2 text-xs font-medium text-muted-foreground">
              {nameColumnLabel}
            </th>
            {columns.map(([value, label, marks]) => (
              <th key={value} className="w-16 pb-1.5 px-1 text-center text-[0.65rem] font-medium text-muted-foreground">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="block w-full truncate cursor-help">{label}</TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs whitespace-normal">
                      {label}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="font-normal opacity-70">({marks})</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowIndexes.map((index) => {
            const entry = entries[index] ?? {};
            const levels = entry.levels ?? [];
            const updateRow = (patch: Partial<SportsEntry>) => {
              const next = [...entries];
              while (next.length <= index) next.push({});
              next[index] = { ...next[index], ...patch };
              onChange({ [field]: next } as Partial<ScoringInputs>);
            };
            return (
              <tr key={index} className="border-t border-border/60">
                <td className="py-1.5 pr-2">
                  <Input
                    id={`sports-name-${id}-${index}`}
                    type="text"
                    value={entry.name ?? ""}
                    placeholder={namePlaceholder(index + 1)}
                    onChange={(event) => updateRow({ name: event.target.value || undefined })}
                    className="h-8 text-xs"
                  />
                </td>
                {columns.map(([value]) => (
                  <td key={value} className="py-1.5 px-1">
                    <div className="flex justify-center">
                      <Checkbox
                        className="size-4"
                        checked={levels.includes(value)}
                        onCheckedChange={() =>
                          updateRow({
                            levels: levels.includes(value) ? levels.filter((v) => v !== value) : [...levels, value],
                          })
                        }
                      />
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Checkbox matrix for up to 5 named school societies/clubs, each with a
 * checkbox per role held - marks summed across every checked cell, capped
 * at the section max. */
function SocietiesTable({
  id,
  entries,
  columns,
  onChange,
  t,
}: {
  id: string;
  entries: SocietyEntry[];
  columns: readonly (readonly [string, string, number, string?])[];
  onChange: (patch: Partial<ScoringInputs>) => void;
  t: TFn;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="table-fixed text-sm border-collapse">
        <thead>
          <tr>
            <th className="w-32 text-left pb-1.5 pr-2 text-xs font-medium text-muted-foreground">
              {t("category.62.studentSocieties.nameColumnLabel")}
            </th>
            {columns.map(([value, label, marks, fullLabel]) => (
              <th key={value} className="w-16 pb-1.5 px-1 text-center text-[0.65rem] font-medium text-muted-foreground">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="block w-full truncate cursor-help">{label}</TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs whitespace-normal">
                      {fullLabel ?? label}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="font-normal opacity-70">({marks})</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4].map((index) => {
            const entry = entries[index] ?? {};
            const roles = entry.roles ?? [];
            const updateRow = (patch: Partial<SocietyEntry>) => {
              const next = [...entries];
              while (next.length <= index) next.push({});
              next[index] = { ...next[index], ...patch };
              onChange({ studentSocietiesEntries: next });
            };
            return (
              <tr key={index} className="border-t border-border/60">
                <td className="py-1.5 pr-2">
                  <Input
                    id={`student-societies-name-${id}-${index}`}
                    type="text"
                    value={entry.name ?? ""}
                    placeholder={t("category.62.studentSocieties.namePlaceholder", { number: index + 1 })}
                    onChange={(event) => updateRow({ name: event.target.value || undefined })}
                    className="h-8 text-xs"
                  />
                </td>
                {columns.map(([value]) => (
                  <td key={value} className="py-1.5 px-1">
                    <div className="flex justify-center">
                      <Checkbox
                        className="size-4"
                        checked={roles.includes(value)}
                        onCheckedChange={() =>
                          updateRow({
                            roles: roles.includes(value) ? roles.filter((v) => v !== value) : [...roles, value],
                          })
                        }
                      />
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FlagButton({
  fieldKey,
  flaggedInputs,
  onToggleInputFlag,
}: { fieldKey: string } & FlagProps) {
  const { t } = useTranslation();
  if (!onToggleInputFlag || !flaggedInputs) return null;
  const isFlagged = flaggedInputs.has(fieldKey);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggleInputFlag(fieldKey);
      }}
      className={`rounded-md p-1 transition-colors ${isFlagged ? `${STATUS_ERROR.bgSolid} ${STATUS_ERROR.text} ${STATUS_ERROR.hoverBg}` : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
      title={
        isFlagged
          ? t("category.common.flagTitle.flagged")
          : t("category.common.flagTitle.unflagged")
      }
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
  const electoralYears = electoralRegisterYears();
  const electoralHintYears = {
    startYear: electoralYears[0],
    endYear: electoralYears[electoralYears.length - 1],
  };
  const deedYears = yearsFromDate(inputs.deedTransferDate);
  const deedWeight = deedAgeWeight(deedYears);
  const deedPct = Math.round(deedWeight * 100);
  const selectedSchoolIds = inputs.schoolsWithinRadius ?? [];
  const hasCenter = Number.isFinite(centerLat) && Number.isFinite(centerLng);
  const mainDocumentOptions = getMainDocumentOptions(t);
  const additionalDocOptions = getAdditionalDocOptions(t);
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{t("category.61.mainDocument.label")}</span>
            <MarkBadge
              marks={docMarks}
              max={MAIN_DOCUMENT_MAX_61}
              hint={t("category.61.mainDocument.hint")}
            />
            <FlagButton
              fieldKey="mainDocumentType"
              flaggedInputs={flaggedInputs}
              onToggleInputFlag={onToggleInputFlag}
            />
          </div>
          <DocumentTypeSelect
            category={category}
            onChange={onChange}
            options={mainDocumentOptions}
          />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{t("category.61.documentRegistrationDate")}</span>
            <FlagButton
              fieldKey="deedTransferDate"
              flaggedInputs={flaggedInputs}
              onToggleInputFlag={onToggleInputFlag}
            />
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
          <span className="text-sm font-semibold">{t("category.61.supportingDocs.label")}</span>
          <MarkBadge
            marks={addlMarks}
            max={ADDITIONAL_DOC_MAX_61}
            hint={t("category.61.supportingDocs.hint")}
          />
          <FlagButton
            fieldKey="additionalDocs"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
        </div>
        <AdditionalDocsCheckboxGroup
          category={category}
          onChange={onChange}
          options={additionalDocOptions}
        />
      </div>
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{t("category.61.electoralMother.label")}</span>
            <FlagButton
              fieldKey="electoralMotherYears"
              flaggedInputs={flaggedInputs}
              onToggleInputFlag={onToggleInputFlag}
            />
          </div>
          <ElectoralYearCheckboxes
            id={`electoral-mother-year-${category.id}`}
            label={t("category.61.electoralMother.yearLabel")}
            hint={t("category.61.electoralMother.hint", electoralHintYears)}
            value={inputs.electoralMotherYears}
            onChange={(electoralMotherYears) => onChange({ electoralMotherYears })}
          />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{t("category.61.electoralFather.label")}</span>
            <FlagButton
              fieldKey="electoralFatherYears"
              flaggedInputs={flaggedInputs}
              onToggleInputFlag={onToggleInputFlag}
            />
          </div>
          <ElectoralYearCheckboxes
            id={`electoral-father-year-${category.id}`}
            label={t("category.61.electoralFather.yearLabel")}
            hint={t("category.61.electoralFather.hint", electoralHintYears)}
            value={inputs.electoralFatherYears}
            onChange={(electoralFatherYears) => onChange({ electoralFatherYears })}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 border-t pt-3">
        <span className="text-sm font-semibold">{t("category.61.electoralTotal")}</span>
        <MarkBadge
          marks={electoral}
          max={ELECTORAL_MAX_61}
          hint={t("category.61.electoralTotal.hint")}
        />
      </div>
      <div className="grid gap-1.5 border-t pt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.61.nearbySchools.label")}</span>
          <MarkBadge
            marks={prox}
            max={PROXIMITY_MAX_61}
            hint={t("category.61.nearbySchools.hint", { school: getHomeSchoolDisplayName() })}
          />
          <FlagButton
            fieldKey="schoolsWithinRadius"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
          {selectedSchoolIds.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {t("category.common.selected", { count: selectedSchoolIds.length })}
            </span>
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
    <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
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

        // Each O/L subject-count table's top grade is Distinction ("D").
        // The underlying field keys stay olGradeA/olGradeB (matching the
        // shared S/C/B/A scoring plumbing every subject-count table uses) -
        // only the label shown to the applicant changes: "A" is top for the
        // 9 and 10-subject tables, "B" is top for the 6 and 8-subject ones.
        const isTopOlGrade =
          prefix === "ol" &&
          ((totalCount === 10 && grade === "A") ||
            ((totalCount === 6 || totalCount === 8) && grade === "B"));
        const displayGrade = isTopOlGrade ? "D" : grade;

        return (
          <Field key={`${category.id}-${key}`}>
            <FieldLabel htmlFor={`${prefix}-grade-${grade}-${category.id}`}>
              {t("category.common.gradePasses", { grade: displayGrade })}
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

/** Up to 4 free-text "other" school-contribution entries (e.g. a carnival
 * stall, prize-giving assistance) - each entry pairs a times-contributed
 * count with a description of what it was, at the same per-occasion rate
 * as Carnivals/Shramadana, under the shared section cap. */
function OtherContributionRows({
  id,
  entries,
  onChange,
  rowCount = 4,
}: {
  id: string;
  entries: OtherContributionEntry[];
  onChange: (patch: Partial<ScoringInputs>) => void;
  rowCount?: number;
}) {
  const { t } = useTranslation();
  const rowIndexes = Array.from({ length: rowCount }, (_, index) => index);
  return (
    <div className="grid gap-2">
      {rowIndexes.map((index) => {
        const entry = entries[index] ?? {};
        const updateRow = (patch: Partial<OtherContributionEntry>) => {
          const next = [...entries];
          while (next.length <= index) next.push({});
          next[index] = { ...next[index], ...patch };
          onChange({ otherContributionEntries: next });
        };
        return (
          <div key={index} className="flex items-center gap-2">
            <Input
              id={`other-contribution-count-${id}-${index}`}
              type="number"
              min={0}
              step="1"
              value={entry.count ?? ""}
              placeholder="0"
              className="w-16 shrink-0"
              onChange={(event) => updateRow({ count: parseNumber(event.target.value) })}
              aria-label={t("category.62.contribution.otherCountLabel", { row: index + 1 })}
            />
            <Input
              id={`other-contribution-description-${id}-${index}`}
              type="text"
              value={entry.description ?? ""}
              placeholder={t("category.62.contribution.otherDescriptionPlaceholder")}
              onChange={(event) => updateRow({ description: event.target.value || undefined })}
              aria-label={t("category.62.contribution.otherDescriptionLabel", { row: index + 1 })}
            />
          </div>
        );
      })}
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
  const sportsMarks = Math.min(
    (inputs.sportsEntries ?? []).reduce(
      (sum, entry) => sum + (entry.levels ?? []).reduce((s, level) => s + (SPORTS_LEVEL_MARKS[level] ?? 0), 0),
      0,
    ),
    SPORTS_MAX,
  );
  const leadershipMarks = Math.min(
    (inputs.leadershipRoles ?? []).reduce((sum, role) => sum + (LEADERSHIP_ROLE_MARKS[role] ?? 0), 0),
    LEADERSHIP_MAX,
  );
  const studentSocietiesMarks = Math.min(
    (inputs.studentSocietiesEntries ?? []).reduce(
      (sum, entry) => sum + (entry.roles ?? []).reduce((s, role) => s + (STUDENT_SOCIETIES_ROLE_MARKS[role] ?? 0), 0),
      0,
    ),
    STUDENT_SOCIETIES_MAX,
  );
  const otherActivityMarks = Math.min(
    (inputs.otherActivities ?? []).reduce((sum, activity) => sum + (OTHER_ACTIVITY_MARKS[activity] ?? 0), 0),
    OTHER_ACTIVITIES_MAX,
  );

  // Past Pupils' Association marks
  let pastPupilsMarks = 0;
  if (inputs.pastPupilsLifeMember) {
    const years = yearsFromDate(inputs.pastPupilsLifeMemberStart);
    pastPupilsMarks += Math.min(years * PAST_PUPILS_LIFE_MEMBER_MARKS_PER_YEAR, PAST_PUPILS_LIFE_MEMBER_MAX);
  } else if (inputs.pastPupilsMembershipStart && inputs.pastPupilsMembershipEnd) {
    const years = yearsBetween(inputs.pastPupilsMembershipStart, inputs.pastPupilsMembershipEnd);
    pastPupilsMarks += Math.min(years * PAST_PUPILS_YEARLY_MARKS, PAST_PUPILS_MEMBERSHIP_MAX);
  }
  pastPupilsMarks += Math.min(
    (inputs.pastPupilsCommitteeYears ?? 0) * PAST_PUPILS_COMMITTEE_MARKS_PER_YEAR +
      Math.min(inputs.pastPupilsExecutiveCount ?? 0, PAST_PUPILS_EXECUTIVE_COUNT) * PAST_PUPILS_EXECUTIVE_MARKS,
    PAST_PUPILS_COMMITTEE_EXECUTIVE_MAX,
  );
  pastPupilsMarks = Math.min(pastPupilsMarks, PAST_PUPILS_TOTAL_MAX);

  // Degree marks
  const degreeMarks = Math.min(DEGREE_MARKS[inputs.highestDegree ?? ""] ?? 0, DEGREE_MAX);
  const diplomaMarks = inputs.hasDiploma ? DIPLOMA_MARKS : 0;

  // Contribution marks
  let contributionMarks = 0;
  contributionMarks += (inputs.carnivalContribution ?? 0) * CARNIVAL_CONTRIBUTION;
  contributionMarks += (inputs.shramadanaContribution ?? 0) * SHRAMADANA_CONTRIBUTION;
  const otherContributionCount = (inputs.otherContributionEntries ?? []).reduce(
    (sum, entry) => sum + (entry.count ?? 0),
    0,
  );
  contributionMarks += otherContributionCount * CARNIVAL_CONTRIBUTION;
  contributionMarks = Math.min(contributionMarks, CONTRIBUTION_MAX);
  const projectMarks = inputs.schoolProjectsContribution ? SCHOOL_PROJECTS_MARKS : 0;

  const olSubjectOptions = getOlSubjectOptions(t);
  const alSubjectOptions = getAlSubjectOptions(t);
  const leadershipRoleOptions = getLeadershipRoleOptions(t);
  const otherActivityOptions = getOtherActivityOptions(t);
  const degreeOptions = getDegreeOptions(t);
  const sportsLevelColumns = [
    ["inter-house", t("category.sportsLevelOptions.interHouse"), SPORTS_LEVEL_MARKS["inter-house"]],
    ["zonal", t("category.sportsLevelOptions.zonal"), SPORTS_LEVEL_MARKS.zonal],
    ["district", t("category.sportsLevelOptions.district"), SPORTS_LEVEL_MARKS.district],
    ["provincial", t("category.sportsLevelOptions.provincial"), SPORTS_LEVEL_MARKS.provincial],
    ["national", t("category.sportsLevelOptions.national"), SPORTS_LEVEL_MARKS.national],
    ["international", t("category.sportsLevelOptions.international"), SPORTS_LEVEL_MARKS.international],
  ] as const;
  const studentSocietiesRoleColumns = [
    ["committee-member", t("category.studentSocietiesRoleOptions.committeeMember"), STUDENT_SOCIETIES_ROLE_MARKS["committee-member"]],
    [
      "vice-president",
      t("category.studentSocietiesRoleOptions.vicePresidentShort"),
      STUDENT_SOCIETIES_ROLE_MARKS["vice-president"],
      t("category.studentSocietiesRoleOptions.vicePresident"),
    ],
    [
      "president",
      t("category.studentSocietiesRoleOptions.presidentShort"),
      STUDENT_SOCIETIES_ROLE_MARKS.president,
      t("category.studentSocietiesRoleOptions.president"),
    ],
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1 max-md:rounded-xl max-md:border max-md:border-border/70 max-md:bg-muted/10 max-md:p-3 max-md:gap-3">
      {/* Years educated */}
      <div className="grid gap-1.5 col-span-2 max-md:col-span-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.62.yearsEducated.label")}</span>
          <MarkBadge
            marks={yearsMarks}
            max={YEARS_EDUCATED_MAX}
            hint={t("category.62.yearsEducated.hint", {
              years: Math.floor(years),
              marks: yearsMarks,
            })}
          />
          <FlagButton
            fieldKey="alumniStartDate"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
        </div>
        <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
          <DateField
            id={`alumni-start-${id}`}
            label={t("category.62.startDate.label")}
            hint={t("category.62.startDate.hint", { school: getHomeSchoolDisplayName() })}
            value={inputs.alumniStartDate}
            onChange={(alumniStartDate) => onChange({ alumniStartDate })}
            maxDate={parseDateOrUndefined(inputs.alumniEndDate)}
          />
          <DateField
            id={`alumni-end-${id}`}
            label={t("category.62.endDate.label")}
            hint={t("category.62.endDate.hint", { school: getHomeSchoolDisplayName() })}
            value={inputs.alumniEndDate}
            onChange={(alumniEndDate) => onChange({ alumniEndDate })}
            minDate={parseDateOrUndefined(inputs.alumniStartDate)}
          />
        </div>
      </div>

      <Separator className="hidden col-span-2 max-md:block" />

      {/* Grade 5 Scholarship */}
      <div className="col-span-2 grid content-start gap-2 max-md:col-span-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.62.grade5Scholarship.label")}</span>
          <MarkBadge
            marks={scholarshipMarks}
            max={GRADE5_SCHOLARSHIP_MARKS}
            hint={t("category.62.grade5Scholarship.hint")}
          />
          <FlagButton
            fieldKey="grade5ScholarshipPassed"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
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

      <Separator className="hidden col-span-2 max-md:block" />

      {/* G.C.E. (O/L) */}
      <div className="grid content-start gap-1.5 rounded-xl border border-border/70 bg-muted/10 p-3 max-md:col-span-1 max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:rounded-none">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.62.olResult.label")}</span>
          <MarkBadge
            marks={(() => {
              let m = 0;
              const c = inputs.olSubjectCount;
              const t2 = c != null ? OL_CEILINGS[c] : undefined;
              if (t2 && c != null) {
                for (const g of ["S", "C", "B", "A"]) {
                  m += (inputs[`olGrade${g}` as "olGradeS"] ?? 0) * gradeRate(t2, c, g);
                }
              }
              return Math.min(m, OL_MAX_MARKS);
            })()}
            max={OL_MAX_MARKS}
            hint={t("category.62.olResult.hint")}
          />
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
            grades={
              inputs.olSubjectCount === 9
                ? ["S", "C", "B", "A"]
                : inputs.olSubjectCount === 10
                  ? ["S", "C", "A"]
                  : ["S", "C", "B"]
            }
            totalCount={inputs.olSubjectCount}
            onChange={onChange}
          />
        )}
      </div>

      <Separator className="hidden col-span-2 max-md:block" />

      {/* G.C.E. (A/L) */}
      <div className="grid content-start gap-1.5 rounded-xl border border-border/70 bg-muted/10 p-3 max-md:col-span-1 max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:rounded-none">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.62.alResult.label")}</span>
          <MarkBadge
            marks={(() => {
              let m = 0;
              const c = inputs.alSubjectCount;
              const t2 = c != null ? AL_CEILINGS[c] : undefined;
              if (t2 && c != null) {
                for (const g of ["S", "C", "B", "A"]) {
                  m += (inputs[`alGrade${g}` as "alGradeS"] ?? 0) * gradeRate(t2, c, g);
                }
              }
              return Math.min(m, AL_MAX_MARKS);
            })()}
            max={AL_MAX_MARKS}
            hint={t("category.62.alResult.hint")}
          />
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
          <GradeCounts
            category={category}
            prefix="al"
            grades={["S", "C", "B", "A"]}
            totalCount={inputs.alSubjectCount}
            onChange={onChange}
          />
        )}
      </div>

      <Separator className="hidden col-span-2 max-md:block" />

      {/* Co-curricular Activities Group */}
      <div className="col-span-2 grid gap-3 rounded-xl border border-border/70 bg-muted/10 p-3 max-md:col-span-1 max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:rounded-none max-md:gap-0">
        <span className="hidden md:block text-xs font-medium text-muted-foreground uppercase tracking-wide">Co-curricular Activities</span>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-5 max-md:grid-cols-1">
          <div className="grid gap-3">
          {/* Sports / co-curricular */}
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{t("category.62.sports.label")}</span>
              <MarkBadge marks={sportsMarks} max={SPORTS_MAX} hint={t("category.62.sports.hint")} />
              <FlagButton
                fieldKey="sportsEntries"
                flaggedInputs={flaggedInputs}
                onToggleInputFlag={onToggleInputFlag}
              />
            </div>
            <SportsTable
              id={id}
              entries={inputs.sportsEntries ?? []}
              columns={sportsLevelColumns}
              onChange={onChange}
              nameColumnLabel={t("category.62.sports.nameColumnLabel")}
              namePlaceholder={(number) => t("category.62.sports.namePlaceholder", { number })}
            />
          </div>

          <Separator />

          {/* Student Societies */}
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{t("category.62.studentSocieties.label")}</span>
              <MarkBadge
                marks={studentSocietiesMarks}
                max={STUDENT_SOCIETIES_MAX}
                hint={t("category.62.studentSocieties.hint")}
              />
              <FlagButton
                fieldKey="studentSocietiesEntries"
                flaggedInputs={flaggedInputs}
                onToggleInputFlag={onToggleInputFlag}
              />
            </div>
            <SocietiesTable
              id={id}
              entries={inputs.studentSocietiesEntries ?? []}
              columns={studentSocietiesRoleColumns}
              onChange={onChange}
              t={t}
            />
          </div>
          </div>

          <Separator orientation="vertical" className="max-md:hidden" />

          <div className="grid gap-3">
          {/* Leadership role */}
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{t("category.62.leadership.label")}</span>
              <MarkBadge
                marks={leadershipMarks}
                max={LEADERSHIP_MAX}
                hint={t("category.62.leadership.hint")}
              />
              <FlagButton
                fieldKey="leadershipRoles"
                flaggedInputs={flaggedInputs}
                onToggleInputFlag={onToggleInputFlag}
              />
            </div>
            <Field>
              <FieldLabel>{t("category.62.leadership.rolesLabel")}</FieldLabel>
              <div className="grid gap-2">
                {leadershipRoleOptions.map(([role, roleLabel]) => (
                  <label key={role} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      className="size-4"
                      checked={(inputs.leadershipRoles ?? []).includes(role)}
                      onCheckedChange={() => {
                        const current = inputs.leadershipRoles ?? [];
                        onChange({
                          leadershipRoles: current.includes(role)
                            ? current.filter((r) => r !== role)
                            : [...current, role],
                        });
                      }}
                    />
                    {roleLabel}
                  </label>
                ))}
              </div>
            </Field>
          </div>

          <Separator />

          {/* Other Activities */}
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{t("category.62.otherActivities.label")}</span>
              <MarkBadge
                marks={otherActivityMarks}
                max={OTHER_ACTIVITIES_MAX}
                hint={t("category.62.otherActivities.hint")}
              />
              <FlagButton
                fieldKey="otherActivities"
                flaggedInputs={flaggedInputs}
                onToggleInputFlag={onToggleInputFlag}
              />
            </div>
            <Field>
              <FieldLabel>{t("category.62.otherActivities.activityLabel")}</FieldLabel>
              <div className="grid gap-2">
                {otherActivityOptions.map(([activity, activityLabel]) => (
                  <label key={activity} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      className="size-4"
                      checked={(inputs.otherActivities ?? []).includes(activity)}
                      onCheckedChange={() => {
                        const current = inputs.otherActivities ?? [];
                        onChange({
                          otherActivities: current.includes(activity)
                            ? current.filter((a) => a !== activity)
                            : [...current, activity],
                        });
                      }}
                    />
                    {activityLabel}
                  </label>
                ))}
              </div>
            </Field>
            {(inputs.otherActivities ?? []).includes("other") && (
              <Field>
                <FieldLabel htmlFor={`other-activity-name-${id}`}>
                  {t("category.62.otherActivities.specifyLabel")}
                </FieldLabel>
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
          </div>
        </div>
      </div>

      <Separator className="hidden col-span-2 max-md:block" />

      {/* Past Pupils' Association */}
      <div className="grid gap-1.5 col-span-2 max-md:col-span-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.62.pastPupils.label")}</span>
          <MarkBadge
            marks={pastPupilsMarks}
            max={PAST_PUPILS_TOTAL_MAX}
            hint={(() => {
              const start = inputs.pastPupilsMembershipStart;
              const end = inputs.pastPupilsMembershipEnd;
              const rate = inputs.pastPupilsLifeMember ? 1 : 0.5;
              const rawYears = inputs.pastPupilsLifeMember
                ? yearsFromDate(inputs.pastPupilsLifeMemberStart)
                : start && end
                  ? yearsBetween(start, end)
                  : 0;
              const yrs = rawYears.toFixed(1);
              const yearMarks = (rawYears * rate).toFixed(1);
              return t("category.62.pastPupils.hint", { years: yrs, yearMarks });
            })()}
          />
          <FlagButton
            fieldKey="pastPupilsLifeMember"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
        </div>
        <div className="grid gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              className="size-4"
              checked={inputs.pastPupilsLifeMember === true}
              onCheckedChange={(checked) => onChange({ pastPupilsLifeMember: checked === true })}
            />
            {t("category.62.pastPupils.lifeMembership")}
          </label>
          {inputs.pastPupilsLifeMember ? (
            <DateField
              id={`past-pupils-life-start-${id}`}
              label={t("category.62.pastPupils.lifeMemberSince.label")}
              hint={t("category.62.pastPupils.lifeMemberSince.hint")}
              value={inputs.pastPupilsLifeMemberStart}
              onChange={(pastPupilsLifeMemberStart) => onChange({ pastPupilsLifeMemberStart })}
              maxDate={new Date()}
            />
          ) : (
            <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
              <DateField
                id={`past-pupils-start-${id}`}
                label={t("category.62.pastPupils.startDate.label")}
                hint={t("category.62.pastPupils.startDate.hint")}
                value={inputs.pastPupilsMembershipStart}
                onChange={(pastPupilsMembershipStart) => onChange({ pastPupilsMembershipStart })}
                maxDate={parseDateOrUndefined(inputs.pastPupilsMembershipEnd) ?? new Date()}
              />
              <DateField
                id={`past-pupils-end-${id}`}
                label={t("category.62.pastPupils.endDate.label")}
                hint={t("category.62.pastPupils.endDate.hint")}
                value={inputs.pastPupilsMembershipEnd}
                onChange={(pastPupilsMembershipEnd) => onChange({ pastPupilsMembershipEnd })}
                minDate={parseDateOrUndefined(inputs.pastPupilsMembershipStart)}
                maxDate={new Date()}
              />
            </div>
          )}
          <NumberField
            id={`past-pupils-committee-${id}`}
            label={t("category.62.pastPupils.committeeMembership")}
            value={inputs.pastPupilsCommitteeYears}
            onChange={(pastPupilsCommitteeYears) => onChange({ pastPupilsCommitteeYears })}
            />
          <NumberField
            id={`past-pupils-executive-${id}`}
            label={t("category.62.pastPupils.executiveOffice")}
            value={inputs.pastPupilsExecutiveCount}
            onChange={(pastPupilsExecutiveCount) => onChange({ pastPupilsExecutiveCount })}
            />
        </div>
      </div>

      <Separator className="hidden col-span-2 max-md:block" />

      {/* Academic Qualifications Group */}
      <div className="col-span-2 grid gap-3 rounded-xl border border-border/70 bg-muted/10 p-3 max-md:col-span-1 max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:rounded-none max-md:gap-0">
        <span className="hidden md:block text-xs font-medium text-muted-foreground uppercase tracking-wide">Academic Qualifications</span>
        <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
          {/* University Degrees */}
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{t("category.62.degrees.label")}</span>
              <MarkBadge marks={degreeMarks} max={DEGREE_MAX} hint={t("category.62.degrees.hint")} />
              <FlagButton
                fieldKey="highestDegree"
                flaggedInputs={flaggedInputs}
                onToggleInputFlag={onToggleInputFlag}
              />
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
              <span className="text-sm font-semibold">{t("category.62.diploma.label")}</span>
              <MarkBadge
                marks={diplomaMarks}
                max={DIPLOMA_MARKS}
                hint={t("category.62.diploma.hint")}
              />
              <FlagButton
                fieldKey="hasDiploma"
                flaggedInputs={flaggedInputs}
                onToggleInputFlag={onToggleInputFlag}
              />
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
        </div>
      </div>

      <Separator className="hidden col-span-2 max-md:block" />

      {/* School Contributions Group */}
      <div className="col-span-2 grid gap-3 rounded-xl border border-border/70 bg-muted/10 p-3 max-md:col-span-1 max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:rounded-none max-md:gap-0">
        <span className="hidden md:block text-xs font-medium text-muted-foreground uppercase tracking-wide">School Contributions</span>
        <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
          {/* Contribution to School Activities */}
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{t("category.62.contribution.label")}</span>
              <MarkBadge
                marks={contributionMarks}
                max={CONTRIBUTION_MAX}
                hint={t("category.62.contribution.hint")}
              />
              <FlagButton
                fieldKey="carnivalContribution"
                flaggedInputs={flaggedInputs}
                onToggleInputFlag={onToggleInputFlag}
              />
            </div>
            <div className="grid gap-2">
              <NumberField
                id={`carnival-contribution-${id}`}
                label={t("category.62.contribution.carnivals")}
                value={inputs.carnivalContribution}
                onChange={(carnivalContribution) => onChange({ carnivalContribution })}
              />
              <NumberField
                id={`shramadana-contribution-${id}`}
                label={t("category.62.contribution.shramadana")}
                value={inputs.shramadanaContribution}
                onChange={(shramadanaContribution) => onChange({ shramadanaContribution })}
              />
              <div className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("category.62.contribution.otherLabel")}
                </span>
                <OtherContributionRows
                  id={id}
                  entries={inputs.otherContributionEntries ?? []}
                  onChange={onChange}
                />
              </div>
            </div>
          </div>

          {/* Contribution to School Projects */}
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{t("category.62.schoolProjects.label")}</span>
              <MarkBadge
                marks={projectMarks}
                max={SCHOOL_PROJECTS_MARKS}
                hint={t("category.62.schoolProjects.hint")}
              />
              <FlagButton
                fieldKey="schoolProjectsContribution"
                flaggedInputs={flaggedInputs}
                onToggleInputFlag={onToggleInputFlag}
              />
            </div>
            <label className="mt-1 flex items-start gap-2 text-sm leading-relaxed">
              <Checkbox
                className="size-4"
                checked={inputs.schoolProjectsContribution === true}
                onCheckedChange={(checked) =>
                  onChange({ schoolProjectsContribution: checked === true })
                }
              />
              {t("category.62.schoolProjects.checkbox")}
            </label>
            <Textarea
              id={`school-projects-description-${id}`}
              value={inputs.schoolProjectsDescription ?? ""}
              disabled={inputs.schoolProjectsContribution !== true}
              placeholder={t("category.62.schoolProjects.descriptionPlaceholder")}
              onChange={(event) =>
                onChange({ schoolProjectsDescription: event.target.value || undefined })
              }
              className="text-sm"
            />
          </div>
        </div>
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
  const _selectedSchoolIds = inputs.schoolsWithinRadius ?? [];
  const _hasCenter = Number.isFinite(centerLat) && Number.isFinite(centerLng);
  const siblingsMarks = Math.min(
    (inputs.siblingGradesCompletedCount ?? 0) * SIBLING_MARKS_PER_GRADE,
    SIBLING_GRADES_MAX,
  );
  const studiedHereMarks = inputs.siblingStudiedAtAppliedSchool ? SIBLING_STUDIED_HERE_MARKS : 0;
  const multipleStudyingMarks = inputs.twoOrMoreSiblingsStudyingOtherGrades
    ? SIBLING_MULTIPLE_STUDYING_MARKS
    : 0;
  const prefectMarks = Math.min(
    (inputs.siblingSportsEntries ?? []).reduce(
      (sum, entry) => sum + (entry.levels ?? []).reduce((s, level) => s + (SIBLING_SPORTS_LEVEL_MARKS[level] ?? 0), 0),
      0,
    ),
    SIBLING_SPORTS_MAX,
  );
  const examMarks = Math.min(
    (inputs.siblingExamAchievements ?? []).reduce((sum, a) => sum + (SIBLING_EXAM_MARKS[a] ?? 0), 0),
    SIBLING_EXAM_MAX,
  );
  const leadershipMarks = inputs.siblingLeadershipAchievement ? SIBLING_LEADERSHIP_MARKS : 0;
  const supportMarks = inputs.parentsSupportRendered ? SIBLING_SUPPORT_MARKS : 0;
  const cocurricularTotal = Math.min(
    prefectMarks + examMarks + leadershipMarks + supportMarks,
    SIBLING_COCURRICULAR_TOTAL_MAX,
  );
  const documentMarks = Math.min(
    MAIN_DOCUMENT_MARKS_63[inputs.mainDocumentType ?? ""] ?? 0,
    MAIN_DOCUMENT_MAX_63,
  );
  const mother = electoralYearsRegistered(inputs.electoralMotherYears);
  const father = electoralYearsRegistered(inputs.electoralFatherYears);
  const electoralMarks = Math.min(
    (mother + father) * ELECTORAL_MARKS_PER_PERSON_YEAR_63,
    ELECTORAL_MAX_63,
  );
  const prox = proximityMarks(inputs, PROXIMITY_PER_SCHOOL_63, PROXIMITY_MAX_63);

  const electoralYears = electoralRegisterYears();
  const electoralHintYears = {
    startYear: electoralYears[0],
    endYear: electoralYears[electoralYears.length - 1],
  };
  const siblingDocumentOptions = getSiblingDocumentOptions(t);
  const siblingExamOptions = getSiblingExamOptions(t);
  const siblingSportsLevelColumns = [
    ["inter-house", t("category.sportsLevelOptions.interHouse"), SIBLING_SPORTS_LEVEL_MARKS["inter-house"]],
    ["zonal", t("category.sportsLevelOptions.zonal"), SIBLING_SPORTS_LEVEL_MARKS.zonal],
    ["district", t("category.sportsLevelOptions.district"), SIBLING_SPORTS_LEVEL_MARKS.district],
    ["provincial", t("category.sportsLevelOptions.provincial"), SIBLING_SPORTS_LEVEL_MARKS.provincial],
    ["national", t("category.sportsLevelOptions.national"), SIBLING_SPORTS_LEVEL_MARKS.national],
    ["international", t("category.sportsLevelOptions.international"), SIBLING_SPORTS_LEVEL_MARKS.international],
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.63.siblingsStudying.label")}</span>
          <MarkBadge
            marks={siblingsMarks}
            max={SIBLING_GRADES_MAX}
            hint={t("category.63.siblingsStudying.hint", {
              count: inputs.siblingGradesCompletedCount ?? 0,
              marks: siblingsMarks,
            })}
          />
          <FlagButton
            fieldKey="siblingGradesCompletedCount"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
        </div>
        <NumberField
          id={`siblings-count-${id}`}
          label={t("category.63.siblingsStudying.countLabel")}
          value={inputs.siblingGradesCompletedCount}
          onChange={(siblingGradesCompletedCount) =>
            onChange({ siblingGradesCompletedCount })
          }
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.63.studiedHere.label")}</span>
          <MarkBadge
            marks={studiedHereMarks}
            max={SIBLING_STUDIED_HERE_MARKS}
            hint={t("category.63.studiedHere.hint", { school: getHomeSchoolDisplayName() })}
          />
          <FlagButton
            fieldKey="siblingStudiedAtAppliedSchool"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
        </div>
        <label className="mt-1 flex items-start gap-2 text-sm leading-relaxed">
          <Checkbox
            className="size-4"
            checked={inputs.siblingStudiedAtAppliedSchool === true}
            onCheckedChange={(checked) =>
              onChange({ siblingStudiedAtAppliedSchool: checked === true })
            }
          />
          {t("category.63.studiedHere.checkbox")}
        </label>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.63.multipleSiblings.label")}</span>
          <MarkBadge
            marks={multipleStudyingMarks}
            max={SIBLING_MULTIPLE_STUDYING_MARKS}
            hint={t("category.63.multipleSiblings.hint")}
          />
          <FlagButton
            fieldKey="twoOrMoreSiblingsStudyingOtherGrades"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            className="size-4"
            checked={inputs.twoOrMoreSiblingsStudyingOtherGrades === true}
            onCheckedChange={(checked) => onChange({ twoOrMoreSiblingsStudyingOtherGrades: checked === true })}
          />
          {t("category.63.multipleSiblings.checkbox")}
        </label>
      </div>
      <div className="grid gap-1.5 col-span-2 max-md:col-span-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.63.cocurricular.label")}</span>
          <MarkBadge
            marks={cocurricularTotal}
            max={SIBLING_COCURRICULAR_TOTAL_MAX}
            hint={t("category.63.cocurricular.hint")}
          />
          <FlagButton
            fieldKey="siblingSportsEntries"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
        </div>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">{t("category.63.cocurricular.activitiesLabel")}</span>
            <SportsTable
              id={`sibling-${id}`}
              entries={inputs.siblingSportsEntries ?? []}
              columns={siblingSportsLevelColumns}
              onChange={onChange}
              field="siblingSportsEntries"
              rowCount={3}
              nameColumnLabel={t("category.63.cocurricular.activityNameLabel")}
              namePlaceholder={(number) => t("category.63.cocurricular.activityNamePlaceholder", { number })}
            />
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">{t("category.63.cocurricular.examAchievement")}</span>
            <div className="grid gap-1.5">
              {siblingExamOptions.map(([value, label]) => {
                const checkedValues = inputs.siblingExamAchievements ?? [];
                return (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      className="size-4"
                      checked={checkedValues.includes(value)}
                      onCheckedChange={() =>
                        onChange({
                          siblingExamAchievements: checkedValues.includes(value)
                            ? checkedValues.filter((v) => v !== value)
                            : [...checkedValues, value],
                        })
                      }
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              className="size-4"
              checked={inputs.siblingLeadershipAchievement === true}
              onCheckedChange={(checked) =>
                onChange({ siblingLeadershipAchievement: checked === true })
              }
            />
            {t("category.63.cocurricular.leadership")}
          </label>
          <div className="grid gap-1.5">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                className="size-4"
                checked={inputs.parentsSupportRendered === true}
                onCheckedChange={(checked) =>
                  onChange({
                    parentsSupportRendered: checked === true,
                    ...(checked === true ? {} : { parentsSupportDescription: undefined }),
                  })
                }
              />
              {t("category.63.cocurricular.parentSupport")}
            </label>
            {inputs.parentsSupportRendered === true && (
              <Textarea
                id={`parent-support-description-${id}`}
                value={inputs.parentsSupportDescription ?? ""}
                placeholder={t("category.63.cocurricular.parentSupportPlaceholder")}
                onChange={(event) => onChange({ parentsSupportDescription: event.target.value })}
                className="text-sm"
              />
            )}
          </div>
        </div>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.63.residenceDocument.label")}</span>
          <MarkBadge
            marks={documentMarks}
            max={MAIN_DOCUMENT_MAX_63}
            hint={t("category.63.residenceDocument.hint")}
          />
          <FlagButton
            fieldKey="mainDocumentType"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
        </div>
        <DocumentTypeSelect
          category={category}
          onChange={onChange}
          options={siblingDocumentOptions}
        />
      </div>
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <div className="grid gap-1.5">
          <ElectoralYearCheckboxes
            id={`electoral-mother-year-${id}`}
            label={t("category.63.electoralMother.yearLabel")}
            hint={t("category.63.electoralMother.hint", electoralHintYears)}
            value={inputs.electoralMotherYears}
            onChange={(electoralMotherYears) => onChange({ electoralMotherYears })}
          />
        </div>
        <div className="grid gap-1.5">
          <ElectoralYearCheckboxes
            id={`electoral-father-year-${id}`}
            label={t("category.63.electoralFather.yearLabel")}
            hint={t("category.63.electoralFather.hint", electoralHintYears)}
            value={inputs.electoralFatherYears}
            onChange={(electoralFatherYears) => onChange({ electoralFatherYears })}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 border-t pt-3">
        <span className="text-sm font-semibold">{t("category.63.electoralTotal")}</span>
        <MarkBadge
          marks={electoralMarks}
          max={ELECTORAL_MAX_63}
          hint={t("category.63.electoralTotal.hint")}
        />
        <FlagButton
          fieldKey="electoralMotherYears"
          flaggedInputs={flaggedInputs}
          onToggleInputFlag={onToggleInputFlag}
        />
      </div>
      <div className="grid gap-1.5 border-t pt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.61.nearbySchools.label")}</span>
          <MarkBadge
            marks={prox}
            max={PROXIMITY_MAX_63}
            hint={t("category.63.nearbySchools.hint", { school: getHomeSchoolDisplayName() })}
          />
          <FlagButton
            fieldKey="schoolsWithinRadius"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
        </div>
      </div>
    </div>
  );
}

/** Live, always-visible computation of the two 7.5.3.2 rates - officially
 * classified difficult station vs. distance tier - shown side by side with
 * the years and rate behind each number, so the applicant can see exactly
 * why the higher-of-the-two marks landed where they did instead of having
 * to reverse-engineer a single badge number from a dense tooltip. */
function DifficultServiceBreakdown({
  previousStartDate,
  previousEndDate,
  distanceStartDate,
  distanceEndDate,
  distanceKm,
}: {
  previousStartDate: string | undefined;
  previousEndDate: string | undefined;
  distanceStartDate: string | undefined;
  distanceEndDate: string | undefined;
  distanceKm: number | undefined;
}) {
  const { t } = useTranslation();
  const previousMarks = difficultServicePreviousMarks(previousStartDate, previousEndDate);
  const distanceMarks = difficultServiceDistanceMarks(distanceStartDate, distanceEndDate, distanceKm);
  const { years: previousYears } = yearsAndMonthsBetween(previousStartDate, previousEndDate);
  const { years: distanceYears } = yearsAndMonthsBetween(distanceStartDate, distanceEndDate);
  const tier = distanceKm != null ? DIFFICULT_DISTANCE_RATE_TIERS.find(([minKm]) => distanceKm >= minKm) : undefined;
  const appliedMarks = Math.min(Math.max(previousMarks, distanceMarks), DIFFICULT_SERVICE_MAX);
  const previousApplies = appliedMarks > 0 && previousMarks >= distanceMarks;
  const distanceApplies = appliedMarks > 0 && distanceMarks > previousMarks;
  return (
    <div className="grid gap-1 rounded-lg border bg-muted/30 p-2.5 text-xs">
      <div className={`flex items-center justify-between gap-3 ${previousApplies ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
        <span>{t("category.64.difficultService.breakdownOfficial", { years: previousYears, rate: DIFFICULT_SERVICE_PREVIOUS_RATE })}</span>
        <span className="shrink-0 tabular-nums">{markSuffix(t, previousMarks)}</span>
      </div>
      <div className={`flex items-center justify-between gap-3 ${distanceApplies ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
        <span>
          {tier
            ? t("category.64.difficultService.breakdownDistance", { km: distanceKm ?? 0, rate: tier[1], years: distanceYears })
            : t("category.64.difficultService.breakdownDistanceNoKm")}
        </span>
        <span className="shrink-0 tabular-nums">{markSuffix(t, distanceMarks)}</span>
      </div>
      <Separator className="my-0.5" />
      <div className="flex items-center justify-between gap-3 font-semibold text-foreground">
        <span>{t("category.64.difficultService.breakdownApplied")}</span>
        <span className="shrink-0 tabular-nums">{markSuffix(t, appliedMarks)}</span>
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
  const id = category.id;

  // 7.5.1 gates the rest of category 6.4: the circular gives marks for
  // every section that follows "only to applicants who have earned marks"
  // here, so a zero collapses the whole category to zero, not just this row.
  const contributionMarks = contributionMarks64(inputs);
  const gateOpen = contributionMarks > 0;

  const serviceMarks = gateOpen ? Math.min(wholeYearsFromDate(inputs.serviceStartDate), SERVICE_PERIOD_MAX) : 0;

  let difficultMarks = 0;
  if (gateOpen && inputs.difficultServiceType === "current") {
    difficultMarks = difficultServiceCurrentMarks(inputs.difficultServiceStartDate);
  } else if (gateOpen && inputs.difficultServiceType === "previous") {
    const previousBranch = difficultServicePreviousMarks(
      inputs.difficultServicePreviousStartDate,
      inputs.difficultServicePreviousEndDate,
    );
    const distanceBranch = difficultServiceDistanceMarks(
      inputs.difficultServiceDistanceStartDate,
      inputs.difficultServiceDistanceEndDate,
      inputs.difficultServiceDistanceKm,
    );
    difficultMarks = Math.max(previousBranch, distanceBranch);
  }
  difficultMarks = Math.min(difficultMarks, DIFFICULT_SERVICE_MAX);

  const leaveMarks =
    gateOpen && inputs.contributionPath !== "university"
      ? Math.min((inputs.unutilizedLeaveYears ?? 0) * UNUTILIZED_LEAVE_MARKS_PER_YEAR, UNUTILIZED_LEAVE_MAX)
      : 0;
  const residenceDistance = gateOpen
    ? tieredDistanceMarks(inputs.residenceToSchoolKm, RESIDENCE_DISTANCE_TIERS_64, RESIDENCE_DISTANCE_FALLBACK_64)
    : 0;
  const workplaceDistance = gateOpen ? workplaceDistanceMarks(inputs.workplaceToSchoolKm) : 0;

  // An empty input is the usual reason a marks badge reads 0, so highlight the
  // ones the currently-selected branch still needs a value for.
  const institutionBranch = (inputs.contributionPath ?? "institution") === "institution";
  const universityAllEmpty =
    inputs.contributionExamYears == null &&
    inputs.contributionCurriculumYears == null &&
    inputs.contributionTrainingYears == null;
  const missingContribution = institutionBranch ? inputs.contributionServiceStartDate == null : universityAllEmpty;
  const missingDifficult =
    inputs.difficultServiceType === "current"
      ? inputs.difficultServiceStartDate == null
      : inputs.difficultServiceType === "previous"
        ? inputs.difficultServicePreviousStartDate == null && inputs.difficultServiceDistanceStartDate == null
        : false;
  const missingLeave = inputs.unutilizedLeaveYears == null;
  const missingResidence = inputs.residenceToSchoolKm == null;
  const missingWorkplace = inputs.workplaceToSchoolKm == null;
  const hasMissing =
    missingContribution ||
    inputs.serviceStartDate == null ||
    missingDifficult ||
    missingLeave ||
    missingResidence ||
    missingWorkplace;

  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      {hasMissing && (
        <p className="col-span-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 max-md:col-span-1 dark:text-amber-400">
          {t("category.marking.missingNotice")}
        </p>
      )}
      <div className="grid gap-1.5 col-span-2 max-md:col-span-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.64.contribution.label")}</span>
          <MarkBadge
            marks={contributionMarks}
            max={SCHOOL_EDUCATION_CONTRIBUTION_MAX}
            hint={t("category.64.contribution.hint")}
          />
          <FlagButton
            fieldKey="contributionPath"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
        </div>
        <Field>
          <FieldLabel>{t("category.64.contribution.pathLabel")}</FieldLabel>
          <RadioGroup
            value={inputs.contributionPath ?? "institution"}
            onValueChange={(next) => onChange({ contributionPath: next as ScoringInputs["contributionPath"] })}
            className="flex flex-wrap gap-x-6 gap-y-2"
          >
            <RadioOption
              id={`contribution-path-institution-${id}`}
              value="institution"
              label={t("category.64.contribution.institutionPath")}
            />
            <RadioOption
              id={`contribution-path-university-${id}`}
              value="university"
              label={t("category.64.contribution.universityPath")}
            />
          </RadioGroup>
          {(inputs.contributionPath ?? "institution") === "institution" && (
            <div className="grid grid-cols-2 gap-5 pt-3 max-md:grid-cols-1">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  className="size-4"
                  checked={inputs.contributionSameSchool === true}
                  onCheckedChange={(checked) => onChange({ contributionSameSchool: checked === true })}
                />
                {t("category.64.contribution.sameSchool")}
              </label>
              <DateField
                id={`contribution-start-${id}`}
                label={t("category.64.contribution.serviceStartLabel")}
                hint={t("category.64.contribution.serviceStartHint")}
                value={inputs.contributionServiceStartDate}
                missing={missingContribution}
                onChange={(contributionServiceStartDate) => onChange({ contributionServiceStartDate })}
              />
            </div>
          )}
          {inputs.contributionPath === "university" && (
              <div className="grid grid-cols-3 gap-5 pt-3 max-md:grid-cols-1">
                <YearsSelect
                  id={`contribution-exam-${id}`}
                  label={t("category.64.contribution.examYears")}
                  value={inputs.contributionExamYears}
                  missing={universityAllEmpty}
                  onChange={(contributionExamYears) => onChange({ contributionExamYears })}
                />
                <YearsSelect
                  id={`contribution-curriculum-${id}`}
                  label={t("category.64.contribution.curriculumYears")}
                  value={inputs.contributionCurriculumYears}
                  missing={universityAllEmpty}
                  onChange={(contributionCurriculumYears) => onChange({ contributionCurriculumYears })}
                />
                <YearsSelect
                  id={`contribution-training-${id}`}
                  label={t("category.64.contribution.trainingYears")}
                  value={inputs.contributionTrainingYears}
                  missing={universityAllEmpty}
                  onChange={(contributionTrainingYears) => onChange({ contributionTrainingYears })}
                />
              </div>
          )}
        </Field>
        {!gateOpen && (
          <p className="text-xs text-amber-600 dark:text-amber-500">{t("category.64.contribution.gateWarning")}</p>
        )}
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.64.servicePeriod.label")}</span>
          <MarkBadge
            marks={serviceMarks}
            max={SERVICE_PERIOD_MAX}
            hint={t("category.64.servicePeriod.hint", {
              years: wholeYearsFromDate(inputs.serviceStartDate),
              marks: serviceMarks,
            })}
          />
          <FlagButton
            fieldKey="serviceStartDate"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
        </div>
        <DateField
          id={`service-start-${category.id}`}
          label={t("category.64.servicePeriod.dateLabel")}
          hint={t("category.64.servicePeriod.dateHint")}
          value={inputs.serviceStartDate}
          missing={inputs.serviceStartDate == null}
          onChange={(serviceStartDate) => onChange({ serviceStartDate })}
        />
      </div>
      <div className="grid gap-1.5 col-span-2 max-md:col-span-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.64.difficultService.label")}</span>
          <MarkBadge
            marks={difficultMarks}
            max={DIFFICULT_SERVICE_MAX}
            hint={t("category.64.difficultService.hint")}
          />
          <FlagButton
            fieldKey="difficultServiceType"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
        </div>
        <Field>
          <FieldLabel>{t("category.64.difficultService.typeLabel")}</FieldLabel>
          <RadioGroup
            value={inputs.difficultServiceType ?? "none"}
            onValueChange={(next) =>
              onChange({ difficultServiceType: next as ScoringInputs["difficultServiceType"] })
            }
            className="flex flex-wrap gap-x-6 gap-y-2"
          >
            <RadioOption
              id={`dst-current-${category.id}`}
              value="current"
              label={t("category.64.difficultService.currentSchool")}
              note={t("category.64.difficultService.currentRateNote")}
            />
            <RadioOption
              id={`dst-previous-${category.id}`}
              value="previous"
              label={t("category.64.difficultService.previousSchool")}
              note={t("category.64.difficultService.previousMarksNote")}
            />
            <RadioOption
              id={`dst-none-${category.id}`}
              value="none"
              label={t("category.64.difficultService.none")}
              marks={0}
            />
          </RadioGroup>
          {inputs.difficultServiceType === "current" && (
              <div className="pt-3">
                <DateField
                  id={`difficult-current-start-${category.id}`}
                  label={t("category.64.difficultService.currentStartLabel")}
                  hint={t("category.64.difficultService.currentStartHint")}
                  value={inputs.difficultServiceStartDate}
                  missing={inputs.difficultServiceStartDate == null}
                  onChange={(difficultServiceStartDate) => onChange({ difficultServiceStartDate })}
                />
              </div>
          )}
          {inputs.difficultServiceType === "previous" && (
              <div className="grid gap-4 pt-3">
                <div className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("category.64.difficultService.previousBranchLabel")}
                  </span>
                  <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
                    <DateField
                      id={`difficult-previous-start-${category.id}`}
                      label={t("category.64.difficultService.previousStartLabel")}
                      value={inputs.difficultServicePreviousStartDate}
                      missing={missingDifficult}
                      onChange={(difficultServicePreviousStartDate) => onChange({ difficultServicePreviousStartDate })}
                    />
                    <DateField
                      id={`difficult-previous-end-${category.id}`}
                      label={t("category.64.difficultService.previousEndLabel")}
                      value={inputs.difficultServicePreviousEndDate}
                      missing={inputs.difficultServicePreviousStartDate != null && inputs.difficultServicePreviousEndDate == null}
                      onChange={(difficultServicePreviousEndDate) => onChange({ difficultServicePreviousEndDate })}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("category.64.difficultService.distanceBranchLabel")}
                  </span>
                  <div className="grid grid-cols-3 gap-5 max-md:grid-cols-1">
                    <DateField
                      id={`difficult-distance-start-${category.id}`}
                      label={t("category.64.difficultService.distanceStartLabel")}
                      value={inputs.difficultServiceDistanceStartDate}
                      missing={missingDifficult}
                      onChange={(difficultServiceDistanceStartDate) => onChange({ difficultServiceDistanceStartDate })}
                    />
                    <DateField
                      id={`difficult-distance-end-${category.id}`}
                      label={t("category.64.difficultService.distanceEndLabel")}
                      value={inputs.difficultServiceDistanceEndDate}
                      missing={inputs.difficultServiceDistanceStartDate != null && inputs.difficultServiceDistanceEndDate == null}
                      onChange={(difficultServiceDistanceEndDate) => onChange({ difficultServiceDistanceEndDate })}
                    />
                    <NumberField
                      id={`difficult-distance-${category.id}`}
                      label={t("category.64.difficultService.distanceKm")}
                      value={inputs.difficultServiceDistanceKm}
                      missing={inputs.difficultServiceDistanceStartDate != null && inputs.difficultServiceDistanceKm == null}
                      onChange={(difficultServiceDistanceKm) => onChange({ difficultServiceDistanceKm })}
                    />
                  </div>
                </div>
                <DifficultServiceBreakdown
                  previousStartDate={inputs.difficultServicePreviousStartDate}
                  previousEndDate={inputs.difficultServicePreviousEndDate}
                  distanceStartDate={inputs.difficultServiceDistanceStartDate}
                  distanceEndDate={inputs.difficultServiceDistanceEndDate}
                  distanceKm={inputs.difficultServiceDistanceKm}
                />
              </div>
          )}
        </Field>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.64.unutilizedLeave.label")}</span>
          <MarkBadge
            marks={leaveMarks}
            max={UNUTILIZED_LEAVE_MAX}
            hint={t("category.64.unutilizedLeave.hint", {
              years: inputs.unutilizedLeaveYears ?? 0,
              marks: leaveMarks,
            })}
          />
          <FlagButton
            fieldKey="unutilizedLeaveYears"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
        </div>
        <YearsSelect
          id={`unutilized-leave-${category.id}`}
          label={t("category.64.unutilizedLeave.yearsLabel")}
          value={inputs.unutilizedLeaveYears}
          missing={missingLeave}
          onChange={(unutilizedLeaveYears) => onChange({ unutilizedLeaveYears })}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.64.residenceToSchool.label")}</span>
          <MarkBadge
            marks={residenceDistance}
            max={RESIDENCE_DISTANCE_MAX_64}
            hint={t("category.64.residenceToSchool.hint")}
          />
          <FlagButton
            fieldKey="residenceToSchoolKm"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
        </div>
        <NumberField
          id={`residence-to-school-${category.id}`}
          label={t("category.64.residenceToSchool.distanceLabel")}
          value={inputs.residenceToSchoolKm}
          missing={missingResidence}
          onChange={(residenceToSchoolKm) => onChange({ residenceToSchoolKm })}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.64.workplaceToSchool.label")}</span>
          <MarkBadge
            marks={workplaceDistance}
            max={WORKPLACE_DISTANCE_MAX}
            hint={t("category.64.workplaceToSchool.hint")}
          />
          <FlagButton
            fieldKey="workplaceToSchoolKm"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
        </div>
        <NumberField
          id={`workplace-to-school-${category.id}`}
          label={t("category.64.workplaceToSchool.distanceLabel")}
          value={inputs.workplaceToSchoolKm}
          missing={missingWorkplace}
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
  const hasCenter = Number.isFinite(centerLat) && Number.isFinite(centerLng);
  const km = inputs.previousWorkplaceDistanceKm;
  const distanceMarks = transferDistanceMarks(km);
  const periodMarks = Math.min(wholeYearsFromDate(inputs.serviceStartDate), TRANSFER_SERVICE_PERIOD_MAX);
  const prevYears = yearsFromDate(inputs.previousWorkplaceStartDate);
  const previousPeriodMarks = previousPeriodMarksFn(prevYears);
  const elapsed = yearsFromDate(inputs.transferDate);
  const elapsedMarks = inputs.transferDate ? transferElapsedMarksFn(elapsed) : 0;
  const leaveMarks = Math.min(
    (inputs.unutilizedLeaveYears ?? 0) * UNUTILIZED_LEAVE_MARKS_PER_YEAR,
    UNUTILIZED_LEAVE_MAX,
  );
  const prox = proximityMarks(inputs, PROXIMITY_PER_SCHOOL_65, PROXIMITY_MAX_65);
  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {t("category.65.prevWorkplaceDistance.label")}
          </span>
          <MarkBadge
            marks={distanceMarks}
            max={TRANSFER_DISTANCE_MAX}
            hint={t("category.65.prevWorkplaceDistance.hint")}
          />
          <FlagButton
            fieldKey="previousWorkplaceDistanceKm"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
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
          <span className="text-sm font-semibold">{t("category.65.servicePeriod.label")}</span>
          <MarkBadge
            marks={periodMarks}
            max={TRANSFER_SERVICE_PERIOD_MAX}
            hint={t("category.65.servicePeriod.hint", {
              years: wholeYearsFromDate(inputs.serviceStartDate),
              marks: periodMarks,
            })}
          />
          <FlagButton
            fieldKey="serviceStartDate"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
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
          <span className="text-sm font-semibold">{t("category.65.prevWorkplacePeriod.label")}</span>
          <MarkBadge
            marks={previousPeriodMarks}
            max={TRANSFER_PREVIOUS_PERIOD_MAX}
            hint={t("category.65.prevWorkplacePeriod.hint")}
          />
          <FlagButton
            fieldKey="previousWorkplaceStartDate"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
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
          <span className="text-sm font-semibold">{t("category.65.timeSinceTransfer.label")}</span>
          <MarkBadge
            marks={elapsedMarks}
            max={TRANSFER_ELAPSED_MAX}
            hint={t("category.65.timeSinceTransfer.hint")}
          />
          <FlagButton
            fieldKey="transferDate"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
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
          <span className="text-sm font-semibold">{t("category.65.unutilizedLeave.label")}</span>
          <MarkBadge
            marks={leaveMarks}
            max={UNUTILIZED_LEAVE_MAX}
            hint={t("category.65.unutilizedLeave.hint", {
              years: inputs.unutilizedLeaveYears ?? 0,
              marks: leaveMarks,
            })}
          />
          <FlagButton
            fieldKey="unutilizedLeaveYears"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
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
          <span className="text-sm font-semibold">{t("category.61.nearbySchools.label")}</span>
          <MarkBadge
            marks={prox}
            max={PROXIMITY_MAX_63}
            hint={t("category.65.nearbySchools.hint", { school: getHomeSchoolDisplayName() })}
          />
          <FlagButton
            fieldKey="schoolsWithinRadius"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
          {selectedSchoolIds.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {t("category.common.selected", { count: selectedSchoolIds.length })}
            </span>
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
  const hasCenter = Number.isFinite(centerLat) && Number.isFinite(centerLng);
  const abroad = yearsBetween(inputs.abroadStartDate, inputs.abroadEndDate);
  const abroadMarks = abroadPeriodMarks(abroad);
  const purposeMap: Record<string, number> = EMPLOYMENT_PURPOSE_MARKS;
  const purposeMarks = Math.min(
    purposeMap[inputs.employmentPurpose ?? ""] ?? 0,
    EMPLOYMENT_PURPOSE_MAX,
  );
  const prox = proximityMarks(inputs, PROXIMITY_PER_SCHOOL_66, PROXIMITY_MAX_66);
  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.66.periodAbroad.label")}</span>
          <MarkBadge
            marks={abroadMarks}
            max={ABROAD_PERIOD_MAX}
            hint={t("category.66.periodAbroad.hint")}
          />
          <FlagButton
            fieldKey="abroadStartDate"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
        </div>
        <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
          <DateField
            id={`abroad-start-${category.id}`}
            label={t("category.66.periodAbroad.dateLeft")}
            hint={t("category.66.periodAbroad.dateLeftHint")}
            value={inputs.abroadStartDate}
            onChange={(abroadStartDate) => onChange({ abroadStartDate })}
            maxDate={parseDateOrUndefined(inputs.abroadEndDate)}
          />
          <DateField
            id={`abroad-end-${category.id}`}
            label={t("category.66.periodAbroad.dateReturned")}
            hint={t("category.66.periodAbroad.dateReturnedHint")}
            value={inputs.abroadEndDate}
            onChange={(abroadEndDate) => onChange({ abroadEndDate })}
            minDate={parseDateOrUndefined(inputs.abroadStartDate)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.66.employmentPurpose.label")}</span>
          <MarkBadge
            marks={purposeMarks}
            max={EMPLOYMENT_PURPOSE_MAX}
            hint={t("category.66.employmentPurpose.hint")}
          />
          <FlagButton
            fieldKey="employmentPurpose"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
        </div>
        <Field>
          <FieldLabel>{t("category.66.employmentPurpose.purposeLabel")}</FieldLabel>
          <RadioGroup
            value={inputs.employmentPurpose ?? ""}
            onValueChange={(next) =>
              onChange({ employmentPurpose: next as ScoringInputs["employmentPurpose"] })
            }
            className="flex flex-wrap gap-x-6 gap-y-2"
          >
            <RadioOption
              id={`ep-diplomatic-${category.id}`}
              value="diplomatic"
              label={t("category.66.employmentPurpose.diplomatic")}
              marks={EMPLOYMENT_PURPOSE_MARKS.diplomatic}
            />
            <RadioOption
              id={`ep-government-${category.id}`}
              value="government"
              label={t("category.66.employmentPurpose.government")}
              marks={EMPLOYMENT_PURPOSE_MARKS.government}
            />
            <RadioOption
              id={`ep-education-${category.id}`}
              value="education"
              label={t("category.66.employmentPurpose.education")}
              marks={EMPLOYMENT_PURPOSE_MARKS.education}
            />
            <RadioOption
              id={`ep-employment-${category.id}`}
              value="employment"
              label={t("category.66.employmentPurpose.employment")}
              marks={EMPLOYMENT_PURPOSE_MARKS.employment}
            />
          </RadioGroup>
        </Field>
      </div>
      <div className="grid gap-1.5 border-t pt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("category.61.nearbySchools.label")}</span>
          <MarkBadge
            marks={prox}
            max={PROXIMITY_MAX_66}
            hint={t("category.66.nearbySchools.hint", { school: getHomeSchoolDisplayName() })}
          />
          <FlagButton
            fieldKey="schoolsWithinRadius"
            flaggedInputs={flaggedInputs}
            onToggleInputFlag={onToggleInputFlag}
          />
          {selectedSchoolIds.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {t("category.common.selected", { count: selectedSchoolIds.length })}
            </span>
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
  const hasCenter = Number.isFinite(centerLat) && Number.isFinite(centerLng);
  const locked = category.locked;
  const proximityConfig = PROXIMITY_CATEGORY_CONFIG[category.categoryType];
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

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
  }, [
    proximityConfig,
    hasCenter,
    locked,
    centerLat,
    centerLng,
    category.scoringInputs.schoolsWithinRadius,
    onUpdate,
  ]);

  return (
    <Card className={`pt-0 ${locked ? "bg-muted/30" : ""}`}>
      {/* Very-low-opacity category tint, matching the tab bar and the Add
          button so the whole category reads as one colour at a glance. */}
      <CardHeader
        className={`border-b pt-4 ${locked ? "bg-muted/20" : CATEGORY_COLORS[category.categoryType].headerBg}`}
      >
        <div className="grid min-w-0 gap-1">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            {t("category.sectionHeading.markingCategoryBadge")}
          </span>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {categoryLabels[category.categoryType]}
            {occurrence != null && (
              <span className="text-muted-foreground font-normal">
                {t("category.sectionHeading.entryNumber", { number: occurrence })}
              </span>
            )}
            {locked && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {t("category.sectionHeading.locked")}
              </span>
            )}
          </CardTitle>
          <CardDescription>{categoryMeta[category.categoryType].description}</CardDescription>
        </div>
        <CardAction className="grid gap-2 justify-items-end">
          <div className="grid gap-0.5 rounded-lg border bg-background px-3 py-2 text-right">
            <span className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {t("category.sectionHeading.indicativeScore")}
            </span>
            <strong className="font-mono text-lg tabular-nums">
              {score.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {categoryMeta[category.categoryType].maxMarks}
              </span>
            </strong>
          </div>
          <div className="flex gap-1">
            {/* Locking was removed as an applicant action. The unlock affordance
              stays so drafts that were locked before that change are not
              stranded read-only with no way back. */}
            {locked && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() =>
                  draft.updateCategoryInputs(category.id, {
                    locked: false,
                  } as Partial<ScoringInputs>)
                }
              >
                {t("category.buttons.edit")}
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
            {category.categoryType === "6.1" && (
              <Category61Fields category={category} onChange={onUpdate} />
            )}
            {category.categoryType === "6.2" && (
              <Category62Fields category={category} onChange={onUpdate} />
            )}
            {category.categoryType === "6.3" && (
              <Category63Fields category={category} onChange={onUpdate} />
            )}
            {category.categoryType === "6.4" && (
              <Category64Fields category={category} onChange={onUpdate} />
            )}
            {category.categoryType === "6.5" && (
              <Category65Fields category={category} onChange={onUpdate} />
            )}
            {category.categoryType === "6.6" && (
              <Category66Fields category={category} onChange={onUpdate} />
            )}
          </>
        )}
        {proximityConfig && hasCenter ? (
          <div className="grid gap-2 border-t pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                <p className="text-sm font-semibold sr-only">{t("category.nearbySchools.title")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("category.nearbySchools.calculated")}
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {t("category.nearbySchools.selectedCount", {
                  count: selectedSchoolIds.length,
                  marksPerSchool: proximityConfig.marksPerSchool,
                })}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("category.nearbySchools.explanation", {
                maxMarks: proximityConfig.maxMarks,
                marksPerSchool: proximityConfig.marksPerSchool,
              })}
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
          <p className="rounded-lg border p-3 sm:p-4 text-sm text-muted-foreground">
            {t("category.nearbySchools.noLocationHint")}
          </p>
        ) : null}
        <div className="grid gap-2 border-t pt-5">
          <p className="text-sm font-semibold">
            {t("category.exampleMarks.heading", {
              category: categoryLabels[category.categoryType],
            })}
          </p>
          <Table>
            <TableBody>
              {score.breakdown.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="text-muted-foreground">{row.label}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {row.marks.toLocaleString(undefined, { maximumFractionDigits: 2 })} / {row.max}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">
                  {t("category.exampleMarks.indicativeTotal")}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums">
                  {score.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} / 100
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          <p className="text-xs text-muted-foreground">{t("category.exampleMarks.disclaimer")}</p>
        </div>
      </CardContent>
      {!locked && (
        <CardFooter className="justify-end">
          <AlertDialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
            <AlertDialogTrigger
              className={cn(
                buttonVariants({ variant: "destructive", size: "sm" }),
              )}
            >
              {t("category.buttons.remove")}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("category.removeConfirm.title")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("category.removeConfirm.description", {
                    category: categoryLabels[category.categoryType],
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("category.removeConfirm.cancel")}</AlertDialogCancel>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setRemoveConfirmOpen(false);
                    onRemove();
                  }}
                >
                  {t("category.removeConfirm.confirm")}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      )}
    </Card>
  );
}

export function CategoryStep() {
  const { t } = useTranslation();
  const draft = useApplicationStore();
  const { latitude, longitude } = draft.selectedLocation;
  const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);

  const categoryLabels = getCategoryLabels(t);
  const tabLabels = getTabLabels(t);
  const categoryMeta = getCategoryMeta(t);

  const categoriesByType = new Map<CategoryType, CategoryApplication[]>();
  for (const cat of draft.categories) {
    const list = categoriesByType.get(cat.categoryType) ?? [];
    list.push(cat);
    categoriesByType.set(cat.categoryType, list);
  }

  const firstTypeWithEntries =
    CATEGORY_TYPES.find((categoryType) => (categoriesByType.get(categoryType)?.length ?? 0) > 0) ??
    CATEGORY_TYPES[0];
  const categoryCount = draft.categories.length;

  return (
    <div className="grid w-full grid-cols-1 gap-6">
      <div className="grid grid-cols-1 gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="font-heading text-2xl">{t("category.sectionHeading.markingScheme")}</h3>
          <span className="text-xs font-semibold text-primary">
            {t("category.sectionHeading.categoriesSelected", {
              count: categoryCount,
              plural: categoryCount === 1 ? "category" : "categories",
            })}
          </span>
        </div>
        <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
          {t("category.sectionHeading.description")}
        </p>
      </div>

      <Tabs defaultValue={firstTypeWithEntries}>
        {/* `TabsList` already scrolls and pads itself; only override what an
           app-specific wide, left-aligned, scrollable strip actually needs. */}
        <TabsList className="h-auto w-full justify-start gap-1 scrollbar-none">
          {CATEGORY_TYPES.map((categoryType) => {
            const count = categoriesByType.get(categoryType)?.length ?? 0;
            const colors = CATEGORY_COLORS[categoryType];
            const mapRequired = Boolean(PROXIMITY_CATEGORY_CONFIG[categoryType]) && !hasLocation;
            return (
              <TabsTrigger
                key={categoryType}
                value={categoryType}
                aria-label={`${tabLabels[categoryType]}${count > 0 ? ` (${count})` : ""}`}
                className={`group flex flex-none items-center gap-1.5 overflow-hidden min-w-0 text-xs ${colors.text} ${colors.activeBg}`}
              >
                {mapRequired ? (
                  <MapPin className={`size-3 shrink-0 ${colors.text}`} />
                ) : (
                  <span className={`size-1.5 shrink-0 rounded-full ${colors.dot}`} />
                )}
                <span className="truncate">
                  {tabLabels[categoryType]}
                  {count > 0 ? ` (${count})` : ""}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {CATEGORY_TYPES.map((categoryType) => {
          const entries = categoriesByType.get(categoryType) ?? [];
          const mapRequired = Boolean(PROXIMITY_CATEGORY_CONFIG[categoryType]) && !hasLocation;
          const colors = CATEGORY_COLORS[categoryType];
          return (
            <TabsContent
              key={categoryType}
              value={categoryType}
              className="grid grid-cols-1 gap-4 mt-4"
            >
              {mapRequired ? (
                <Empty
                  className={`border ${STATUS_WARNING.borderStrong} ${STATUS_WARNING.bgSoft} p-8`}
                >
                  <EmptyHeader>
                    <EmptyMedia
                      variant="icon"
                      className={`${STATUS_WARNING.bgIcon12} ${STATUS_WARNING.text}`}
                    >
                      <MapPin size={20} />
                    </EmptyMedia>
                    <EmptyTitle className={STATUS_WARNING.textStrong}>
                      {t("category.mapRequired.notice")}
                    </EmptyTitle>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      type="button"
                      variant="outline"
                      className={`${STATUS_WARNING.text} ${STATUS_WARNING.borderStrong}`}
                      onClick={() => draft.setStep(0)}
                    >
                      {t("category.mapRequired.configureLink")}
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : entries.length === 0 ? (
                <Empty className="p-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Plus size={20} />
                    </EmptyMedia>
                    <EmptyTitle>{t("category.noEntries.title")}</EmptyTitle>
                    <EmptyDescription>{t("category.noEntries.description")}</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button type="button" onClick={() => draft.addCategory(categoryType)}>
                      {t("category.buttons.addCategory", { category: tabLabels[categoryType] })}
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className={`h-auto w-full justify-start gap-2 border-2 py-2.5 text-left font-semibold whitespace-normal ${colors.border} ${colors.text} ${colors.bg} hover:${colors.bg}`}
                    onClick={() => draft.addCategory(categoryType)}
                  >
                    <Plus size={16} className="shrink-0" />
                    {t("category.buttons.addCategory", { category: tabLabels[categoryType] })}
                  </Button>
                  <div className="grid gap-5">
                    {entries.map((category, idx) => {
                      const occurrence =
                        entries.length > 1 ? entries.slice(0, idx + 1).length : undefined;
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
                </>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
