import { PhoneInput } from "@/components/g1/application/phone-input";
import {
  SECTION_COLORS,
  STATUS_ERROR,
  STATUS_INFO,
  STATUS_SUCCESS,
  STATUS_WARNING,
} from "@/lib/color-classes";
import { applicationPdfFilename, downloadApplicationPdf } from "@/lib/g1/application-pdf";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@aloysius-admissions/ui/components/tooltip";
import {
  type ApplicationDraft,
  type CategoryApplication,
  type CategoryType,
  applyLocationChange,
  emptyDraft,
  isSkipOutstanding,
  normalizeDraft,
  useApplicationStore,
} from "@/lib/g1/application-store";
import {
  DISTRICTS,
  DIVISIONAL_SECRETARIATS,
  ELECTORAL_CONSTITUENCIES,
  GN_DIVISIONS,
} from "@/lib/g1/divisions";
import {
  G1_DOB_CUTOFF,
  G1_DOB_EARLIEST,
  G1_DOB_LATEST,
  ageAsOf,
  getNextStepReason,
  isG1EligibleDob,
  locationIsReady,
} from "@/lib/g1/eligibility";
import {
  clearActiveKey,
  getActiveKey,
  getActiveSessionCode,
  setActiveApplication,
} from "@/lib/g1/saved-keys";
import { ADMISSION_RESTRICTIONS } from "@/lib/g1/school-config";
import { scoreCategory } from "@/lib/g1/scoring";
import { useTranslation } from "@/lib/i18n";
import { client } from "@/utils/orpc";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@aloysius-admissions/ui/components/alert-dialog";
import { Badge } from "@aloysius-admissions/ui/components/badge";
import { Button } from "@aloysius-admissions/ui/components/button";
import { Calendar } from "@aloysius-admissions/ui/components/calendar";
import { Card, CardContent, CardFooter, CardHeader } from "@aloysius-admissions/ui/components/card";
import { Checkbox } from "@aloysius-admissions/ui/components/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@aloysius-admissions/ui/components/combobox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@aloysius-admissions/ui/components/drawer";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@aloysius-admissions/ui/components/field";
import { Input } from "@aloysius-admissions/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@aloysius-admissions/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@aloysius-admissions/ui/components/select";
import { Spinner } from "@aloysius-admissions/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  CalendarIcon,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  FileSearch,
  FileText,
  House,
  Info,
  KeyRound,
  RotateCcw,
  ShieldCheck,
  ShieldX,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CategoryStep } from "./category-step";
import { LocationStep } from "./location-step";

// Shape of the loader-resolved (isomorphic) application fetch passed down from
// routes/application.index.tsx, so a returning applicant's draft is part of
// the server-rendered HTML instead of only appearing after a client fetch.
type RestoredApplication = {
  data: unknown;
  sessionCode: string;
  submittedAt: string | Date | null;
  admissionStatus?: string;
  interviewNotes?: string;
  isBanned?: boolean;
  banReason?: string | null;
  flags?: Array<{ type: string; key: string; label: string }>;
};

export type ApplicationInitialData = {
  key: string;
  code: string;
  application: RestoredApplication | null;
  status?: {
    submissionLocked: boolean;
    submissionOpensAt: string;
    submissionClosesAt: string;
  } | null;
};

function getSteps(t: (key: string) => string) {
  return [
    t("appForm.steps.location"),
    t("appForm.steps.applicant"),
    t("appForm.steps.guardian"),
    t("appForm.steps.residence"),
    t("appForm.steps.categories"),
    t("appForm.steps.declaration"),
    t("appForm.steps.review"),
  ];
}

function getCategoryLabels(t: (key: string) => string): Record<CategoryType, string> {
  return {
    "6.1": t("appForm.categoryLabels.6_1"),
    "6.2": t("appForm.categoryLabels.6_2"),
    "6.3": t("appForm.categoryLabels.6_3"),
    "6.4": t("appForm.categoryLabels.6_4"),
    "6.5": t("appForm.categoryLabels.6_5"),
    "6.6": t("appForm.categoryLabels.6_6"),
  };
}

function categorySummary(category: CategoryApplication): string {
  const inputs = category.scoringInputs;
  const parts: string[] = [];
  if (inputs.mainDocumentType) parts.push(`Main document: ${inputs.mainDocumentType}`);
  if (inputs.difficultServiceType) parts.push(`Difficult service: ${inputs.difficultServiceType}`);
  if (inputs.employmentPurpose) parts.push(`Employment purpose: ${inputs.employmentPurpose}`);
  if (inputs.abroadStartDate && inputs.abroadEndDate) {
    const days = Math.round(
      Math.abs(
        new Date(inputs.abroadEndDate).getTime() - new Date(inputs.abroadStartDate).getTime(),
      ) / 86400000,
    );
    parts.push(`Period abroad: ~${Math.round(days / 365)} years`);
  }
  if (inputs.residenceToSchoolKm != null)
    parts.push(`Residence to school: ${inputs.residenceToSchoolKm} km`);
  if (inputs.workplaceToSchoolKm != null)
    parts.push(`Workplace to school: ${inputs.workplaceToSchoolKm} km`);
  if (inputs.previousWorkplaceDistanceKm != null)
    parts.push(`Previous workplace: ${inputs.previousWorkplaceDistanceKm} km`);
  if (inputs.alumniStartDate && inputs.alumniEndDate) {
    const days = Math.round(
      Math.abs(
        new Date(inputs.alumniEndDate).getTime() - new Date(inputs.alumniStartDate).getTime(),
      ) / 86400000,
    );
    parts.push(`Alumni years at school: ~${Math.round(days / 365)}`);
  }
  if (inputs.grade5ScholarshipPassed) parts.push("Grade 5 Scholarship passed");
  if (inputs.olSubjectCount != null)
    parts.push(
      `O/L (${inputs.olSubjectCount} subjects): ${["S", "C", "B", "A"]
        .map((grade) => {
          const count = inputs[`olGrade${grade}` as "olGradeS"] as number | undefined;
          return count != null ? `${grade}=${count}` : null;
        })
        .filter(Boolean)
        .join(" ")}`,
    );
  if (inputs.alSubjectCount != null)
    parts.push(
      `A/L (${inputs.alSubjectCount} subjects): ${["S", "C", "B", "A"]
        .map((grade) => {
          const count = inputs[`alGrade${grade}` as "alGradeS"] as number | undefined;
          return count != null ? `${grade}=${count}` : null;
        })
        .filter(Boolean)
        .join(" ")}`,
    );
  if (inputs.sportsLevel)
    parts.push(
      `Sports level: ${inputs.sportsLevel}${inputs.sportsCount != null ? ` ×${inputs.sportsCount}` : ""}`,
    );
  if (inputs.leadershipRole) parts.push(`Leadership: ${inputs.leadershipRole}`);
  if (inputs.siblingsCurrentlyStudyingCount != null)
    parts.push(`Siblings at school: ${inputs.siblingsCurrentlyStudyingCount}`);
  if (inputs.siblingStudiedAtAppliedSchool) parts.push("Sibling studied here");
  if (inputs.twoOrMoreSiblingsApplying) parts.push("Two or more siblings applying");
  if (inputs.siblingPrefectLevel)
    parts.push(
      `Sibling prefect level: ${inputs.siblingPrefectLevel}${inputs.siblingPrefectCount != null ? ` ×${inputs.siblingPrefectCount}` : ""}`,
    );
  if (inputs.siblingExamAchievement) parts.push(`Sibling exam: ${inputs.siblingExamAchievement}`);
  if (inputs.siblingPraiseworthyAchievement) parts.push("Sibling praiseworthy achievement");
  if (inputs.parentsSupportRendered) parts.push("Parent support rendered");
  const schools = inputs.schoolsWithinRadius?.length ?? 0;
  parts.push(`${schools} ${schools === 1 ? "school" : "schools"} within radius`);
  parts.push(`Marks (indicative): ${scoreCategory(category).total}`);
  return parts.join(" · ");
}

function StepIndicator({
  current,
  maxVisited,
  steps: stepLabels,
  onStepClick,
  skippedSteps = [],
}: {
  current: number;
  maxVisited: number;
  steps: string[];
  onStepClick: (index: number) => void;
  /** Steps advanced past with a field still owed; drawn in amber. */
  skippedSteps?: number[];
}) {
  const { t } = useTranslation();
  // Clamp step index to prevent NaN in progress calculation and invalid array access
  const clampedCurrent = Math.max(0, Math.min(current, stepLabels.length - 1));
  const progress = Math.round((clampedCurrent / (stepLabels.length - 1)) * 100);
  return (
    <>
      <CardHeader className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            {t("appForm.stepIndicator.stepOf", {
              current: clampedCurrent + 1,
              total: stepLabels.length,
            })}
          </p>
          <h2 className="font-heading text-2xl">{stepLabels[clampedCurrent]}</h2>
        </div>
        <span className="text-sm text-muted-foreground">
          {t("appForm.stepIndicator.percentComplete", { percent: progress })}
        </span>
      </CardHeader>
      <div className="h-1 bg-secondary">
        <div
          className="h-full bg-primary transition-[width] duration-350 ease-in-out"
          style={{ width: `${Math.max(progress, 8)}%` }}
        />
      </div>
      <nav
        className="scroll-shadow-x flex gap-1 overflow-x-auto border-b px-5 py-3 md:px-8"
        aria-label={t("appForm.stepIndicator.ariaLabel")}
      >
        {stepLabels.map((step, index) => {
          const isCurrent = index === current;
          const isCompleted = index < maxVisited;
          const canNavigate = index <= maxVisited;
          const isSkipped = skippedSteps.includes(index);
          return (
            <button
              type="button"
              key={step}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap bg-transparent px-2.5 py-2 text-xs transition-colors ${
                isSkipped
                  ? `font-bold ${STATUS_WARNING.text}`
                  : isCurrent
                  ? "font-bold text-foreground"
                  : isCompleted
                    ? "text-foreground/80 hover:text-foreground"
                    : canNavigate
                      ? "text-muted-foreground hover:text-foreground"
                      : "text-muted-foreground/60 cursor-not-allowed"
              }`}
              onClick={() => canNavigate && onStepClick(index)}
              disabled={!canNavigate}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={`grid size-6 place-items-center rounded-full border text-[11px] transition-colors ${
                  isSkipped
                    ? `${STATUS_WARNING.bgSolid} border-transparent text-white`
                    : isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCompleted
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border"
                }`}
              >
                {isSkipped ? (
                  <TriangleAlert size={13} />
                ) : isCompleted && !isCurrent ? (
                  <Check size={14} />
                ) : (
                  index + 1
                )}
              </span>
              {step}
            </button>
          );
        })}
      </nav>
    </>
  );
}

function BirthCertificateField({
  draft,
  set,
  onSkip,
}: {
  draft: ApplicationDraft;
  set: (patch: Partial<ApplicationDraft>) => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const checkTimer = useRef<number | undefined>(undefined);

  const check = async (value: string, reveal = true) => {
    const number = value.trim();
    if (!number) {
      set({ duplicateBirthCertificate: false, bcDialogOpen: false });
      return;
    }
    try {
      const result = await client.application.checkBirthCertificate({
        birthCertificateNumber: number,
        excludeAccessKey: draft.accessKey || undefined,
      });
      if (reveal) set({ duplicateBirthCertificate: result.exists, bcDialogOpen: result.exists });
      else set({ duplicateBirthCertificate: result.exists });
    } catch (error) {
      console.error("checkBirthCertificate failed:", error);
      set({ duplicateBirthCertificate: false, bcDialogOpen: false });
    }
  };

  const scheduleCheck = (value: string) => {
    if (checkTimer.current) window.clearTimeout(checkTimer.current);
    checkTimer.current = window.setTimeout(() => void check(value, false), 250);
  };

  const watchedValue = String(draft.applicant.birthCertificateNumber ?? "");
  useEffect(() => {
    scheduleCheck(watchedValue);
    const watcher = window.setInterval(() => void check(watchedValue, false), 3000);
    return () => {
      window.clearInterval(watcher);
      if (checkTimer.current) window.clearTimeout(checkTimer.current);
    };
  }, [watchedValue]);

  const requestRemoval = async (birthCertificateNumber: string) => {
    try {
      set({ bcRequestState: t("appForm.birthCert.requestState.sending") });
      await client.application.requestAccess({
        birthCertificateNumber,
        applicantName: draft.bcApplicantName || draft.applicant.fullName,
        guardianName: draft.bcGuardianName || draft.guardian.fullName,
        contactPhone: draft.bcContactPhone || draft.guardian.phone,
        requestType: "removal",
      });
      set({
        bcRequestState: t("appForm.birthCert.requestState.sent"),
      });
    } catch (error) {
      set({
        bcRequestState:
          error instanceof Error ? error.message : t("appForm.birthCert.requestState.error"),
      });
    }
  };

  const isBirthCertSkipped = draft.birthCertificateStatus === "skipped";

  return (
    <Field
      className={
        isBirthCertSkipped
          ? `rounded-xl border-2 ${STATUS_WARNING.borderSolid} ${STATUS_WARNING.bgSoft} p-4`
          : undefined
      }
    >
      <FieldLabel htmlFor="applicant.birthCertificateNumber">
        {t("appForm.birthCert.label")}
      </FieldLabel>
      <div className="flex gap-2">
        <Input
          className={`flex-1 ${draft.duplicateBirthCertificate ? "border-destructive ring-destructive/20" : ""}`}
          id="applicant.birthCertificateNumber"
          name="applicant.birthCertificateNumber"
          value={draft.applicant.birthCertificateNumber}
          placeholder={t("appForm.birthCert.placeholder")}
          onChange={(e) => {
            set({
              applicant: { ...draft.applicant, birthCertificateNumber: e.target.value },
              bcRequestState: "",
              ...(e.target.value.trim() ? { birthCertificateStatus: "provided" as const } : {}),
            });
            scheduleCheck(e.target.value);
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="whitespace-normal"
          title={t("appForm.birthCert.refreshTitle")}
          onClick={() => void check(draft.applicant.birthCertificateNumber, false)}
        >
          <RotateCcw size={14} /> {t("appForm.birthCert.refresh")}
        </Button>
      </div>
      {/* Hidden once skipped: the amber notice below carries the state. */}
      {!draft.applicant.birthCertificateNumber.trim() && !isBirthCertSkipped && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3">
          <p className="min-w-40 flex-1 text-sm text-muted-foreground">
            {t("appForm.birthCert.skipHint")}
          </p>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onSkip}>
            {t("appForm.birthCert.skipButton")}
          </Button>
        </div>
      )}
      {isBirthCertSkipped && (
        <p className={`text-sm ${STATUS_WARNING.text}`}>
          {draft.applicant.birthCertificateNumber.trim()
            ? t("appForm.birthCert.skippedPreviouslyNotice")
            : t("appForm.birthCert.alreadySkippedNotice")}
        </p>
      )}
      <Drawer open={draft.bcDialogOpen} onOpenChange={(open) => set({ bcDialogOpen: open })}>
        {draft.duplicateBirthCertificate && (
          <DrawerTrigger className="border-0 bg-transparent p-0 text-destructive text-sm underline w-fit">
            {t("appForm.birthCert.duplicateLink")}
          </DrawerTrigger>
        )}
        <DrawerContent className="p-6">
          <DrawerHeader>
            <DrawerTitle>{t("appForm.birthCert.duplicateTitle")}</DrawerTitle>
            <DrawerDescription>{t("appForm.birthCert.duplicateDescription")}</DrawerDescription>
          </DrawerHeader>
          <div className="grid gap-4">
            <section className="grid gap-2">
              <h3 className="text-base font-semibold">
                {t("appForm.birthCert.askRemoval.heading")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("appForm.birthCert.askRemoval.description")}
              </p>
              <div className="grid gap-2">
                <Input
                  value={draft.bcApplicantName}
                  onChange={(e) => set({ bcApplicantName: e.target.value })}
                  placeholder={t("appForm.birthCert.applicantNamePlaceholder")}
                />
                <Input
                  value={draft.bcGuardianName}
                  onChange={(e) => set({ bcGuardianName: e.target.value })}
                  placeholder={t("appForm.birthCert.guardianNamePlaceholder")}
                />
                <PhoneInput
                  value={draft.bcContactPhone}
                  onChange={(value) => set({ bcContactPhone: value })}
                  placeholder={t("appForm.birthCert.contactPhonePlaceholder")}
                />
                <Button
                  type="button"
                  disabled={
                    !draft.bcApplicantName.trim() ||
                    !draft.bcGuardianName.trim() ||
                    !draft.bcContactPhone.trim()
                  }
                  onClick={() => void requestRemoval(draft.applicant.birthCertificateNumber)}
                >
                  {t("appForm.birthCert.requestRemoval")}
                </Button>
              </div>
              {draft.bcRequestState && (
                <p className="text-sm text-muted-foreground" role="status">
                  {draft.bcRequestState}
                </p>
              )}
            </section>
          </div>
        </DrawerContent>
      </Drawer>
    </Field>
  );
}

function LocationStepCard({
  draft,
  readOnly,
  set,
  onSkip,
}: {
  draft: ApplicationDraft;
  readOnly: boolean;
  set: (patch: Partial<ApplicationDraft>) => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const isLocationSkipped = draft.locationStatus === "skipped";
  return (
    <div
      className={`grid gap-4 ${
        isLocationSkipped
          ? `rounded-xl border-2 ${STATUS_WARNING.borderSolid} ${STATUS_WARNING.bgSoft} p-4`
          : ""
      }`}
    >
      <div className="mb-4">
        <h3 className="font-heading text-xl sm:text-2xl">{t("appForm.locationStep.heading")}</h3>
        <p className="text-sm text-muted-foreground">{t("appForm.locationStep.description")}</p>
      </div>
      <LocationStep
        readOnly={readOnly}
        autoRequestLocation={
          !readOnly && draft.location?.latitude == null && draft.selectedLocation?.latitude == null
        }
        value={draft.location ?? emptyDraft.location}
        defaultValue={draft.defaultLocations[0] ?? emptyDraft.location}
        deviceLocationHistory={draft.deviceLocationHistory ?? []}
        userLocationHistory={draft.userLocationHistory ?? []}
        skipped={isLocationSkipped}
        onClear={() => {
          if (readOnly) return;
          // Clears only the current selection. The captured points stay in
          // the location histories, so the real location is still offered
          // under "latest saved" and the skip option becomes available again.
          set({
            location: { label: "", address: "", latitude: null, longitude: null, source: "" },
            selectedLocation: { label: "", address: "", latitude: null, longitude: null, source: "" },
            locationStatus: "pending",
            locationCanProceed: false,
          });
        }}
        onAvailabilityChange={(canProceed) => set({ locationCanProceed: canProceed })}
        onChange={(value, defaultValue) => {
          if (readOnly) return;
          const histories = applyLocationChange(draft, value, defaultValue);
          set({
            location: value,
            selectedLocation: value,
            locationStatus: "provided",
            ...(histories.defaultLocations !== draft.defaultLocations
              ? { defaultLocations: histories.defaultLocations }
              : {}),
            ...(histories.deviceLocationHistory !== draft.deviceLocationHistory
              ? { deviceLocationHistory: histories.deviceLocationHistory }
              : {}),
            ...(histories.userLocationHistory !== draft.userLocationHistory
              ? { userLocationHistory: histories.userLocationHistory }
              : {}),
          });
        }}
      />
      {/* Offering the skip again after it was taken is noise; the amber
          notice below already states what is outstanding. */}
      {!readOnly && !locationIsReady(draft.location) && !isLocationSkipped && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3">
          <p className="min-w-40 flex-1 text-sm text-muted-foreground">
            {t("appForm.locationStep.skipHint")}
          </p>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onSkip}>
            {t("appForm.locationStep.skipButton")}
          </Button>
        </div>
      )}
      {isLocationSkipped && !locationIsReady(draft.location) && (
        <p className={`text-sm ${STATUS_WARNING.text}`}>
          {t("appForm.locationStep.skippedNotice")}
        </p>
      )}
    </div>
  );
}

function DateOfBirthPicker({
  value,
  onChange,
}: { value: string; onChange: (dateStr: string) => void }) {
  const [open, setOpen] = useState(false);
  const parsedDate = value ? new Date(value + "T00:00:00") : undefined;
  const maxDate = new Date(G1_DOB_LATEST() + "T00:00:00");
  const minDate = new Date(G1_DOB_EARLIEST() + "T00:00:00");
  // Guard against malformed persisted dateOfBirth that Date constructor accepts but is invalid
  const isValidDate = parsedDate && !Number.isNaN(parsedDate.getTime());
  const validParsedDate = isValidDate ? parsedDate : undefined;

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
          type="button"
          className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 md:text-sm [&>span]:line-clamp-1"
        >
          <span className={validParsedDate ? "" : "text-muted-foreground"}>
            {validParsedDate ? format(validParsedDate, "dd/MM/yyyy") : "dd/mm/yyyy"}
          </span>
          <CalendarIcon className="size-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={validParsedDate}
          defaultMonth={validParsedDate ?? maxDate}
          captionLayout="dropdown"
          startMonth={minDate}
          endMonth={maxDate}
          disabled={(date) => date > maxDate || date < minDate}
          onSelect={(date) => {
            if (date) {
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, "0");
              const d = String(date.getDate()).padStart(2, "0");
              onChange(`${y}-${m}-${d}`);
            }
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function ApplicantStep({
  draft,
  set,
  onSkip,
}: {
  draft: ApplicationDraft;
  set: (patch: Partial<ApplicationDraft>) => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <div className="col-span-full mb-4">
        <h3 className="font-heading text-xl sm:text-2xl">{t("appForm.applicantStep.heading")}</h3>
        <p className="text-sm text-muted-foreground">{t("appForm.applicantStep.description")}</p>
      </div>

      <Field>
        <FieldLabel htmlFor="applicant.fullName">
          {t("appForm.applicantStep.fullNameEn")}
        </FieldLabel>
        <Input
          id="applicant.fullName"
          value={draft.applicant.fullName}
          placeholder={t("appForm.applicantStep.fullNameEnPlaceholder")}
          onChange={(e) => set({ applicant: { ...draft.applicant, fullName: e.target.value } })}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="applicant.sinhalaName">
          {t("appForm.applicantStep.fullNameSi")}
        </FieldLabel>
        <Input
          id="applicant.sinhalaName"
          value={draft.applicant.sinhalaName}
          onChange={(e) => set({ applicant: { ...draft.applicant, sinhalaName: e.target.value } })}
        />
        <a
          className="text-xs text-primary underline underline-offset-1 hover:text-primary/80"
          href="https://www.helakuru.lk/keyboard"
          target="_blank"
          rel="noreferrer"
        >
          {t("appForm.applicantStep.sinhalaKeyboardLink")}
        </a>
      </Field>

      <Field data-invalid={draft.applicant.gender === "Female"}>
        <FieldLabel htmlFor="applicant.gender">{t("appForm.applicantStep.gender")}</FieldLabel>
        <Select
          value={draft.applicant.gender || ""}
          onValueChange={(value) => set({ applicant: { ...draft.applicant, gender: value ?? "" } })}
        >
          <SelectTrigger id="applicant.gender" className="w-full">
            <SelectValue placeholder={t("appForm.applicantStep.genderPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Female">{t("appForm.applicantStep.gender.female")}</SelectItem>
            <SelectItem value="Male">{t("appForm.applicantStep.gender.male")}</SelectItem>
          </SelectContent>
        </Select>
        {draft.applicant.gender === "Female" && (
          <FieldError>
            {ADMISSION_RESTRICTIONS.restrictGenderMessage ||
              t("appForm.applicantStep.genderRestriction")}
          </FieldError>
        )}
      </Field>

      <Field data-invalid={draft.applicant.religion === "Christian"}>
        <FieldLabel htmlFor="applicant.religion">{t("appForm.applicantStep.religion")}</FieldLabel>
        <Select
          value={draft.applicant.religion || ""}
          onValueChange={(value) =>
            set({ applicant: { ...draft.applicant, religion: value ?? "" } })
          }
        >
          <SelectTrigger id="applicant.religion" className="w-full">
            <SelectValue placeholder={t("appForm.applicantStep.religionPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Catholic">{t("appForm.applicantStep.religion.catholic")}</SelectItem>
            <SelectItem value="Christian">
              {t("appForm.applicantStep.religion.christian")}
            </SelectItem>
            <SelectItem value="Buddhist">{t("appForm.applicantStep.religion.buddhist")}</SelectItem>
            <SelectItem value="Islam">{t("appForm.applicantStep.religion.islam")}</SelectItem>
          </SelectContent>
        </Select>
        {draft.applicant.religion === "Christian" && (
          <FieldError>
            {ADMISSION_RESTRICTIONS.restrictReligionMessage ||
              t("appForm.applicantStep.religionRestriction")}
          </FieldError>
        )}
      </Field>

      <Field
        data-invalid={
          draft.applicant.educationMedium === "Tamil" &&
          ADMISSION_RESTRICTIONS.allowedEducationMediums.length > 0 &&
          !ADMISSION_RESTRICTIONS.allowedEducationMediums.includes(draft.applicant.educationMedium)
        }
      >
        <FieldLabel htmlFor="applicant.educationMedium">
          {t("appForm.applicantStep.educationMedium")}
        </FieldLabel>
        <Select
          value={draft.applicant.educationMedium || ""}
          onValueChange={(value) =>
            set({ applicant: { ...draft.applicant, educationMedium: value ?? "" } })
          }
        >
          <SelectTrigger id="applicant.educationMedium" className="w-full">
            <SelectValue placeholder={t("appForm.applicantStep.educationMediumPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Sinhala">
              {t("appForm.applicantStep.educationMedium.sinhala")}
            </SelectItem>
            <SelectItem value="Tamil">
              {t("appForm.applicantStep.educationMedium.tamil")}
            </SelectItem>
          </SelectContent>
        </Select>
        {draft.applicant.educationMedium === "Tamil" &&
          ADMISSION_RESTRICTIONS.allowedEducationMediums.length > 0 &&
          !ADMISSION_RESTRICTIONS.allowedEducationMediums.includes(
            draft.applicant.educationMedium,
          ) && (
            <FieldError>
              {ADMISSION_RESTRICTIONS.restrictMediumMessage ||
                t("appForm.applicantStep.mediumRestriction")}
            </FieldError>
          )}
      </Field>

      <Field data-invalid={Boolean(draft.applicant.dateOfBirth) && !isG1EligibleDob(draft.applicant.dateOfBirth)}>
        <FieldLabel htmlFor="applicant.dateOfBirth">
          {t("appForm.applicantStep.dateOfBirth")}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                type="button"
                aria-label={t("appForm.applicantStep.dateOfBirthRuleAria")}
                className="ml-1.5 inline-flex align-middle text-muted-foreground hover:text-foreground"
              >
                <Info size={14} />
              </TooltipTrigger>
              <TooltipContent className="leading-relaxed">
                {t("appForm.applicantStep.dateOfBirthDescription", {
                  earliest: format(new Date(G1_DOB_EARLIEST() + "T00:00:00"), "dd/MM/yyyy"),
                  latest: format(new Date(G1_DOB_LATEST() + "T00:00:00"), "dd/MM/yyyy"),
                })}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </FieldLabel>
        <DateOfBirthPicker
          value={draft.applicant.dateOfBirth}
          onChange={(dateStr) => set({ applicant: { ...draft.applicant, dateOfBirth: dateStr } })}
        />
        {draft.applicant.dateOfBirth &&
          (() => {
            const cutoffAge = ageAsOf(
              draft.applicant.dateOfBirth,
              new Date(G1_DOB_CUTOFF() + "T00:00:00"),
            );
            return (
              cutoffAge && (
                <p className="text-sm text-muted-foreground">
                  {t("appForm.applicantStep.dateOfBirthCutoffAge", {
                    date: format(new Date(G1_DOB_CUTOFF() + "T00:00:00"), "d MMM yyyy"),
                    years: cutoffAge.years,
                    months: cutoffAge.months,
                  })}
                </p>
              )
            );
          })()}
        {draft.applicant.dateOfBirth && !isG1EligibleDob(draft.applicant.dateOfBirth) && (
          <FieldError>{t("appForm.applicantStep.dateOfBirthRestriction")}</FieldError>
        )}
      </Field>

      <div className="col-span-full">
        <BirthCertificateField draft={draft} set={set} onSkip={onSkip} />
      </div>
    </div>
  );
}

function GuardianStep({
  draft,
  set,
}: {
  draft: ApplicationDraft;
  set: (patch: Partial<ApplicationDraft>) => void;
}) {
  const { t } = useTranslation();
  const nicValue = String(draft.guardian.nic || "")
    .trim()
    .toUpperCase();
  const nicValid = !nicValue || /^\d{12}$/.test(nicValue) || /^\d{9}[VX]$/.test(nicValue);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <div className="col-span-full mb-4">
        <h3 className="font-heading text-xl sm:text-2xl">{t("appForm.guardianStep.heading")}</h3>
        <p className="text-sm text-muted-foreground">{t("appForm.guardianStep.description")}</p>
      </div>

      <Field>
        <FieldLabel htmlFor="guardian.relationship">
          {t("appForm.guardianStep.relationship")}
        </FieldLabel>
        <Select
          value={draft.guardian.relationship || ""}
          onValueChange={(value) =>
            set({ guardian: { ...draft.guardian, relationship: value ?? "" } })
          }
        >
          <SelectTrigger id="guardian.relationship" className="w-full">
            <SelectValue placeholder={t("appForm.guardianStep.relationshipPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Mother">{t("appForm.guardianStep.relationship.mother")}</SelectItem>
            <SelectItem value="Father">{t("appForm.guardianStep.relationship.father")}</SelectItem>
            <SelectItem value="Guardian">
              {t("appForm.guardianStep.relationship.guardian")}
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="guardian.fullName">{t("appForm.guardianStep.fullNameEn")}</FieldLabel>
        <Input
          id="guardian.fullName"
          value={draft.guardian.fullName}
          onChange={(e) => set({ guardian: { ...draft.guardian, fullName: e.target.value } })}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="guardian.sinhalaName">
          {t("appForm.guardianStep.fullNameSi")}
        </FieldLabel>
        <Input
          id="guardian.sinhalaName"
          value={draft.guardian.sinhalaName}
          onChange={(e) => set({ guardian: { ...draft.guardian, sinhalaName: e.target.value } })}
        />
        <a
          className="text-xs text-primary underline underline-offset-1 hover:text-primary/80"
          href="https://www.helakuru.lk/keyboard"
          target="_blank"
          rel="noreferrer"
        >
          {t("appForm.guardianStep.sinhalaKeyboardLink")}
        </a>
      </Field>

      <Field data-invalid={!nicValid}>
        <FieldLabel htmlFor="guardian.nic">{t("appForm.guardianStep.nic")}</FieldLabel>
        <Input
          id="guardian.nic"
          value={draft.guardian.nic}
          placeholder={t("appForm.guardianStep.nicPlaceholder")}
          maxLength={12}
          autoCapitalize="characters"
          spellCheck={false}
          onChange={(e) =>
            set({ guardian: { ...draft.guardian, nic: e.target.value.toUpperCase() } })
          }
        />
        {!nicValid && (
          <FieldError>{t("appForm.guardianStep.nicError")}</FieldError>
        )}
      </Field>

      <Field>
        <FieldLabel htmlFor="guardian.phone">{t("appForm.guardianStep.phone")}</FieldLabel>
        <PhoneInput
          value={draft.guardian.phone || ""}
          onChange={(value) => set({ guardian: { ...draft.guardian, phone: value } })}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="guardian.email">{t("appForm.guardianStep.email")}</FieldLabel>
        <Input
          id="guardian.email"
          type="email"
          value={draft.guardian.email}
          onChange={(e) => set({ guardian: { ...draft.guardian, email: e.target.value } })}
        />
      </Field>
    </div>
  );
}

function ResidenceStep({
  draft,
  set,
}: {
  draft: ApplicationDraft;
  set: (patch: Partial<ApplicationDraft>) => void;
}) {
  const { t } = useTranslation();
  const sameAsPermanent = draft.residence.sameAsPermanent;

  const selectedDistrict = DISTRICTS.find(
    (d) => d.en === draft.residence.district || d.id === draft.residence.district,
  );
  const selectedDs = DIVISIONAL_SECRETARIATS.find(
    (d) => d.en === draft.residence.dsDivision || d.id === draft.residence.dsDivision,
  );

  const districtOptions = DISTRICTS.map((d) => d.en);
  const dsOptions = DIVISIONAL_SECRETARIATS.filter(
    (d) => !selectedDistrict || d.districtId === selectedDistrict.id,
  ).map((d) => d.en);
  const gnOptions = GN_DIVISIONS.filter((d) => !selectedDs || d.dsId === selectedDs.id).map(
    (d) => d.en,
  );
  const electoralOptions = ELECTORAL_CONSTITUENCIES.map((c) => c.en);

  const setResidence = (residence: Partial<ApplicationDraft["residence"]>) =>
    set({ residence: { ...draft.residence, ...residence } } as Partial<ApplicationDraft>);

  // While the addresses match, every permanent-address edit is mirrored into
  // the current-address fields too. That keeps `currentAddressEn/Si` correct
  // in the saved record without every downstream reader (PDF, admin views,
  // data extraction) having to special-case `sameAsPermanent` itself.
  const setPermanentAddress = (patch: { permanentAddressEn?: string; permanentAddressSi?: string }) =>
    setResidence({
      ...patch,
      ...(sameAsPermanent
        ? {
            currentAddressEn: patch.permanentAddressEn ?? draft.residence.permanentAddressEn,
            currentAddressSi: patch.permanentAddressSi ?? draft.residence.permanentAddressSi,
          }
        : {}),
    });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <div className="col-span-full mb-4">
        <h3 className="font-heading text-xl sm:text-2xl">{t("appForm.residenceStep.heading")}</h3>
        <p className="text-sm text-muted-foreground">{t("appForm.residenceStep.description")}</p>
      </div>

      <Field>
        <FieldLabel htmlFor="residence.permanentAddressEn">
          {t("appForm.residenceStep.permanentAddressEn")}
        </FieldLabel>
        <Input
          id="residence.permanentAddressEn"
          value={draft.residence.permanentAddressEn}
          placeholder={t("appForm.residenceStep.permanentAddressEnPlaceholder")}
          onChange={(e) => setPermanentAddress({ permanentAddressEn: e.target.value })}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="residence.permanentAddressSi">
          {t("appForm.residenceStep.permanentAddressSi")}
        </FieldLabel>
        <Input
          id="residence.permanentAddressSi"
          value={draft.residence.permanentAddressSi}
          onChange={(e) => setPermanentAddress({ permanentAddressSi: e.target.value })}
        />
        <a
          className="text-xs text-primary underline underline-offset-1 hover:text-primary/80"
          href="https://www.helakuru.lk/keyboard"
          target="_blank"
          rel="noreferrer"
        >
          {t("appForm.residenceStep.sinhalaKeyboardLink")}
        </a>
      </Field>

      <div className="col-span-full">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            className="size-5"
            checked={!sameAsPermanent}
            onCheckedChange={(checked) => {
              const differs = checked === true;
              setResidence({
                sameAsPermanent: !differs,
                // Turning "differs" off snaps current back to permanent
                // immediately, rather than leaving stale text behind that
                // just happens to be hidden.
                ...(!differs
                  ? {
                      currentAddressEn: draft.residence.permanentAddressEn,
                      currentAddressSi: draft.residence.permanentAddressSi,
                    }
                  : {}),
              });
            }}
          />
          {t("appForm.residenceStep.addressDiffers")}
        </label>
      </div>

      {!sameAsPermanent && (
        <>
          <Field>
            <FieldLabel htmlFor="residence.currentAddressEn">
              {t("appForm.residenceStep.currentAddressEn")}
            </FieldLabel>
            <Input
              id="residence.currentAddressEn"
              value={draft.residence.currentAddressEn}
              placeholder={t("appForm.residenceStep.currentAddressEnPlaceholder")}
              onChange={(e) => setResidence({ currentAddressEn: e.target.value })}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="residence.currentAddressSi">
              {t("appForm.residenceStep.currentAddressSi")}
            </FieldLabel>
            <Input
              id="residence.currentAddressSi"
              value={draft.residence.currentAddressSi}
              onChange={(e) => setResidence({ currentAddressSi: e.target.value })}
            />
          </Field>
        </>
      )}

      <Field>
        <FieldLabel htmlFor="residence.district">{t("appForm.residenceStep.district")}</FieldLabel>
        <Combobox
          items={districtOptions}
          value={draft.residence.district || ""}
          onValueChange={(val) => {
            if (val) {
              setResidence({ district: val, districtSearch: val, dsDivision: "", gnDivision: "" });
            } else {
              setResidence({ district: "", districtSearch: "", dsDivision: "", gnDivision: "" });
            }
          }}
        >
          <ComboboxInput placeholder={t("appForm.residenceStep.districtPlaceholder")} />
          <ComboboxContent>
            <ComboboxEmpty>{t("appForm.residenceStep.districtEmpty")}</ComboboxEmpty>
            <ComboboxList>
              {(item: string) => (
                <ComboboxItem key={item} value={item}>
                  {item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </Field>

      <Field>
        <FieldLabel htmlFor="residence.dsDivision">
          {t("appForm.residenceStep.dsDivision")}
        </FieldLabel>
        <Combobox
          items={dsOptions}
          value={draft.residence.dsDivision || ""}
          disabled={!selectedDistrict}
          onValueChange={(val) => {
            if (val) {
              setResidence({ dsDivision: val, dsSearch: val, gnDivision: "" });
            } else {
              setResidence({ dsDivision: "", dsSearch: "", gnDivision: "" });
            }
          }}
        >
          <ComboboxInput
            disabled={!selectedDistrict}
            placeholder={
              selectedDistrict
                ? t("appForm.residenceStep.dsDivisionPlaceholder")
                : t("appForm.residenceStep.dsDivisionLocked")
            }
          />
          <ComboboxContent>
            <ComboboxEmpty>{t("appForm.residenceStep.dsDivisionEmpty")}</ComboboxEmpty>
            <ComboboxList>
              {(item: string) => (
                <ComboboxItem key={item} value={item}>
                  {item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        {!selectedDistrict && (
          <FieldDescription>{t("appForm.residenceStep.dsDivisionLockedHint")}</FieldDescription>
        )}
      </Field>

      <Field>
        <FieldLabel htmlFor="residence.gnDivision">
          {t("appForm.residenceStep.gnDivision")}
        </FieldLabel>
        <Combobox
          items={gnOptions}
          value={draft.residence.gnDivision || ""}
          disabled={!selectedDs}
          onValueChange={(val) => {
            if (val) {
              setResidence({ gnDivision: val, gnSearch: val });
            } else {
              setResidence({ gnDivision: "", gnSearch: "" });
            }
          }}
        >
          <ComboboxInput
            disabled={!selectedDs}
            placeholder={
              selectedDs
                ? t("appForm.residenceStep.gnDivisionPlaceholder")
                : t("appForm.residenceStep.gnDivisionLocked")
            }
          />
          <ComboboxContent>
            <ComboboxEmpty>{t("appForm.residenceStep.gnDivisionEmpty")}</ComboboxEmpty>
            <ComboboxList>
              {(item: string) => (
                <ComboboxItem key={item} value={item}>
                  {item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        {!selectedDs && (
          <FieldDescription>{t("appForm.residenceStep.gnDivisionLockedHint")}</FieldDescription>
        )}
      </Field>

      <Field>
        <FieldLabel htmlFor="residence.electoralDistrict">
          {t("appForm.residenceStep.electoralDistrict")}
        </FieldLabel>
        <Combobox
          items={electoralOptions}
          value={draft.residence.electoralDistrict || ""}
          onValueChange={(val) => {
            if (val) {
              setResidence({ electoralDistrict: val, electoralSearch: val });
            } else {
              setResidence({ electoralDistrict: "", electoralSearch: "" });
            }
          }}
        >
          <ComboboxInput placeholder={t("appForm.residenceStep.electoralDistrictPlaceholder")} />
          <ComboboxContent>
            <ComboboxEmpty>{t("appForm.residenceStep.districtEmpty")}</ComboboxEmpty>
            <ComboboxList>
              {(item: string) => (
                <ComboboxItem key={item} value={item}>
                  {item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </Field>
    </div>
  );
}

function DeclarationStep({
  draft,
  set,
}: {
  draft: ApplicationDraft;
  set: (patch: Partial<ApplicationDraft>) => void;
}) {
  const { t } = useTranslation();
  const locationSkipped = draft.locationStatus === "skipped";
  const birthCertSkipped = draft.birthCertificateStatus === "skipped";
  return (
    <div className="grid max-w-[920px] gap-5">
      <div className="mb-4">
        <h3 className="font-heading text-xl sm:text-2xl">{t("appForm.declarationStep.heading")}</h3>
        <p className="text-sm text-muted-foreground">{t("appForm.declarationStep.description")}</p>
      </div>

      {(locationSkipped || birthCertSkipped) && (
        <p className="text-sm font-medium text-amber-700">
          {t("appForm.declarationStep.completeSkippedHeading")}
        </p>
      )}

      {locationSkipped && (
        <div className={`grid gap-2 rounded-xl border-2 ${STATUS_WARNING.borderSolid} ${STATUS_WARNING.bgSoft} p-4`}>
          <span className="text-sm font-medium">{t("appForm.locationStep.heading")}</span>
          <LocationStep
            readOnly={false}
            skipped
            autoRequestLocation={
              draft.location?.latitude == null && draft.selectedLocation?.latitude == null
            }
            value={draft.location ?? emptyDraft.location}
            defaultValue={draft.defaultLocations[0] ?? emptyDraft.location}
            deviceLocationHistory={draft.deviceLocationHistory ?? []}
            userLocationHistory={draft.userLocationHistory ?? []}
            onAvailabilityChange={(canProceed) => set({ locationCanProceed: canProceed })}
            onChange={(value, defaultValue) => {
              const histories = applyLocationChange(draft, value, defaultValue);
              set({
                location: value,
                selectedLocation: value,
                ...(histories.defaultLocations !== draft.defaultLocations
                  ? { defaultLocations: histories.defaultLocations }
                  : {}),
                ...(histories.deviceLocationHistory !== draft.deviceLocationHistory
                  ? { deviceLocationHistory: histories.deviceLocationHistory }
                  : {}),
                ...(histories.userLocationHistory !== draft.userLocationHistory
                  ? { userLocationHistory: histories.userLocationHistory }
                  : {}),
              });
            }}
          />
        </div>
      )}

      {birthCertSkipped && (
        <BirthCertificateField
          draft={draft}
          set={set}
          onSkip={() => set({ birthCertificateStatus: "skipped" })}
        />
      )}

      <label className="flex items-start gap-2 rounded-lg border p-4 text-sm">
        <Checkbox
          className="size-5 mt-0.5"
          checked={draft.declaration.confirmed}
          onCheckedChange={(checked) =>
            set({ declaration: { ...draft.declaration, confirmed: checked === true } })
          }
        />
        {t("appForm.declarationStep.confirmAccuracy")}
      </label>

      <label className="flex items-start gap-2 rounded-lg border p-4 text-sm">
        <Checkbox
          className="size-5 mt-0.5"
          checked={draft.declaration.consent}
          onCheckedChange={(checked) =>
            set({ declaration: { ...draft.declaration, consent: checked === true } })
          }
        />
        {t("appForm.declarationStep.consentProcessing")}
      </label>
    </div>
  );
}

function ReviewStep({
  draft,
  onNavigateToStep,
}: {
  draft: ApplicationDraft;
  onNavigateToStep: (step: number) => void;
}) {
  const { t } = useTranslation();
  const marksQuery = useQuery({
    queryKey: ["application-marks", draft.accessKey],
    queryFn: () => client.application.getMarks({ accessKey: draft.accessKey }),
    enabled: Boolean(draft.accessKey),
    staleTime: 60_000,
  });
  const adminMarks = marksQuery.data ?? [];
  const categoryLabels = getCategoryLabels(t);

  const groupedSections = [
    {
      title: t("appForm.reviewStep.location"),
      step: 0,
      fields: [
        [
          t("appForm.reviewStep.fields.locationAddress"),
          draft.location.address || t("appForm.reviewStep.status.notCompleted"),
        ],
      ] as [string, string][],
    },
    {
      title: t("appForm.reviewStep.applicantDetails"),
      step: 1,
      fields: [
        [
          t("appForm.reviewStep.fields.fullName"),
          draft.applicant.fullName || t("appForm.reviewStep.status.notCompleted"),
        ],
        [
          t("appForm.reviewStep.fields.fullNameSi"),
          draft.applicant.sinhalaName || t("appForm.reviewStep.status.notCompleted"),
        ],
        [
          t("appForm.reviewStep.fields.gender"),
          draft.applicant.gender || t("appForm.reviewStep.status.notSelected"),
        ],
        [
          t("appForm.reviewStep.fields.religion"),
          draft.applicant.religion || t("appForm.reviewStep.status.notSelected"),
        ],
        [
          t("appForm.reviewStep.fields.educationMedium"),
          draft.applicant.educationMedium || t("appForm.reviewStep.status.notSelected"),
        ],
        [
          t("appForm.reviewStep.fields.dateOfBirth"),
          draft.applicant.dateOfBirth || t("appForm.reviewStep.status.notCompleted"),
        ],
        [
          t("appForm.reviewStep.fields.birthCert"),
          draft.applicant.birthCertificateNumber || t("appForm.reviewStep.status.notCompleted"),
        ],
      ] as [string, string][],
    },
    {
      title: t("appForm.reviewStep.parentGuardian"),
      step: 2,
      fields: [
        [
          t("appForm.reviewStep.fields.relationship"),
          draft.guardian.relationship || t("appForm.reviewStep.status.notSelected"),
        ],
        [
          t("appForm.reviewStep.fields.guardianName"),
          draft.guardian.fullName || t("appForm.reviewStep.status.notCompleted"),
        ],
        [
          t("appForm.reviewStep.fields.guardianNameSi"),
          draft.guardian.sinhalaName || t("appForm.reviewStep.status.notCompleted"),
        ],
        [
          t("appForm.reviewStep.fields.guardianNic"),
          draft.guardian.nic || t("appForm.reviewStep.status.notCompleted"),
        ],
        [
          t("appForm.reviewStep.fields.phone"),
          draft.guardian.phone || t("appForm.reviewStep.status.notCompleted"),
        ],
        [
          t("appForm.reviewStep.fields.guardianEmail"),
          draft.guardian.email || t("appForm.reviewStep.status.notCompleted"),
        ],
      ] as [string, string][],
    },
    {
      title: t("appForm.reviewStep.residence"),
      step: 3,
      fields: [
        [
          t("appForm.reviewStep.fields.permanentAddressEn"),
          draft.residence.permanentAddressEn || t("appForm.reviewStep.status.notCompleted"),
        ],
        [
          t("appForm.reviewStep.fields.permanentAddressSi"),
          draft.residence.permanentAddressSi || t("appForm.reviewStep.status.notProvided"),
        ],
        [
          t("appForm.reviewStep.fields.currentAddressEn"),
          draft.residence.sameAsPermanent
            ? t("appForm.reviewStep.status.sameAsPermanent")
            : draft.residence.currentAddressEn || t("appForm.reviewStep.status.notCompleted"),
        ],
        [
          t("appForm.reviewStep.fields.currentAddressSi"),
          draft.residence.sameAsPermanent
            ? t("appForm.reviewStep.status.sameAsPermanent")
            : draft.residence.currentAddressSi || t("appForm.reviewStep.status.notProvided"),
        ],
        [
          t("appForm.reviewStep.fields.district"),
          draft.residence.district || t("appForm.reviewStep.status.notSelected"),
        ],
        [
          t("appForm.reviewStep.fields.dsDivision"),
          draft.residence.dsDivision || t("appForm.reviewStep.status.notSelected"),
        ],
        [
          t("appForm.reviewStep.fields.gnDivision"),
          draft.residence.gnDivision || t("appForm.reviewStep.status.notSelected"),
        ],
        [
          t("appForm.reviewStep.fields.electoralDistrict"),
          draft.residence.electoralDistrict || t("appForm.reviewStep.status.notSelected"),
        ],
      ] as [string, string][],
    },
  ];

  const categoryRows: [string, string][] =
    draft.categories.length > 0
      ? draft.categories.map((category): [string, string] => [
          categoryLabels[category.categoryType],
          categorySummary(category),
        ])
      : [[t("appForm.reviewStep.status.noneSelected"), ""]];

  return (
    <div className="">
      <div className="mb-5">
        <h3 className="font-heading text-xl sm:text-2xl">{t("appForm.reviewStep.heading")}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t("appForm.reviewStep.description")}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 items-start">
        {groupedSections.map((section) => (
          <div key={section.title} className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
              <h4 className="text-sm font-medium text-foreground">{section.title}</h4>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                onClick={() => onNavigateToStep(section.step)}
              >
                {t("appForm.reviewStep.edit")}
              </button>
            </div>
            <div className="divide-y">
              {section.fields.map(([label, value]) => (
                <div className="flex items-baseline justify-between gap-4 px-4 py-2.5" key={label}>
                  <span className="text-xs text-muted-foreground shrink-0">{label}</span>
                  <span className="text-sm font-medium text-right text-foreground truncate">
                    {value || t("appForm.reviewStep.none")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-foreground">
            {t("appForm.reviewStep.categories")}
          </h4>
          <button
            type="button"
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            onClick={() => onNavigateToStep(4)}
          >
            {t("appForm.reviewStep.edit")}
          </button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categoryRows.map(([label, summary]) => (
            <div key={label} className="rounded-xl border bg-card p-4">
              <span className="text-xs font-medium text-foreground block mb-1">{label}</span>
              {summary && (
                <p className="text-xs text-muted-foreground leading-relaxed">{summary}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {draft.submittedAt && (
        <>
          <div className="mt-6 rounded-xl border overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b bg-muted/40">
              <div>
                <h4 className="text-sm font-medium text-foreground">
                  {t("appForm.reviewStep.admissionReview")}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                {draft.isBanned ? (
                  <Badge variant="destructive" className="text-xs px-2.5 py-0.5">
                    {t("appForm.reviewStep.badge.banned")}
                  </Badge>
                ) : draft.admissionStatus === "verified" ? (
                  <Badge
                    variant="default"
                    className={`${STATUS_SUCCESS.badgeBg} ${STATUS_SUCCESS.badgeHover} text-xs px-2.5 py-0.5`}
                  >
                    {t("appForm.reviewStep.badge.verified")}
                  </Badge>
                ) : draft.admissionStatus === "fake" ? (
                  <Badge variant="destructive" className="text-xs px-2.5 py-0.5">
                    {t("appForm.reviewStep.badge.flagged")}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs px-2.5 py-0.5">
                    {t("appForm.reviewStep.badge.pendingReview")}
                  </Badge>
                )}
              </div>
            </div>
            <div className="grid gap-3 p-4">
              {draft.isBanned && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <div className="flex items-center gap-2 font-semibold mb-1">
                    <ShieldX size={15} /> {t("appForm.reviewStep.banned.heading")}
                  </div>
                  <p>{draft.banReason || t("appForm.reviewStep.banned.noReason")}</p>
                </div>
              )}

              {draft.admissionStatus === "verified" && (
                <div
                  className={`rounded-lg border ${STATUS_SUCCESS.borderStrong} ${STATUS_SUCCESS.bgSoft} p-3 text-sm ${STATUS_SUCCESS.textStrong}`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <Check size={15} /> {t("appForm.reviewStep.verified.heading")}
                  </div>
                </div>
              )}

              {draft.admissionStatus === "fake" && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <div className="flex items-center gap-2 font-semibold">
                    <TriangleAlert size={15} /> {t("appForm.reviewStep.flagged.heading")}
                  </div>
                </div>
              )}

              {draft.flags && draft.flags.length > 0 && (
                <div className="grid gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <span className="text-xs font-semibold text-destructive uppercase tracking-wider">
                    {t("appForm.reviewStep.observations", { count: draft.flags.length })}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {draft.flags.map((f, i) => (
                      <Badge key={i} variant="destructive" className="text-xs font-medium">
                        {f.label || f.key}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {draft.interviewNotes && (
                <div className="grid gap-1 rounded-lg border border-border bg-card p-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("appForm.reviewStep.adminNotes")}
                  </span>
                  <p className="text-sm whitespace-pre-wrap text-foreground">
                    {draft.interviewNotes}
                  </p>
                </div>
              )}

              {draft.interviewEdits && draft.interviewEdits.length > 0 && (
                <div className="grid gap-2 rounded-lg border border-border bg-card p-3">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    {t("appForm.reviewStep.changesByAdmin", { count: draft.interviewEdits.length })}
                  </span>
                  <div className="grid gap-1.5 max-h-48 overflow-y-auto">
                    {draft.interviewEdits.map((edit, i) => (
                      <div
                        key={i}
                        className="flex flex-wrap items-center gap-2 text-xs border-b border-border/40 pb-1 last:border-b-0 last:pb-0"
                      >
                        <strong className="text-foreground">{edit.label}:</strong>
                        <span className="line-through text-muted-foreground">
                          {edit.previousValue || t("appForm.reviewStep.emptyValue")}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-semibold text-foreground">
                          {edit.newValue || t("appForm.reviewStep.emptyValue")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
              <h4 className="text-sm font-medium text-foreground">
                {t("appForm.reviewStep.markAllocation")}
              </h4>
              {adminMarks.length === 0 && (
                <Badge variant="secondary" className="text-xs px-2.5 py-0.5">
                  {t("appForm.reviewStep.adminMarksPending")}
                </Badge>
              )}
            </div>
            <div className="p-4">
              {draft.categories.length > 0 ? (
                <div className="grid gap-2">
                  {draft.categories.map((category) => {
                    const autoScore = scoreCategory(category);
                    const adminMark = adminMarks.find(
                      (m) => m.categoryType === category.categoryType,
                    );
                    return (
                      <div
                        className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5"
                        key={category.categoryType}
                      >
                        <div className="grid gap-0.5">
                          <span className="text-xs text-muted-foreground">
                            {categoryLabels[category.categoryType]}
                          </span>
                          <div className="flex items-center gap-3 text-sm">
                            <span>
                              {t("appForm.reviewStep.indicative")}:{" "}
                              <strong className="tabular-nums">{autoScore.total}</strong>
                            </span>
                            {adminMark != null && (
                              <span className="text-primary font-semibold">
                                {t("appForm.reviewStep.adminMarks")}:{" "}
                                <strong className="tabular-nums">{adminMark.total}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                        {adminMark != null ? (
                          <Badge variant="default">{t("appForm.reviewStep.scored")}</Badge>
                        ) : (
                          <Badge variant="outline">{t("appForm.reviewStep.pending")}</Badge>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 mt-1">
                    <span className="text-sm font-medium">{t("appForm.reviewStep.total")}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span>
                        {t("appForm.reviewStep.indicative")}:{" "}
                        <strong className="tabular-nums">
                          {draft.categories.reduce((sum, c) => sum + scoreCategory(c).total, 0)}
                        </strong>
                      </span>
                      {adminMarks.length > 0 && (
                        <span className="text-primary font-semibold">
                          {t("appForm.reviewStep.adminMarks")}:{" "}
                          <strong className="tabular-nums">
                            {adminMarks.reduce((sum, m) => sum + m.total, 0)}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("appForm.reviewStep.noCategoriesSelected")}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function ApplicationForm({
  adminApplicationId,
  readOnly = false,
  initialData,
}: {
  adminApplicationId?: string;
  readOnly?: boolean;
  initialData?: ApplicationInitialData;
}) {
  const { t } = useTranslation();
  const saveQueue = useRef(Promise.resolve());
  const restorePromise = useRef<Promise<void> | null>(null);
  const navigate = useNavigate();

  // Seeds the store synchronously during the FIRST render (not in an effect)
  // from the loader-provided `initialData` - it's a plain prop, computed
  // identically by the same loader on both server and client, so there's no
  // hydration-mismatch risk. This is why the correct step/fields show
  // immediately instead of flashing an empty draft for a frame before an
  // effect fires after mount. Only the admin-editing path (no SSR loader
  // today) and the defensive "no initialData at all" fallback (e.g. tests
  // that render ApplicationForm directly) still resolve via the effect below.
  const seededRef = useRef(false);
  if (!seededRef.current && !adminApplicationId && initialData) {
    seededRef.current = true;
    const key = initialData.key;
    const code = initialData.code;
    if (initialData.application) {
      const result = initialData.application;
      const latest = normalizeDraft({
        ...(result.data as Partial<ApplicationDraft>),
        admissionStatus: result.admissionStatus,
        interviewNotes: result.interviewNotes,
        isBanned: result.isBanned,
        banReason: result.banReason,
        flags: result.flags,
      });
      const restoredSessionCode = result.sessionCode || code || "";
      setActiveApplication(key, restoredSessionCode);
      const loadedStep = latest.currentStep ?? 0;
      useApplicationStore.setState({
        ...latest,
        accessKey: key,
        sessionCode: restoredSessionCode,
        submittedAt: result.submittedAt ? String(result.submittedAt) : null,
        // Only a genuinely submitted application unlocks free navigation
        // across every step (for post-submission review/editing).
        // In-progress drafts must cap at the furthest step actually reached,
        // otherwise every step wrongly shows as "completed".
        maxVisitedStep: Math.max(latest.maxVisitedStep, loadedStep, result.submittedAt ? 6 : 0),
      });
    } else if (key || code) {
      useApplicationStore.setState({ accessKey: key, sessionCode: code });
    }
    if (initialData.status) {
      useApplicationStore.setState({
        submissionLocked: initialData.status.submissionLocked,
        submissionOpensAt: initialData.status.submissionOpensAt,
        submissionClosesAt: initialData.status.submissionClosesAt,
      });
    }
  }

  const draft = useApplicationStore();

  const set = (patch: Partial<ApplicationDraft>) => draft.updateDraft(patch);

  const collectionOnly = draft.submissionLocked && draft.submittedAt !== null;

  // Blocks a second Continue click while the previous one is still saving to
  // the server, so the step transition genuinely waits for the save.
  const [isAdvancing, setIsAdvancing] = useState(false);
  // Only consulted below `md`, where the identity cards are collapsed behind a
  // toggle. From `md` up the grid is always shown and this is ignored.
  const [identityOpen, setIdentityOpen] = useState(false);
  const [pendingSkipAdvance, setPendingSkipAdvance] = useState(false);
  /**
   * PDF receipt download. Explicit states rather than a bare boolean so the
   * button can say what is actually happening: a failed generation must not
   * look like an idle button the applicant simply forgot to press.
   */
  const [pdfState, setPdfState] = useState<"idle" | "generating" | "downloaded" | "error">("idle");
  const [pdfError, setPdfError] = useState("");

  const marksQuery = useQuery({
    queryKey: ["application-marks", draft.accessKey],
    queryFn: () => client.application.getMarks({ accessKey: draft.accessKey }),
    enabled: Boolean(draft.accessKey && draft.submittedAt),
    staleTime: 60_000,
  });
  const adminMarks = marksQuery.data ?? [];

  useEffect(() => {
    // Already handled synchronously above (see `seededRef`) for the common
    // case: a route rendered through routes/application.index.tsx's loader.
    // This effect only has real work left for the admin-editing path (no SSR
    // loader wired up for it) and the defensive fallback when this component
    // is rendered without `initialData` at all (e.g. component tests).
    if (seededRef.current && !adminApplicationId) {
      if (!initialData?.status) {
        void client.application.status().then(
          (status) =>
            set({
              submissionLocked: status.submissionLocked,
              submissionOpensAt: status.submissionOpensAt,
              submissionClosesAt: status.submissionClosesAt,
            }),
          () => set({ submissionLocked: true }),
        );
      }
      return;
    }
    let cancelled = false;
    const restore = async () => {
      const key = initialData?.key || getActiveKey();
      const code = initialData?.code || getActiveSessionCode();
      if (key || code) set({ accessKey: key, sessionCode: code });
      try {
        if (adminApplicationId) {
          const result = await client.admin.application.get({
            id: adminApplicationId,
          });
          if (!cancelled) {
            const latest = normalizeDraft(result.data as Partial<ApplicationDraft>);
            set({ ...latest, submittedAt: result.submittedAt ? String(result.submittedAt) : null });
          }
        } else if (key) {
          const result = await client.application.get({ accessKey: key });
          if (!cancelled) {
            const latest = normalizeDraft({
              ...(result.data as Partial<ApplicationDraft>),
              admissionStatus: result.admissionStatus,
              interviewNotes: result.interviewNotes,
              isBanned: result.isBanned,
              banReason: result.banReason,
              flags: result.flags,
            });
            const restoredSessionCode = result.sessionCode || code || "";
            // Always persist the resolved key/session code so the home page's
            // saved-applications list picks it up, even when `key` only came
            // from a bookmarked/shared `?key=&code=` link.
            setActiveApplication(key, restoredSessionCode);
            // The DB is the only source of truth now (no local draft cache to
            // merge against), so the server's record always wins outright.
            const loadedStep = latest.currentStep ?? 0;
            set({
              ...latest,
              accessKey: key,
              sessionCode: restoredSessionCode || draft.sessionCode,
              submittedAt: result.submittedAt ? String(result.submittedAt) : null,
              // Only a genuinely submitted application unlocks free navigation
              // across every step (for post-submission review/editing).
              // In-progress drafts must cap at the furthest step actually
              // reached, otherwise every step wrongly shows as "completed".
              maxVisitedStep: Math.max(
                useApplicationStore.getState().maxVisitedStep,
                loadedStep,
                result.submittedAt ? 6 : 0,
              ),
            });
          }
        }
        const status = await client.application.status().catch(() => null);
        if (!cancelled) {
          set(
            status
              ? {
                  submissionLocked: status.submissionLocked,
                  submissionOpensAt: status.submissionOpensAt,
                  submissionClosesAt: status.submissionClosesAt,
                }
              : { submissionLocked: true },
          );
        }
      } catch {
        if (!cancelled) {
          draft.reset();
          clearActiveKey();
          set({ accessKey: "", sessionCode: "", submissionLocked: true, submittedAt: null });
        }
      }
    };
    restorePromise.current = restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSavedSnapshot = useRef("");

  useEffect(() => {
    if (!draft.accessKey) return;
    if (draft.submittedAt && draft.submissionLocked) return;
    const snapshot = JSON.stringify(normalizeDraft(draft));
    if (!lastSavedSnapshot.current) {
      lastSavedSnapshot.current = snapshot;
      return;
    }
    if (snapshot === lastSavedSnapshot.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      lastSavedSnapshot.current = snapshot;
      void saveToServer();
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [
    draft.categories,
    draft.applicant,
    draft.guardian,
    draft.residence,
    draft.declaration,
    draft.currentStep,
    draft.accessKey,
    draft.submittedAt,
    draft.submissionLocked,
  ]);

  const current = draft.currentStep;
  const steps = getSteps(t);

  const saveToServer = async (showFeedback = true) => {
    const operation = saveQueue.current.then(async () => {
      const currentDraft = useApplicationStore.getState();
      const data = normalizeDraft(currentDraft);
      const saveStartedAt = Date.now();
      set({ saveStatus: t("appForm.statusBar.saving") });
      try {
        if (adminApplicationId)
          await client.admin.application.update({ id: adminApplicationId, data });
        else if (currentDraft.accessKey)
          await client.application.update({ accessKey: currentDraft.accessKey, data });
        if (currentDraft.accessKey && currentDraft.categories.length > 0) {
          const marks = currentDraft.categories.map((cat) => {
            const score = scoreCategory(cat);
            return {
              categoryType: cat.categoryType,
              total: score.total,
              breakdown: score.breakdown,
            };
          });
          await client.application
            .saveIndicativeMarks({ accessKey: currentDraft.accessKey, marks })
            .catch(() => {});
        }
        const remainingFeedbackMs = 120 - (Date.now() - saveStartedAt);
        if (showFeedback && remainingFeedbackMs > 0) {
          const { promise, resolve } = Promise.withResolvers<void>();
          setTimeout(resolve, remainingFeedbackMs);
          await promise;
        }
        set({ saveStatus: t("appForm.statusBar.savedSecurely") });
      } catch {
        set({ saveStatus: t("appForm.statusBar.saveFailed") });
      }
    });
    saveQueue.current = operation.catch(() => undefined);
    return operation;
  };

  // Raw browser/network failures ("Failed to fetch", "NetworkError when
  // attempting to fetch resource", "Load failed", ...) are meaningless to an
  // applicant. Only surface an error's own message when it came from the
  // server (a validation or business-rule message); otherwise fall back to a
  // friendly, translated explanation.
  const isRawNetworkError = (message: string) => {
    const normalized = message.trim().toLowerCase();
    return (
      normalized === "" ||
      normalized.includes("failed to fetch") ||
      normalized.includes("networkerror") ||
      normalized.includes("network request failed") ||
      normalized.includes("load failed") ||
      normalized.includes("the internet connection appears to be offline")
    );
  };
  const friendlyErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && !isRawNetworkError(error.message)) return error.message;
    return t("appForm.buttons.submitError.networkError") || fallback;
  };

  const next = async () => {
    if (nextDisabledReason) return;
    if (isAdvancing) return;
    setIsAdvancing(true);
    try {
      set({ submitError: "" });
      if (restorePromise.current) await restorePromise.current;
      await ensureAccessKey();
      const nextStep = Math.min(current + 1, steps.length - 1);
      draft.setStep(nextStep);
      await saveToServer();
    } catch (error) {
      set({
        submitError: friendlyErrorMessage(error, t("appForm.buttons.submitError.couldNotSave")),
      });
      draft.setStep(current);
    } finally {
      setIsAdvancing(false);
    }
  };

  // Creates the draft application record (unpublished) on the server the
  // first time the applicant advances past a step, and mirrors the resulting
  // access key / session code into localStorage and the URL search params so
  // the draft can be resumed after a reload or on another device. A no-op
  // once an access key already exists.
  const ensureAccessKey = async (): Promise<string> => {
    let accessKey = useApplicationStore.getState().accessKey;
    if (!accessKey && !adminApplicationId && !readOnly) {
      const result = await client.application.create({
        data: normalizeDraft(useApplicationStore.getState()),
      });
      accessKey = result.accessKey;
      setActiveApplication(result.accessKey, result.sessionCode);
      window.history.replaceState(
        {},
        "",
        `/application?code=${encodeURIComponent(result.sessionCode)}&key=${encodeURIComponent(result.accessKey)}`,
      );
      set({ accessKey: result.accessKey, sessionCode: result.sessionCode });
    }
    return accessKey;
  };

  const submitApplication = async () => {
    try {
      set({ isSubmitting: true, submitError: "" });
      if (restorePromise.current) await restorePromise.current;
      let accessKey = await ensureAccessKey();
      await saveToServer(false);
      accessKey = useApplicationStore.getState().accessKey || accessKey;
      if (!accessKey) throw new Error(t("appForm.buttons.submitError.couldNotCreateDraft"));
      set({ saveStatus: t("appForm.statusBar.submitting") });
      await client.application.submit({ accessKey });
      set({ submittedAt: new Date().toISOString(), saveStatus: t("appForm.statusBar.submitted") });
    } catch (error) {
      set({ saveStatus: "" });
      if (
        error instanceof Error &&
        error.message.includes("Submissions are outside the configured form window")
      ) {
        set({ showSubmissionRequest: true });
      } else {
        set({
          submitError: friendlyErrorMessage(error, t("appForm.buttons.submitError.couldNotSubmit")),
        });
      }
    } finally {
      set({ isSubmitting: false });
    }
  };

  const submitApprovalRequest = async () => {
    try {
      set({ requestSaving: true });
      await client.application.requestAccess({
        accessKey: draft.accessKey,
        applicantName: draft.requestName.trim(),
        contactPhone: draft.requestPhone.trim(),
        requestType: "submission",
      });
      set({ showSubmissionRequest: false, saveStatus: t("appForm.buttons.approvalRequestSent") });
    } catch (error) {
      set({ submitError: friendlyErrorMessage(error, t("appForm.buttons.approvalRequestError")) });
    } finally {
      set({ requestSaving: false });
    }
  };

  const startAnotherApplication = () => {
    clearActiveKey();
    draft.reset();
    window.location.assign("/application");
  };

  const back = () => draft.setStep(Math.max(current - 1, 0));

  const runPdfDownload = async () => {
    setPdfState("generating");
    setPdfError("");
    try {
      await downloadApplicationPdf(useApplicationStore.getState());
      setPdfState("downloaded");
    } catch (error) {
      setPdfState("error");
      setPdfError(friendlyErrorMessage(error, t("appForm.submitted.pdf.errorTitle")));
    }
  };

  const copyWithFeedback = (label: string, value: string) => {
    void navigator.clipboard?.writeText(value).then(
      () => {
        set({ copiedField: label });
        setTimeout(() => set({ copiedField: null }), 2000);
      },
      () => undefined,
    );
  };

  const nextDisabledReason = getNextStepReason({
    step: current,
    locationCanProceed: draft.locationCanProceed,
    location: draft.location,
    locationStatus: draft.locationStatus,
    duplicateBirthCertificate: draft.duplicateBirthCertificate,
    birthCertificateStatus: draft.birthCertificateStatus,
    applicant: draft.applicant,
    guardian: draft.guardian,
    categories: draft.categories,
    declaration: draft.declaration,
  });
  const isNextDisabled = Boolean(nextDisabledReason);

  // Steps the applicant advanced past by skipping a field they still owe.
  // Surfaced on the stepper and on Continue so an outstanding skip stays
  // visible instead of being discovered at the very end.
  const locationOutstanding = isSkipOutstanding(
    draft.locationStatus,
    locationIsReady(draft.location),
  );
  const birthCertOutstanding = isSkipOutstanding(
    draft.birthCertificateStatus,
    draft.applicant.birthCertificateNumber.trim().length > 0,
  );
  const skippedSteps: number[] = [
    ...(locationOutstanding ? [0] : []),
    ...(birthCertOutstanding ? [1] : []),
  ];
  const advancingWithSkip = skippedSteps.includes(current);

  // Skipping a field advances to the next step, but only when the skip is what
  // was holding the step back. On the applicant step the birth certificate is
  // one of several required fields, so a skip there usually leaves work behind
  // and the applicant should stay put. The advance is deferred by one render so
  // `nextDisabledReason` is recomputed from the store with the skip applied,
  // rather than read from this render's stale value.
  const skipAndAdvance = (patch: Partial<ApplicationDraft>) => {
    set(patch);
    setPendingSkipAdvance(true);
  };

  useEffect(() => {
    if (!pendingSkipAdvance) return;
    setPendingSkipAdvance(false);
    if (!nextDisabledReason) void next();
  }, [pendingSkipAdvance, nextDisabledReason, next]);

  return (
    <main className="min-h-[calc(100svh-4rem)] bg-[radial-gradient(circle_at_82%_0%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_34rem)] px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
      <section className="mx-auto max-w-[1320px]">
        <div className="mb-9 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.38fr)]">
          <div className="min-w-0">
            <h1 className="font-heading text-[clamp(2.35rem,5vw,4.5rem)] leading-[0.98] tracking-[-0.03em]">
              {t("appForm.buttons.applicantInfo")}
            </h1>
            <p className="mt-4 max-w-[48rem] text-[1.05rem] leading-relaxed text-muted-foreground">
              {t("appForm.buttons.applicantInfoDescription")}
            </p>
            {(draft.sessionCode || draft.accessKey || draft.applicant.fullName) && (
              <div className="mt-5 max-w-[1180px]">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-[14px] border border-primary/25 bg-primary/5 p-4 text-left md:hidden"
                  aria-expanded={identityOpen}
                  onClick={() => setIdentityOpen((open) => !open)}
                >
                  <span className="text-muted-foreground text-[0.76rem] font-bold tracking-wider uppercase">
                    {t("appForm.buttons.applicantInfoToggle")}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-muted-foreground transition-transform ${identityOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  className={`gap-4 md:mt-0 md:grid md:grid-cols-2 lg:grid-cols-3 ${identityOpen ? "mt-3 grid" : "hidden"}`}
                >
                  {draft.applicant.fullName && (
                    <div className="rounded-[14px] border border-primary/25 bg-primary/5 p-4">
                      <span className="text-muted-foreground text-[0.76rem] font-bold tracking-wider uppercase">
                        {t("appForm.reviewStep.fields.fullName")}
                      </span>
                      <span className="block mt-1 font-bold tracking-wide text-[clamp(1rem,1.4vw,1.12rem)]">
                        {draft.applicant.fullName}
                      </span>
                    </div>
                  )}
                  {draft.sessionCode && (
                    <div className="rounded-[14px] border border-primary/25 bg-primary/5 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground text-[0.76rem] font-bold tracking-wider uppercase">
                          {t("appForm.sessionCode.label")}
                        </span>
                        <button
                          type="button"
                          className="shrink-0 rounded-md px-1.5 py-1 text-primary text-[0.72rem] transition-colors hover:bg-primary/10"
                          aria-label={t("appForm.sessionCode.copyAriaLabel")}
                          onClick={(e) => {
                            e.stopPropagation();
                            copyWithFeedback("session", draft.sessionCode);
                          }}
                        >
                          {draft.copiedField === "session" ? (
                            <>
                              <Check size={14} /> {t("appForm.sessionCode.copied")}
                            </>
                          ) : (
                            <>
                              <Copy size={14} /> {t("appForm.sessionCode.copy")}
                            </>
                          )}
                        </button>
                      </div>
                      <code className="block mt-1 overflow-wrap-anywhere font-bold tracking-wide text-[clamp(0.98rem,1.3vw,1.1rem)]">
                        {draft.sessionCode}
                      </code>
                      <span className="text-primary text-[0.78rem] font-semibold leading-relaxed">
                        {t("appForm.sessionCode.hint")}
                      </span>
                    </div>
                  )}
                  {draft.accessKey && (
                    <div className="rounded-[14px] border border-primary/25 bg-primary/5 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground text-[0.76rem] font-bold tracking-wider uppercase">
                          {t("appForm.accessKey.label")}
                        </span>
                        <button
                          type="button"
                          className="shrink-0 rounded-md px-1.5 py-1 text-primary text-[0.72rem] transition-colors hover:bg-primary/10"
                          aria-label={t("appForm.accessKey.copyAriaLabel")}
                          onClick={(e) => {
                            e.stopPropagation();
                            copyWithFeedback("key", draft.accessKey);
                          }}
                        >
                          {draft.copiedField === "key" ? (
                            <>
                              <Check size={14} /> {t("appForm.accessKey.copied")}
                            </>
                          ) : (
                            <>
                              <Copy size={14} /> {t("appForm.accessKey.copy")}
                            </>
                          )}
                        </button>
                      </div>
                      <code className="block mt-1 max-w-full break-all font-bold tracking-wide text-[clamp(0.98rem,1.3vw,1.1rem)]">
                        {draft.accessKey}
                      </code>
                      <span className="py-2 text-primary text-[0.78rem] font-semibold leading-relaxed">
                        {t("appForm.accessKey.hint")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="grid gap-3 rounded-2xl border border-primary/20 bg-card/85 p-5 shadow-[0_14px_32px_color-mix(in_oklch,var(--foreground)_6%,transparent)]">
            <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              <span>{t("appForm.statusBar.applicationStatus")}</span>
              <ShieldCheck className="text-primary" size={17} />
            </div>
            <strong className="font-heading text-2xl leading-tight">
              {t("appForm.statusBar.stepOf", { current: current + 1, total: steps.length })}
            </strong>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("appForm.statusBar.keepGoing")}
            </p>
            <div className="flex items-center gap-2 border-t pt-3 text-sm text-primary">
              <span
                className={`size-2 rounded-full ${draft.saveStatus === t("appForm.statusBar.saving") ? "animate-pulse" : ""} ${draft.saveStatus.includes("failed") ? "bg-destructive" : "bg-primary"}`}
                aria-hidden="true"
              />
              {draft.saveStatus === t("appForm.statusBar.savedSecurely")
                ? t("appForm.statusBar.saved")
                : draft.saveStatus ||
                  (draft.accessKey
                    ? t("appForm.statusBar.connected")
                    : t("appForm.statusBar.connecting"))}
            </div>
          </div>
        </div>
      </section>

      <Card className="mx-auto max-w-[1320px] overflow-hidden shadow-[0_20px_45px_color-mix(in_oklch,var(--foreground)_8%,transparent)]">
        <StepIndicator
          current={current}
          maxVisited={draft.maxVisitedStep}
          steps={steps}
          skippedSteps={skippedSteps}
          onStepClick={(index) => draft.setStep(index)}
        />

        <CardContent className="min-h-[440px] p-5 md:p-9">
          {current === 0 && (
            <LocationStepCard
              draft={draft}
              readOnly={readOnly}
              set={set}
              onSkip={() => skipAndAdvance({ locationStatus: "skipped" })}
            />
          )}
          {current === 1 && (
            <ApplicantStep
              draft={draft}
              set={set}
              onSkip={() => skipAndAdvance({ birthCertificateStatus: "skipped" })}
            />
          )}
          {current === 2 && <GuardianStep draft={draft} set={set} />}
          {current === 3 && <ResidenceStep draft={draft} set={set} />}
          {current === 4 && <CategoryStep />}
          {current === 5 && <DeclarationStep draft={draft} set={set} />}
          {current === 6 && (
            <ReviewStep draft={draft} onNavigateToStep={(step) => draft.setStep(step)} />
          )}
        </CardContent>

        <div className="flex flex-col flex-wrap items-stretch justify-between gap-4 border-t px-5 py-5 sm:flex-row sm:items-center md:px-8 md:py-6">
          {draft.submitError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 max-w-md">
              <TriangleAlert size={16} className="shrink-0 mt-0.5 text-destructive" />
              <p className="text-sm text-destructive break-words">{draft.submitError}</p>
            </div>
          )}
          {draft.submittedAt && !draft.submissionLocked ? (
            <div className="grid w-full gap-6 p-6 sm:p-8 lg:p-10">
              <div className="flex items-start gap-4 rounded-2xl border border-primary/25 bg-primary/8 p-5 sm:p-6">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                  <Check size={23} strokeWidth={2.5} />
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                    {t("appForm.submitted.statusBadge")}
                  </span>
                  <strong className="font-heading text-2xl leading-tight sm:text-3xl">
                    {t("appForm.submitted.title")}
                  </strong>
                  <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                    {t("appForm.submitted.description")}
                  </p>
                </div>
              </div>

              {draft.isBanned ? (
                <div className="flex items-start gap-4 rounded-2xl border border-destructive/30 bg-destructive/8 p-5 sm:p-6">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm">
                    <ShieldX size={23} strokeWidth={2.5} />
                  </div>
                  <div className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-destructive">
                      {t("appForm.submitted.bannedStatusBadge")}
                    </span>
                    <strong className="font-heading text-xl leading-tight sm:text-2xl">
                      {t("appForm.submitted.bannedTitle")}
                    </strong>
                    <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                      {draft.banReason || t("appForm.submitted.bannedDescription")}
                    </p>
                  </div>
                </div>
              ) : draft.admissionStatus === "verified" ? (
                <div className={`rounded-2xl border ${SECTION_COLORS.success.card} p-5 sm:p-6`}>
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex size-11 shrink-0 items-center justify-center rounded-full ${STATUS_SUCCESS.bgSolid} text-white shadow-sm`}
                    >
                      <Check size={23} strokeWidth={2.5} />
                    </div>
                    <div className="grid gap-2">
                      <span
                        className={`text-xs font-bold uppercase tracking-[0.14em] ${SECTION_COLORS.success.label}`}
                      >
                        {t("appForm.submitted.verifiedStatusBadge")}
                      </span>
                      <strong className="font-heading text-xl leading-tight sm:text-2xl">
                        {t("appForm.submitted.verifiedTitle")}
                      </strong>
                      <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                        {t("appForm.submitted.verifiedDescription")}
                      </p>
                    </div>
                  </div>
                  {adminMarks.length > 0 && (
                    <div
                      className={`mt-4 grid gap-2 rounded-xl border ${STATUS_SUCCESS.border} ${STATUS_SUCCESS.bgSoft} p-4`}
                    >
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${STATUS_SUCCESS.text}`}
                      >
                        {t("appForm.submitted.categoryMarks")}
                      </span>
                      <div className="grid gap-1.5">
                        {draft.categories.map((category) => {
                          const mark = adminMarks.find(
                            (m) => m.categoryType === category.categoryType,
                          );
                          if (!mark) return null;
                          return (
                            <div
                              key={category.categoryType}
                              className={`flex items-center justify-between text-sm py-1 border-b border-emerald-500/10 last:border-b-0`}
                            >
                              <span className="text-foreground">
                                {getCategoryLabels(t)[category.categoryType]}
                              </span>
                              <span className={`font-semibold ${STATUS_SUCCESS.textStrong}`}>
                                {mark.total}
                              </span>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between text-sm font-semibold pt-1">
                          <span>{t("appForm.reviewStep.total")}</span>
                          <span className={`${STATUS_SUCCESS.textStrong}`}>
                            {adminMarks.reduce((sum, m) => sum + m.total, 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {draft.flags && draft.flags.length > 0 && (
                    <div
                      className={`mt-3 grid gap-2 rounded-xl border ${STATUS_WARNING.border} ${STATUS_WARNING.bgSoft} p-4`}
                    >
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${STATUS_WARNING.text}`}
                      >
                        {t("appForm.submitted.observations", { count: draft.flags.length })}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {draft.flags.map((f, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className={`border-amber-500/40 ${STATUS_WARNING.textStrong} text-xs`}
                          >
                            {f.label || f.key}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {draft.interviewNotes && (
                    <div
                      className={`mt-3 rounded-xl border ${STATUS_SUCCESS.border} ${STATUS_SUCCESS.bgSoft} p-4`}
                    >
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${STATUS_SUCCESS.text}`}
                      >
                        {t("appForm.submitted.adminNote")}
                      </span>
                      <p className="text-sm mt-1 text-foreground">{draft.interviewNotes}</p>
                    </div>
                  )}
                  {draft.interviewEdits && draft.interviewEdits.length > 0 && (
                    <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-50/20 p-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                        {t("appForm.submitted.changesByAdmin", {
                          count: draft.interviewEdits.length,
                        })}
                      </span>
                      <div className="mt-2 grid gap-1 max-h-40 overflow-y-auto">
                        {draft.interviewEdits.map((edit, i) => (
                          <div
                            key={i}
                            className="flex flex-wrap items-center gap-2 text-xs border-b border-blue-500/10 pb-1 last:border-b-0 last:pb-0"
                          >
                            <strong className="text-foreground">{edit.label}:</strong>
                            <span className="line-through text-muted-foreground">
                              {edit.previousValue || t("appForm.reviewStep.emptyValue")}
                            </span>
                            <span>→</span>
                            <span className="font-semibold text-primary">
                              {edit.newValue || t("appForm.reviewStep.emptyValue")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : draft.admissionStatus === "fake" ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/8 p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm">
                      <TriangleAlert size={23} strokeWidth={2.5} />
                    </div>
                    <div className="grid gap-2">
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-destructive">
                        {t("appForm.submitted.flaggedStatusBadge")}
                      </span>
                      <strong className="font-heading text-xl leading-tight sm:text-2xl">
                        {t("appForm.submitted.flaggedTitle")}
                      </strong>
                      <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                        {t("appForm.submitted.flaggedDescription")}
                      </p>
                    </div>
                  </div>
                  {draft.flags && draft.flags.length > 0 && (
                    <div className="mt-4 grid gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-destructive">
                        {t("appForm.submitted.flaggedItems", { count: draft.flags.length })}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {draft.flags.map((f, i) => (
                          <Badge key={i} variant="destructive" className="text-xs">
                            {f.label || f.key}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {adminMarks.length > 0 && (
                    <div className="mt-3 grid gap-2 rounded-xl border border-border bg-card p-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {t("appForm.submitted.categoryMarks")}
                      </span>
                      <div className="grid gap-1.5">
                        {draft.categories.map((category) => {
                          const mark = adminMarks.find(
                            (m) => m.categoryType === category.categoryType,
                          );
                          if (!mark) return null;
                          return (
                            <div
                              key={category.categoryType}
                              className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-b-0"
                            >
                              <span className="text-foreground">
                                {getCategoryLabels(t)[category.categoryType]}
                              </span>
                              <span className="font-semibold">{mark.total}</span>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between text-sm font-semibold pt-1">
                          <span>{t("appForm.reviewStep.total")}</span>
                          <span>{adminMarks.reduce((sum, m) => sum + m.total, 0)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {draft.interviewNotes && (
                    <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-destructive">
                        {t("appForm.submitted.adminNote")}
                      </span>
                      <p className="text-sm mt-1 text-foreground">{draft.interviewNotes}</p>
                    </div>
                  )}
                  {draft.interviewEdits && draft.interviewEdits.length > 0 && (
                    <div
                      className={`mt-3 rounded-xl border ${STATUS_INFO.border} ${STATUS_INFO.bg} p-4`}
                    >
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${STATUS_INFO.text} `}
                      >
                        {t("appForm.submitted.changesByAdmin", {
                          count: draft.interviewEdits.length,
                        })}
                      </span>
                      <div className="mt-2 grid gap-1 max-h-40 overflow-y-auto">
                        {draft.interviewEdits.map((edit, i) => (
                          <div
                            key={i}
                            className={`flex flex-wrap items-center gap-2 text-xs border-b border-blue-500/10 pb-1 last:border-b-0 last:pb-0`}
                          >
                            <strong className="text-foreground">{edit.label}:</strong>
                            <span className="line-through text-muted-foreground">
                              {edit.previousValue || t("appForm.reviewStep.emptyValue")}
                            </span>
                            <span>→</span>
                            <span className="font-semibold text-primary">
                              {edit.newValue || t("appForm.reviewStep.emptyValue")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : draft.submittedAt ? (
                <div
                  className={`flex items-start gap-4 rounded-2xl border ${SECTION_COLORS.warning.card} p-5 sm:p-6`}
                >
                  <div
                    className={`flex size-11 shrink-0 items-center justify-center rounded-full ${STATUS_WARNING.bgSolid} text-white shadow-sm`}
                  >
                    <FileSearch size={22} strokeWidth={2.5} />
                  </div>
                  <div className="grid gap-2">
                    <span
                      className={`text-xs font-bold uppercase tracking-[0.14em] ${SECTION_COLORS.warning.label}`}
                    >
                      {t("appForm.submitted.awaitingReviewBadge")}
                    </span>
                    <strong className="font-heading text-xl leading-tight sm:text-2xl">
                      {t("appForm.submitted.awaitingReviewTitle")}
                    </strong>
                    <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                      {t("appForm.submitted.awaitingReviewDescription")}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)]">
                <section
                  className="grid gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:p-6"
                  aria-labelledby="submitted-access-key-heading"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid gap-1">
                      <div className="flex items-center gap-2 text-primary">
                        <KeyRound size={18} />
                        <h2
                          id="submitted-access-key-heading"
                          className="text-base font-semibold text-foreground"
                        >
                          {t("appForm.submitted.yourAccessKey")}
                        </h2>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {t("appForm.submitted.accessKeyDescription")}
                      </p>
                    </div>
                    <ShieldCheck
                      className="mt-0.5 shrink-0 text-primary"
                      size={19}
                      aria-hidden="true"
                    />
                  </div>
                  <code className="block overflow-x-auto rounded-xl bg-background px-4 py-3 font-mono text-sm font-semibold leading-relaxed tracking-wide text-foreground ring-1 ring-border/70">
                    {draft.accessKey}
                  </code>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyWithFeedback("keycard", draft.accessKey);
                    }}
                  >
                    {draft.copiedField === "keycard" ? (
                      <>
                        <Check size={16} /> {t("appForm.submitted.copied")}
                      </>
                    ) : (
                      <>
                        <Copy size={16} /> {t("appForm.submitted.copyKey")}
                      </>
                    )}
                  </Button>
                </section>

                <section
                  className="grid content-start gap-3 rounded-2xl border border-border bg-background p-5 sm:p-6"
                  aria-labelledby="submitted-pdf-heading"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid gap-1">
                      <div className="flex items-center gap-2 text-primary">
                        <FileText size={18} />
                        <h2
                          id="submitted-pdf-heading"
                          className="text-base font-semibold text-foreground"
                        >
                          {t("appForm.submitted.pdf.title")}
                        </h2>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {t("appForm.submitted.pdf.description", {
                          filename: applicationPdfFilename(draft),
                        })}
                      </p>
                    </div>
                  </div>

                  {pdfState === "error" && (
                    <p className={`text-sm ${STATUS_ERROR.text}`} role="alert">
                      {pdfError || t("appForm.submitted.pdf.errorTitle")}
                    </p>
                  )}

                  <Button
                    type="button"
                    variant={pdfState === "downloaded" ? "outline" : "default"}
                    className="w-full"
                    disabled={pdfState === "generating"}
                    aria-busy={pdfState === "generating"}
                    onClick={() => void runPdfDownload()}
                  >
                    {pdfState === "generating" ? (
                      <>
                        <Spinner /> {t("appForm.submitted.pdf.generating")}
                      </>
                    ) : pdfState === "downloaded" ? (
                      <>
                        <Check size={16} /> {t("appForm.submitted.pdf.downloadAgain")}
                      </>
                    ) : pdfState === "error" ? (
                      <>
                        <RotateCcw size={16} /> {t("appForm.submitted.pdf.retry")}
                      </>
                    ) : (
                      <>
                        <Download size={16} /> {t("appForm.submitted.pdf.download")}
                      </>
                    )}
                  </Button>
                </section>

                <aside
                  className="grid content-start gap-4 rounded-2xl border border-border bg-muted/20 p-5 sm:p-6"
                  aria-labelledby="submitted-next-steps-heading"
                >
                  <div className="grid gap-1">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {t("appForm.submitted.nextSteps.badge")}
                    </span>
                    <h2 id="submitted-next-steps-heading" className="font-heading text-xl">
                      {t("appForm.submitted.nextSteps.title")}
                    </h2>
                  </div>
                  <ol className="grid gap-3 text-sm">
                    <li className="flex items-start gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">
                        1
                      </span>
                      <span className="leading-relaxed text-muted-foreground">
                        {t("appForm.submitted.nextSteps.step1")}
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">
                        2
                      </span>
                      <span className="leading-relaxed text-muted-foreground">
                        {t("appForm.submitted.nextSteps.step2")}
                      </span>
                    </li>
                  </ol>
                </aside>
              </div>

              <div className="flex flex-wrap gap-3 border-t pt-5">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void navigate({ to: "/" })}
                >
                  <House size={17} /> {t("appForm.submitted.backToHome")}
                </Button>
                {!collectionOnly && (
                  <Button type="button" onClick={startAnotherApplication}>
                    <UserPlus size={17} /> {t("appForm.submitted.applyForAnother")}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              {draft.lastSavedAt && (
                <span className="inline-flex items-center gap-1 text-primary text-[0.85rem] whitespace-nowrap">
                  <Check size={15} /> {t("appForm.statusBar.savedLocally")}
                </span>
              )}
              <div className="ml-auto flex flex-wrap justify-end gap-2 sm:gap-3">
                {current > 0 && (
                  <Button variant="secondary" onClick={back}>
                    <ArrowLeft size={17} /> {t("appForm.buttons.back")}
                  </Button>
                )}
                {current < steps.length - 1 ? (
                  <Button
                    disabled={isNextDisabled || isAdvancing}
                    className={
                      advancingWithSkip
                        ? `${STATUS_WARNING.bgSolid} text-white ${STATUS_WARNING.hoverBg} ${STATUS_WARNING.hoverText}`
                        : "shadow-md shadow-primary/15"
                    }
                    onClick={next}
                  >
                    {advancingWithSkip && <TriangleAlert size={16} />}
                    {advancingWithSkip
                      ? t("appForm.buttons.continueSkipped")
                      : t("appForm.buttons.continue")}{" "}
                    <ArrowRight size={17} />
                  </Button>
                ) : (
                  <Button
                    disabled={
                      draft.isSubmitting ||
                      collectionOnly ||
                      !draft.declaration.confirmed ||
                      !draft.declaration.consent
                    }
                    aria-label={
                      collectionOnly ? t("appForm.buttons.collectionOnlyAriaLabel") : undefined
                    }
                    className="shadow-md shadow-primary/15"
                    onClick={() => void submitApplication()}
                  >
                    {collectionOnly ? (
                      <>
                        <Clock3 size={17} /> {t("appForm.buttons.collectionOnly")}
                      </>
                    ) : draft.submittedAt ? (
                      t("appForm.buttons.updateApplication")
                    ) : (
                      t("appForm.buttons.submitApplication")
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {nextDisabledReason && current !== 0 && current < steps.length - 1 && (
          <div className="flex items-center gap-2 px-(--card-spacing) py-2 text-sm text-muted-foreground border-t">
            <span>{nextDisabledReason}</span>
          </div>
        )}

        {current === steps.length - 1 &&
          !collectionOnly &&
          !draft.isSubmitting &&
          (() => {
            const reasons: string[] = [];
            if (!draft.declaration.confirmed) reasons.push(t("appForm.buttons.confirmInfo"));
            if (!draft.declaration.consent) reasons.push(t("appForm.buttons.giveConsent"));
            if (reasons.length === 0) return null;
            return (
              <div className="flex items-center gap-2 px-(--card-spacing) py-2 text-sm text-muted-foreground border-t">
                <span>{reasons.join(". ")}.</span>
              </div>
            );
          })()}

        {collectionOnly && (
          <CardFooter className="flex items-center gap-3 px-(--card-spacing) py-4 bg-primary/8 border-t border-primary/20">
            <Clock3 size={18} />
            <div className="grid gap-0.5 text-sm flex-1">
              <strong>{t("appForm.buttons.formWindowClosed.title")}</strong>
              <span className="text-muted-foreground">
                {t("appForm.buttons.formWindowClosed.description", {
                  opensAt: draft.submissionOpensAt
                    ? new Date(draft.submissionOpensAt).toLocaleString()
                    : t("appForm.buttons.formWindowClosed.notConfigured"),
                  closesAt: draft.submissionClosesAt
                    ? new Date(draft.submissionClosesAt).toLocaleString()
                    : t("appForm.buttons.formWindowClosed.notConfigured"),
                })}
              </span>
            </div>
            <AlertDialog
              open={draft.clearDraftDialogOpen}
              onOpenChange={(open) => set({ clearDraftDialogOpen: open })}
            >
              <button
                type="button"
                className="bg-transparent text-muted-foreground text-xs border-0 cursor-pointer hover:text-foreground flex flex-row gap-2"
                onClick={() => set({ clearDraftDialogOpen: true })}
              >
                <RotateCcw size={15} /> {t("appForm.buttons.clearDraft")}
              </button>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("appForm.buttons.clearDraftDialog.title")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("appForm.buttons.clearDraftDialog.description")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {t("appForm.buttons.clearDraftDialog.cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => {
                      clearActiveKey();
                      draft.reset();
                      set({ clearDraftDialogOpen: false });
                      window.location.assign("/");
                    }}
                  >
                    {t("appForm.buttons.clearDraftDialog.confirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        )}

        {draft.showSubmissionRequest && (
          <div className="flex items-start gap-3 px-(--card-spacing) py-4 bg-primary/8 border-t border-primary/20">
            <ShieldCheck size={18} className="mt-0.5" />
            <div className="grid gap-3 flex-1">
              <strong>{t("appForm.buttons.submissionRequest.title")}</strong>
              <span className="text-sm text-muted-foreground">
                {t("appForm.buttons.submissionRequest.description")}
              </span>
              <div className="grid gap-2 max-w-md">
                <Input
                  placeholder={t("appForm.buttons.submissionRequest.namePlaceholder")}
                  value={draft.requestName}
                  onChange={(e) => set({ requestName: e.target.value })}
                />
                <Input
                  placeholder={t("appForm.buttons.submissionRequest.phonePlaceholder")}
                  value={draft.requestPhone}
                  onChange={(e) => set({ requestPhone: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={
                    draft.requestSaving || !draft.requestName.trim() || !draft.requestPhone.trim()
                  }
                  onClick={() => void submitApprovalRequest()}
                >
                  {draft.requestSaving
                    ? t("appForm.buttons.submissionRequest.sending")
                    : t("appForm.buttons.submissionRequest.sendButton")}
                </Button>
                <Button variant="secondary" onClick={() => set({ showSubmissionRequest: false })}>
                  {t("appForm.buttons.submissionRequest.cancel")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}
