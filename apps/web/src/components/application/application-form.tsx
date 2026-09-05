import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Clock3, Copy, FileSearch, House, KeyRound, RotateCcw, ShieldCheck, ShieldX, UserPlus, TriangleAlert, CalendarIcon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { LocationStep } from "./location-step";
import { CategoryStep } from "./category-step";
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO, SECTION_COLORS } from "@/lib/color-classes";
import {
  applyLocationChange,
  emptyDraft,
  normalizeDraft,
  reconcileCapturedLocations,
  useApplicationStore,
  type ApplicationDraft,
  type CategoryApplication,
  type CategoryType,
} from "@/lib/application-store";
import { G1_DOB_CUTOFF, getNextStepReason } from "@/lib/eligibility";
import { ADMISSION_RESTRICTIONS } from "@/lib/school-config";
import { scoreCategory } from "@/lib/scoring";
import { client } from "@/utils/orpc";
import { useTranslation } from "@/lib/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@aloysius-g1/ui/components/alert-dialog";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@aloysius-g1/ui/components/card";
import { Badge } from "@aloysius-g1/ui/components/badge";
import { Button } from "@aloysius-g1/ui/components/button";
import { Input } from "@aloysius-g1/ui/components/input";
import { Checkbox } from "@aloysius-g1/ui/components/checkbox";
import { Calendar } from "@aloysius-g1/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@aloysius-g1/ui/components/popover";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@aloysius-g1/ui/components/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@aloysius-g1/ui/components/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@aloysius-g1/ui/components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@aloysius-g1/ui/components/drawer";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@aloysius-g1/ui/components/field";
import { AccessKeyQrImporter } from "@/components/application/access-key-qr";
import { PhoneInput } from "@/components/application/phone-input";
import { DISTRICTS, DIVISIONAL_SECRETARIATS, ELECTORAL_CONSTITUENCIES, GN_DIVISIONS } from "@/lib/divisions";
import {
  applicantStepSchema,
  guardianStepSchema,
  residenceStepSchema,
  declarationStepSchema,
} from "@/lib/validation";

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
  const parts: string[] = [];  if (inputs.mainDocumentType) parts.push(`Main document: ${inputs.mainDocumentType}`);
  if (inputs.difficultServiceType) parts.push(`Difficult service: ${inputs.difficultServiceType}`);
  if (inputs.employmentPurpose) parts.push(`Employment purpose: ${inputs.employmentPurpose}`);
  if (inputs.abroadStartDate && inputs.abroadEndDate) {
    const days = Math.round(Math.abs(new Date(inputs.abroadEndDate).getTime() - new Date(inputs.abroadStartDate).getTime()) / 86400000);
    parts.push(`Period abroad: ~${Math.round(days / 365)} years`);
  }
  if (inputs.residenceToSchoolKm != null) parts.push(`Residence to school: ${inputs.residenceToSchoolKm} km`);
  if (inputs.workplaceToSchoolKm != null) parts.push(`Workplace to school: ${inputs.workplaceToSchoolKm} km`);
  if (inputs.previousWorkplaceDistanceKm != null)
    parts.push(`Previous workplace: ${inputs.previousWorkplaceDistanceKm} km`);
  if (inputs.alumniStartDate && inputs.alumniEndDate) {
    const days = Math.round(Math.abs(new Date(inputs.alumniEndDate).getTime() - new Date(inputs.alumniStartDate).getTime()) / 86400000);
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
  if (inputs.sportsLevel) parts.push(`Sports level: ${inputs.sportsLevel}${inputs.sportsCount != null ? ` ×${inputs.sportsCount}` : ""}`);
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
}: {
  current: number;
  maxVisited: number;
  steps: string[];
  onStepClick: (index: number) => void;
}) {
  const { t } = useTranslation();
  const progress = Math.round((current / (stepLabels.length - 1)) * 100);
  return (
    <>
      <CardHeader className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            {t("appForm.stepIndicator.stepOf", { current: current + 1, total: stepLabels.length })}
          </p>
          <h2 className="font-heading text-2xl">{stepLabels[current]}</h2>
        </div>
        <span className="text-sm text-muted-foreground">{t("appForm.stepIndicator.percentComplete", { percent: progress })}</span>
      </CardHeader>
      <div className="h-1 bg-secondary">
        <div
          className="h-full bg-primary transition-[width] duration-350 ease-in-out"
          style={{ width: `${Math.max(progress, 8)}%` }}
        />
      </div>
      <nav
        className="flex gap-1 overflow-x-auto border-b px-5 py-3 md:px-8"
        aria-label={t("appForm.stepIndicator.ariaLabel")}
      >
        {stepLabels.map((step, index) => {
          const isCurrent = index === current;
          const isCompleted = index < maxVisited;
          const canNavigate = index <= maxVisited;
          return (
            <button
              type="button"
              key={step}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap bg-transparent px-2.5 py-2 text-xs transition-colors ${
                isCurrent
                  ? "font-bold text-foreground"
                  : isCompleted
                    ? "text-foreground/80 hover:text-foreground"
                    : canNavigate
                      ? "text-muted-foreground hover:text-foreground"
                      : "text-muted-foreground/60 cursor-not-allowed"
              }`}
              onClick={() => canNavigate && onStepClick(index)}
              disabled={!canNavigate}
            >
              <span
                className={`grid size-6 place-items-center rounded-full border text-[11px] transition-colors ${
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCompleted
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border"
                }`}
              >
                {isCompleted && !isCurrent ? <Check size={14} /> : index + 1}
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
}: {
  draft: ApplicationDraft;
  set: (patch: Partial<ApplicationDraft>) => void;
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
    const watcher = window.setInterval(
      () => void check(watchedValue, false),
      3000,
    );
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

  return (
    <Field>
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
            });
            scheduleCheck(e.target.value);
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title={t("appForm.birthCert.refreshTitle")}
          onClick={() => void check(draft.applicant.birthCertificateNumber, false)}
        >
          <RotateCcw size={14} /> {t("appForm.birthCert.refresh")}
        </Button>
      </div>
      <Drawer open={draft.bcDialogOpen} onOpenChange={(open) => set({ bcDialogOpen: open })}>
        {draft.duplicateBirthCertificate && (
          <DrawerTrigger className="border-0 bg-transparent p-0 text-destructive text-sm underline w-fit">
            {t("appForm.birthCert.duplicateLink")}
          </DrawerTrigger>
        )}
        <DrawerContent className="p-6">
          <DrawerHeader>
            <DrawerTitle>{t("appForm.birthCert.duplicateTitle")}</DrawerTitle>
            <DrawerDescription>
              {t("appForm.birthCert.duplicateDescription")}
            </DrawerDescription>
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
}: {
  draft: ApplicationDraft;
  readOnly: boolean;
  set: (patch: Partial<ApplicationDraft>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4">
      <div className="mb-4">
        <h3 className="font-heading text-xl sm:text-2xl">{t("appForm.locationStep.heading")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("appForm.locationStep.description")}
        </p>
      </div>
      <LocationStep
        readOnly={readOnly}
        autoRequestLocation={
          !readOnly &&
          draft.location?.latitude == null &&
          draft.selectedLocation?.latitude == null
        }
        value={draft.location ?? emptyDraft.location}
        defaultValue={draft.defaultLocations[0] ?? emptyDraft.location}
        deviceLocationHistory={draft.deviceLocationHistory ?? []}
        userLocationHistory={draft.userLocationHistory ?? []}
        onAvailabilityChange={(canProceed) => set({ locationCanProceed: canProceed })}
        onChange={(value, defaultValue) => {
          if (readOnly) return;
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
  );
}

function DateOfBirthPicker({ value, onChange }: { value: string; onChange: (dateStr: string) => void }) {
  const [open, setOpen] = useState(false);
  const parsedDate = value ? new Date(value + "T00:00:00") : undefined;
  const maxDate = new Date(G1_DOB_CUTOFF() + "T00:00:00");

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
          defaultMonth={parsedDate}
          captionLayout="dropdown"
          disabled={(date) => date > maxDate}
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
}: {
  draft: ApplicationDraft;
  set: (patch: Partial<ApplicationDraft>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <div className="col-span-full mb-4">
        <h3 className="font-heading text-xl sm:text-2xl">{t("appForm.applicantStep.heading")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("appForm.applicantStep.description")}
        </p>
      </div>

      <Field>
        <FieldLabel htmlFor="applicant.fullName">{t("appForm.applicantStep.fullNameEn")}</FieldLabel>
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

      <Field>
        <FieldLabel htmlFor="applicant.gender">{t("appForm.applicantStep.gender")}</FieldLabel>
        <Select
          value={draft.applicant.gender || ""}
          onValueChange={(value) => set({ applicant: { ...draft.applicant, gender: value ?? "" } })}
        >
          <SelectTrigger
            id="applicant.gender"
            className="w-full"
          >
            <SelectValue placeholder={t("appForm.applicantStep.genderPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Female">{t("appForm.applicantStep.gender.female")}</SelectItem>
            <SelectItem value="Male">{t("appForm.applicantStep.gender.male")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {draft.applicant.gender === "Female" && (
        <p className="col-span-full text-sm text-destructive">
          {ADMISSION_RESTRICTIONS.restrictGenderMessage || t("appForm.applicantStep.genderRestriction")}
        </p>
      )}

      <Field>
        <FieldLabel htmlFor="applicant.religion">{t("appForm.applicantStep.religion")}</FieldLabel>
        <Select
          value={draft.applicant.religion || ""}
          onValueChange={(value) => set({ applicant: { ...draft.applicant, religion: value ?? "" } })}
        >
          <SelectTrigger
            id="applicant.religion"
            className="w-full"
          >
            <SelectValue placeholder={t("appForm.applicantStep.religionPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Catholic">{t("appForm.applicantStep.religion.catholic")}</SelectItem>
            <SelectItem value="Christian">{t("appForm.applicantStep.religion.christian")}</SelectItem>
            <SelectItem value="Buddhist">{t("appForm.applicantStep.religion.buddhist")}</SelectItem>
            <SelectItem value="Islam">{t("appForm.applicantStep.religion.islam")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {draft.applicant.religion === "Christian" && (
        <p className="col-span-full text-sm text-destructive">
          {ADMISSION_RESTRICTIONS.restrictReligionMessage || t("appForm.applicantStep.religionRestriction")}
        </p>
      )}

      <Field>
        <FieldLabel htmlFor="applicant.educationMedium">
          {t("appForm.applicantStep.educationMedium")}
        </FieldLabel>
        <Select
          value={draft.applicant.educationMedium || ""}
          onValueChange={(value) => set({ applicant: { ...draft.applicant, educationMedium: value ?? "" } })}
        >
          <SelectTrigger
            id="applicant.educationMedium"
            className="w-full"
          >
            <SelectValue placeholder={t("appForm.applicantStep.educationMediumPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Sinhala">{t("appForm.applicantStep.educationMedium.sinhala")}</SelectItem>
            <SelectItem value="Tamil">{t("appForm.applicantStep.educationMedium.tamil")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {draft.applicant.educationMedium === "Tamil" && ADMISSION_RESTRICTIONS.allowedEducationMediums.length > 0 && !ADMISSION_RESTRICTIONS.allowedEducationMediums.includes(draft.applicant.educationMedium) && (
        <p className="col-span-full text-sm text-destructive">
          {ADMISSION_RESTRICTIONS.restrictMediumMessage || t("appForm.applicantStep.mediumRestriction")}
        </p>
      )}

      <Field>
        <FieldLabel htmlFor="applicant.dateOfBirth">
          {t("appForm.applicantStep.dateOfBirth")}
        </FieldLabel>
        <DateOfBirthPicker
          value={draft.applicant.dateOfBirth}
          onChange={(dateStr) => set({ applicant: { ...draft.applicant, dateOfBirth: dateStr } })}
        />
        <FieldDescription>
          {t("appForm.applicantStep.dateOfBirthDescription")}
        </FieldDescription>
      </Field>

      <div className="col-span-full">
        <BirthCertificateField draft={draft} set={set} />
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
  const nicValue = String(draft.guardian.nic || "").trim().toUpperCase();
  const nicValid =
    !nicValue || /^\d{12}$/.test(nicValue) || /^\d{9}[VX]$/.test(nicValue);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <div className="col-span-full mb-4">
        <h3 className="font-heading text-xl sm:text-2xl">{t("appForm.guardianStep.heading")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("appForm.guardianStep.description")}
        </p>
      </div>

      <Field>
        <FieldLabel htmlFor="guardian.relationship">
          {t("appForm.guardianStep.relationship")}
        </FieldLabel>
        <Select
          value={draft.guardian.relationship || ""}
          onValueChange={(value) => set({ guardian: { ...draft.guardian, relationship: value ?? "" } })}
        >
          <SelectTrigger
            id="guardian.relationship"
            className="w-full"
          >
            <SelectValue placeholder={t("appForm.guardianStep.relationshipPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Mother">{t("appForm.guardianStep.relationship.mother")}</SelectItem>
            <SelectItem value="Father">{t("appForm.guardianStep.relationship.father")}</SelectItem>
            <SelectItem value="Guardian">{t("appForm.guardianStep.relationship.guardian")}</SelectItem>
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
        <FieldLabel htmlFor="guardian.sinhalaName">{t("appForm.guardianStep.fullNameSi")}</FieldLabel>
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

      <Field>
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
          <p className="text-sm text-destructive">
            {t("appForm.guardianStep.nicError")}
          </p>
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
    (d) =>
      d.en === draft.residence.district || d.id === draft.residence.district,
  );
  const selectedDs = DIVISIONAL_SECRETARIATS.find(
    (d) =>
      d.en === draft.residence.dsDivision ||
      d.id === draft.residence.dsDivision,
  );

  const districtOptions = DISTRICTS.map((d) => d.en);
  const dsOptions = DIVISIONAL_SECRETARIATS.filter(
    (d) => !selectedDistrict || d.districtId === selectedDistrict.id,
  ).map((d) => d.en);
  const gnOptions = GN_DIVISIONS.filter(
    (d) => !selectedDs || d.dsId === selectedDs.id,
  ).map((d) => d.en);
  const electoralOptions = ELECTORAL_CONSTITUENCIES.map((c) => c.en);

  const setResidence = (residence: Partial<ApplicationDraft["residence"]>) =>
    set({ residence: { ...draft.residence, ...residence } } as Partial<ApplicationDraft>);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <div className="col-span-full mb-4">
        <h3 className="font-heading text-xl sm:text-2xl">{t("appForm.residenceStep.heading")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("appForm.residenceStep.description")}
        </p>
      </div>

      <Field>
        <FieldLabel htmlFor="residence.permanentAddress">
          {t("appForm.residenceStep.permanentAddress")}
        </FieldLabel>
        <Input
          id="residence.permanentAddress"
          value={draft.residence.permanentAddress}
          placeholder={t("appForm.residenceStep.permanentAddressPlaceholder")}
          onChange={(e) => setResidence({ permanentAddress: e.target.value })}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="residence.currentAddress">
          {t("appForm.residenceStep.currentAddress")}
        </FieldLabel>
        <Input
          id="residence.currentAddress"
          value={draft.residence.currentAddress}
          placeholder={t("appForm.residenceStep.currentAddressPlaceholder")}
          disabled={sameAsPermanent}
          onChange={(e) => setResidence({ currentAddress: e.target.value })}
        />
      </Field>

      <div className="col-span-full">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            className="size-5"
            checked={sameAsPermanent}
            onCheckedChange={(checked) => {
              const c = checked === true;
              setResidence({
                sameAsPermanent: c,
                currentAddress: c ? draft.residence.permanentAddress : draft.residence.currentAddress,
              });
            }}
          />
          {t("appForm.residenceStep.sameAsPermanent")}
        </label>
      </div>

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
          onValueChange={(val) => {
            if (val) {
              setResidence({ dsDivision: val, dsSearch: val, gnDivision: "" });
            } else {
              setResidence({ dsDivision: "", dsSearch: "", gnDivision: "" });
            }
          }}
        >
          <ComboboxInput placeholder={t("appForm.residenceStep.dsDivisionPlaceholder")} />
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
      </Field>

      <Field>
        <FieldLabel htmlFor="residence.gnDivision">
          {t("appForm.residenceStep.gnDivision")}
        </FieldLabel>
        <Combobox
          items={gnOptions}
          value={draft.residence.gnDivision || ""}
          onValueChange={(val) => {
            if (val) {
              setResidence({ gnDivision: val, gnSearch: val });
            } else {
              setResidence({ gnDivision: "", gnSearch: "" });
            }
          }}
        >
          <ComboboxInput placeholder={t("appForm.residenceStep.gnDivisionPlaceholder")} />
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
  return (
    <div className="grid max-w-[920px] gap-5">
      <div className="mb-4">
        <h3 className="font-heading text-xl sm:text-2xl">{t("appForm.declarationStep.heading")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("appForm.declarationStep.description")}
        </p>
      </div>

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
        [t("appForm.reviewStep.fields.permanentAddress"), draft.location.address || t("appForm.reviewStep.status.notCompleted")],
      ] as [string, string][],
    },
    {
      title: t("appForm.reviewStep.applicantDetails"),
      step: 1,
      fields: [
        [t("appForm.reviewStep.fields.fullName"), draft.applicant.fullName || t("appForm.reviewStep.status.notCompleted")],
        [t("appForm.reviewStep.fields.fullNameSi"), draft.applicant.sinhalaName || t("appForm.reviewStep.status.notCompleted")],
        [t("appForm.reviewStep.fields.gender"), draft.applicant.gender || t("appForm.reviewStep.status.notSelected")],
        [t("appForm.reviewStep.fields.religion"), draft.applicant.religion || t("appForm.reviewStep.status.notSelected")],
        [t("appForm.reviewStep.fields.educationMedium"), draft.applicant.educationMedium || t("appForm.reviewStep.status.notSelected")],
        [t("appForm.reviewStep.fields.dateOfBirth"), draft.applicant.dateOfBirth || t("appForm.reviewStep.status.notCompleted")],
        [t("appForm.reviewStep.fields.birthCert"), draft.applicant.birthCertificateNumber || t("appForm.reviewStep.status.notCompleted")],
      ] as [string, string][],
    },
    {
      title: t("appForm.reviewStep.parentGuardian"),
      step: 2,
      fields: [
        [t("appForm.reviewStep.fields.relationship"), draft.guardian.relationship || t("appForm.reviewStep.status.notSelected")],
        [t("appForm.reviewStep.fields.guardianName"), draft.guardian.fullName || t("appForm.reviewStep.status.notCompleted")],
        [t("appForm.reviewStep.fields.guardianNameSi"), draft.guardian.sinhalaName || t("appForm.reviewStep.status.notCompleted")],
        [t("appForm.reviewStep.fields.guardianNic"), draft.guardian.nic || t("appForm.reviewStep.status.notCompleted")],
        [t("appForm.reviewStep.fields.phone"), draft.guardian.phone || t("appForm.reviewStep.status.notCompleted")],
        [t("appForm.reviewStep.fields.guardianEmail"), draft.guardian.email || t("appForm.reviewStep.status.notCompleted")],
      ] as [string, string][],
    },
    {
      title: t("appForm.reviewStep.residence"),
      step: 3,
      fields: [
        [t("appForm.reviewStep.fields.permanentAddress"), draft.residence.permanentAddress || t("appForm.reviewStep.status.notCompleted")],
        [t("appForm.reviewStep.fields.currentAddress"), draft.residence.currentAddress || t("appForm.reviewStep.status.notCompleted")],
        [t("appForm.reviewStep.fields.district"), draft.residence.district || t("appForm.reviewStep.status.notSelected")],
        [t("appForm.reviewStep.fields.dsDivision"), draft.residence.dsDivision || t("appForm.reviewStep.status.notSelected")],
        [t("appForm.reviewStep.fields.gnDivision"), draft.residence.gnDivision || t("appForm.reviewStep.status.notSelected")],
        [t("appForm.reviewStep.fields.electoralDistrict"), draft.residence.electoralDistrict || t("appForm.reviewStep.status.notSelected")],
      ] as [string, string][],
    },
  ];

  const categoryRows: [string, string][] =
    draft.categories.length > 0
      ? draft.categories.map(
          (category): [string, string] => [
            categoryLabels[category.categoryType],
            categorySummary(category),
          ],
        )
      : [[t("appForm.reviewStep.status.noneSelected"), ""]];

  return (
    <div className="">
      <div className="mb-5">
        <h3 className="font-heading text-xl sm:text-2xl">{t("appForm.reviewStep.heading")}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("appForm.reviewStep.description")}
        </p>
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
                  <span className="text-sm font-medium text-right text-foreground truncate">{value || t("appForm.reviewStep.none")}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-foreground">{t("appForm.reviewStep.categories")}</h4>
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
                <h4 className="text-sm font-medium text-foreground">{t("appForm.reviewStep.admissionReview")}</h4>
              </div>
              <div className="flex items-center gap-2">
                {draft.isBanned ? (
                  <Badge variant="destructive" className="text-xs px-2.5 py-0.5">{t("appForm.reviewStep.badge.banned")}</Badge>
                ) : draft.admissionStatus === "verified" ? (
                  <Badge variant="default" className={`${STATUS_SUCCESS.badgeBg} ${STATUS_SUCCESS.badgeHover} text-xs px-2.5 py-0.5`}>{t("appForm.reviewStep.badge.verified")}</Badge>
                ) : draft.admissionStatus === "fake" ? (
                  <Badge variant="destructive" className="text-xs px-2.5 py-0.5">{t("appForm.reviewStep.badge.flagged")}</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs px-2.5 py-0.5">{t("appForm.reviewStep.badge.pendingReview")}</Badge>
                )}
              </div>
            </div>
            <div className="grid gap-3 p-4">
              {draft.isBanned && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <div className="flex items-center gap-2 font-semibold mb-1"><ShieldX size={15} /> {t("appForm.reviewStep.banned.heading")}</div>
                  <p>{draft.banReason || t("appForm.reviewStep.banned.noReason")}</p>
                </div>
              )}

              {draft.admissionStatus === "verified" && (
                <div className={`rounded-lg border ${STATUS_SUCCESS.borderStrong} ${STATUS_SUCCESS.bgSoft} p-3 text-sm ${STATUS_SUCCESS.textStrong}`}>
                  <div className="flex items-center gap-2 font-semibold"><Check size={15} /> {t("appForm.reviewStep.verified.heading")}</div>
                </div>
              )}

              {draft.admissionStatus === "fake" && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <div className="flex items-center gap-2 font-semibold"><TriangleAlert size={15} /> {t("appForm.reviewStep.flagged.heading")}</div>
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
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("appForm.reviewStep.adminNotes")}</span>
                  <p className="text-sm whitespace-pre-wrap text-foreground">{draft.interviewNotes}</p>
                </div>
              )}

              {draft.interviewEdits && draft.interviewEdits.length > 0 && (
                <div className="grid gap-2 rounded-lg border border-border bg-card p-3">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    {t("appForm.reviewStep.changesByAdmin", { count: draft.interviewEdits.length })}
                  </span>
                  <div className="grid gap-1.5 max-h-48 overflow-y-auto">
                    {draft.interviewEdits.map((edit, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2 text-xs border-b border-border/40 pb-1 last:border-b-0 last:pb-0">
                        <strong className="text-foreground">{edit.label}:</strong>
                        <span className="line-through text-muted-foreground">{edit.previousValue || t("appForm.reviewStep.emptyValue")}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-semibold text-foreground">{edit.newValue || t("appForm.reviewStep.emptyValue")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
              <h4 className="text-sm font-medium text-foreground">{t("appForm.reviewStep.markAllocation")}</h4>
              {adminMarks.length === 0 && (
                <Badge variant="secondary" className="text-xs px-2.5 py-0.5">{t("appForm.reviewStep.adminMarksPending")}</Badge>
              )}
            </div>
            <div className="p-4">
              {draft.categories.length > 0 ? (
                <div className="grid gap-2">
                  {draft.categories.map((category) => {
                    const autoScore = scoreCategory(category);
                    const adminMark = adminMarks.find((m) => m.categoryType === category.categoryType);
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
                              {t("appForm.reviewStep.indicative")}: <strong className="tabular-nums">{autoScore.total}</strong>
                            </span>
                            {adminMark != null && (
                              <span className="text-primary font-semibold">
                                {t("appForm.reviewStep.adminMarks")}: <strong className="tabular-nums">{adminMark.total}</strong>
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
                          {draft.categories.reduce(
                            (sum, c) => sum + scoreCategory(c).total,
                            0,
                          )}
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
}: {
  adminApplicationId?: string;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const draft = useApplicationStore();
  const saveQueue = useRef(Promise.resolve());
  const restorePromise = useRef<Promise<void> | null>(null);
  const navigate = useNavigate();

  const set = (patch: Partial<ApplicationDraft>) => draft.updateDraft(patch);

  const collectionOnly = draft.submissionLocked && draft.submittedAt !== null;

  const marksQuery = useQuery({
    queryKey: ["application-marks", draft.accessKey],
    queryFn: () => client.application.getMarks({ accessKey: draft.accessKey }),
    enabled: Boolean(draft.accessKey && draft.submittedAt),
    staleTime: 60_000,
  });
  const adminMarks = marksQuery.data ?? [];

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const key =
        new URLSearchParams(window.location.search).get("key") ??
        localStorage.getItem("aloysius-g1-application-key") ??
        "";
      const code =
        new URLSearchParams(window.location.search).get("code") ??
        localStorage.getItem("aloysius-g1-application-session-code") ??
        "";
      if (key || code) set({ accessKey: key, sessionCode: code });
      let dataLoaded = false;
      try {
        if (adminApplicationId) {
          const result = await client.admin.application.get({
            id: adminApplicationId,
          });
          if (!cancelled) {
            const latest = normalizeDraft(
              result.data as Partial<ApplicationDraft>,
            );
            set({ ...latest, submittedAt: result.submittedAt ? String(result.submittedAt) : null });
            dataLoaded = true;
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
            const restoredSessionCode =
              result.sessionCode ||
              new URLSearchParams(window.location.search).get("code") ||
              localStorage.getItem(
                "aloysius-g1-application-session-code",
              ) ||
              "";
            if (restoredSessionCode) {
              localStorage.setItem(
                "aloysius-g1-application-session-code",
                restoredSessionCode,
              );
            }
            const local = useApplicationStore.getState();
            const localHasData = Boolean(
              local.applicant.fullName ||
              local.applicant.birthCertificateNumber ||
              local.guardian.fullName ||
              local.residence.permanentAddress,
            );
            const serverHasData = Boolean(
              latest.applicant.fullName ||
              latest.applicant.birthCertificateNumber ||
              latest.guardian.fullName ||
              latest.residence.permanentAddress,
            );
            const merged: Partial<ApplicationDraft> = serverHasData || !localHasData ? latest : {};
            const loadedStep = merged.currentStep ?? 0;
            set({
              ...merged,
              accessKey: key || latest.accessKey || draft.accessKey,
              sessionCode: restoredSessionCode || draft.sessionCode,
              submittedAt: result.submittedAt ? String(result.submittedAt) : null,
              admissionStatus: latest.admissionStatus,
              interviewNotes: latest.interviewNotes,
              isBanned: latest.isBanned,
              banReason: latest.banReason,
              flags: latest.flags,
              maxVisitedStep: Math.max(useApplicationStore.getState().maxVisitedStep, loadedStep, loadedStep > 0 ? 6 : 0),
            });
            dataLoaded = true;
          }
        } else if (!adminApplicationId && !readOnly) {
          const result = await client.application.create({ data: {} });
          if (!cancelled) {
            localStorage.setItem(
              "aloysius-g1-application-key",
              result.accessKey,
            );
            const savedKeys = JSON.parse(
              localStorage.getItem("aloysius-g1-application-keys") ?? "[]",
            ) as unknown;
            localStorage.setItem(
              "aloysius-g1-application-keys",
              JSON.stringify([
                ...new Set([
                  ...(Array.isArray(savedKeys) ? savedKeys : []),
                  result.accessKey,
                ]),
              ]),
            );
            localStorage.setItem(
              "aloysius-g1-application-session-code",
              result.sessionCode,
            );
            window.history.replaceState(
              {},
              "",
              `/application?code=${encodeURIComponent(result.sessionCode)}&key=${encodeURIComponent(result.accessKey)}`,
            );
            const latest = normalizeDraft(
              result.data as Partial<ApplicationDraft>,
            );
            set({
              ...latest,
              accessKey: result.accessKey,
              sessionCode: result.sessionCode,
              submittedAt: null,
            });
            dataLoaded = true;
          }
        }
        try {
          const status = await client.application.status();
          if (!cancelled) {
            set({
              submissionLocked: status.submissionLocked,
              submissionOpensAt: status.submissionOpensAt,
              submissionClosesAt: status.submissionClosesAt,
            });
          }
        } catch {
          if (!cancelled) {
            set({ submissionLocked: true });
          }
        }
      } catch {
        if (!cancelled && !dataLoaded) {
          draft.reset();
          localStorage.removeItem("aloysius-g1-application-key");
          localStorage.removeItem("aloysius-g1-application-session-code");
          set({ accessKey: "", sessionCode: "", submissionLocked: true, submittedAt: null });
        }
      } finally {
        if (!cancelled) set({ hydrated: true });
      }
    };
    restorePromise.current = restore();
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore the browser-captured location from its sealed copy once hydration
  // settles. Only the applicant's own draft flow does this: admin/read-only and
  // already-submitted loads come from the server and must not be clobbered.
  useEffect(() => {
    if (!draft.hydrated || readOnly || Boolean(adminApplicationId) || draft.submittedAt) return;
    void reconcileCapturedLocations();
  }, [draft.hydrated, readOnly, adminApplicationId, draft.submittedAt]);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSavedSnapshot = useRef("");

  useEffect(() => {
    if (!draft.hydrated || !draft.accessKey) return;
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
  }, [draft.categories, draft.applicant, draft.guardian, draft.residence, draft.declaration, draft.currentStep, draft.hydrated, draft.accessKey, draft.submittedAt, draft.submissionLocked]);

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
            return { categoryType: cat.categoryType, total: score.total, breakdown: score.breakdown };
          });
          await client.application.saveIndicativeMarks({ accessKey: currentDraft.accessKey, marks }).catch(() => {});
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


  const next = async () => {
    if (nextDisabledReason) return;
    try {
      set({ submitError: "" });
      const nextStep = Math.min(current + 1, steps.length - 1);
      draft.setStep(nextStep);
      await saveToServer();
    } catch (error) {
      set({
        submitError:
          error instanceof Error
            ? error.message
            : t("appForm.buttons.submitError.couldNotSave"),
      });
      draft.setStep(current);
    }
  };

  const submitApplication = async () => {
    try {
      set({ isSubmitting: true, submitError: "" });
      if (restorePromise.current) await restorePromise.current;
      let accessKey = useApplicationStore.getState().accessKey;
      if (!accessKey && !adminApplicationId && !readOnly) {
        const result = await client.application.create({ data: normalizeDraft(useApplicationStore.getState()) });
        accessKey = result.accessKey;
        localStorage.setItem("aloysius-g1-application-key", result.accessKey);
        localStorage.setItem("aloysius-g1-application-session-code", result.sessionCode);
        set({ accessKey: result.accessKey, sessionCode: result.sessionCode });
      }
      await saveToServer(false);
      accessKey = useApplicationStore.getState().accessKey || accessKey;
      if (!accessKey) throw new Error(t("appForm.buttons.submitError.couldNotCreateDraft"));
      set({ saveStatus: t("appForm.statusBar.submitting") });
      await client.application.submit({ accessKey });
      set({ submittedAt: new Date().toISOString(), saveStatus: t("appForm.statusBar.submitted") });
    } catch (error) {
      set({ saveStatus: "" });
      if (error instanceof Error && error.message.includes("Submissions are outside the configured form window")) {
        set({ showSubmissionRequest: true });
      } else {
        set({
          submitError:
            error instanceof Error
              ? error.message
              : t("appForm.buttons.submitError.couldNotSubmit"),
        });
      }
    } finally {
      set({ isSubmitting: false });
    }
  };

  const submitApprovalRequest = async () => {
    try {
      set({ requestSaving: true });
      await client.application.requestAccess({ accessKey: draft.accessKey, applicantName: draft.requestName.trim(), contactPhone: draft.requestPhone.trim(), requestType: "submission" });
      set({ showSubmissionRequest: false, saveStatus: t("appForm.buttons.approvalRequestSent") });
    } catch (error) {
      set({ submitError: error instanceof Error ? error.message : t("appForm.buttons.approvalRequestError") });
    } finally {
      set({ requestSaving: false });
    }
  };

  const startAnotherApplication = () => {
    localStorage.removeItem("aloysius-g1-application-key");
    localStorage.removeItem("aloysius-g1-application-session-code");
    draft.reset();
    window.location.assign("/application");
  };

  const back = () => draft.setStep(Math.max(current - 1, 0));

  const copyWithFeedback = (label: string, value: string) => {
    void navigator.clipboard?.writeText(value).then(
      () => {
        set({ copiedField: label });
        setTimeout(() => set({ copiedField: null }), 2000);
      },
      () => undefined,
    );
  };

  if (!draft.hydrated)
    return (
      <div className="grid place-items-center min-h-[50vh] text-muted-foreground">
        {t("appForm.buttons.restoring")}
      </div>
    );

  const nextDisabledReason = getNextStepReason({
    step: current,
    locationCanProceed: draft.locationCanProceed,
    location: draft.location,
    duplicateBirthCertificate: draft.duplicateBirthCertificate,
    applicant: draft.applicant,
    guardian: draft.guardian,
    categories: draft.categories,
    declaration: draft.declaration,
  });
  const isNextDisabled = Boolean(nextDisabledReason);

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
            {(draft.sessionCode || draft.accessKey) && (
              <div className="mt-5 grid max-w-[900px] grid-cols-1 gap-3 sm:grid-cols-2">
                {draft.sessionCode && (
                  <div className="grid gap-2 p-4 rounded-[14px] border border-primary/25 bg-primary/5">
                    <div className="flex items-center justify-between gap-3 text-muted-foreground text-[0.76rem] font-bold tracking-wider uppercase">
                      <span>{t("appForm.sessionCode.label")}</span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 border-0 rounded-md px-1.5 py-1 text-primary bg-transparent text-[0.72rem] hover:bg-primary/10"
                        aria-label={t("appForm.sessionCode.copyAriaLabel")}
                        onClick={(e) => {
                          e.stopPropagation();
                          copyWithFeedback("session", draft.sessionCode);
                        }}
                      >
                        {draft.copiedField === "session" ? <><Check size={15} /> {t("appForm.sessionCode.copied")}</> : <><Copy size={15} /> {t("appForm.sessionCode.copy")}</>}
                      </button>
                    </div>
                    <code className="block overflow-wrap-anywhere text-[clamp(1rem,1.5vw,1.18rem)] font-bold tracking-wide">
                      {draft.sessionCode}
                    </code>
                    <span className="block rounded-lg bg-primary/11 px-2.5 py-2 text-primary text-[0.82rem] font-semibold leading-relaxed">
                      {t("appForm.sessionCode.hint")}
                    </span>
                  </div>
                )}
                {draft.accessKey && (
                  <div className="grid gap-2 p-4 rounded-[14px] border border-primary/25 bg-primary/5">
                    <div className="flex items-center justify-between gap-3 text-muted-foreground text-[0.76rem] font-bold tracking-wider uppercase">
                      <span>{t("appForm.accessKey.label")}</span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 border-0 rounded-md px-1.5 py-1 text-primary bg-transparent text-[0.72rem] hover:bg-primary/10"
                        aria-label={t("appForm.accessKey.copyAriaLabel")}
                        onClick={(e) => {
                          e.stopPropagation();
                          copyWithFeedback("key", draft.accessKey);
                        }}
                      >
                        {draft.copiedField === "key" ? <><Check size={15} /> {t("appForm.sessionCode.copied")}</> : <><Copy size={15} /> {t("appForm.sessionCode.copy")}</>}
                      </button>
                    </div>
                    <code className="block break-all text-[clamp(1rem,1.5vw,1.18rem)] font-bold tracking-wide">
                      {draft.accessKey}
                    </code>
                    <span className="block rounded-lg bg-primary/11 px-2.5 py-2 text-primary text-[0.82rem] font-semibold leading-relaxed">
                      {t("appForm.accessKey.hint")}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid gap-3 rounded-2xl border border-primary/20 bg-card/85 p-5 shadow-[0_14px_32px_color-mix(in_oklch,var(--foreground)_6%,transparent)]">
            <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              <span>{t("appForm.statusBar.applicationStatus")}</span>
              <ShieldCheck className="text-primary" size={17} />
            </div>
            <strong className="font-heading text-2xl">{t("appForm.statusBar.stepOf", { current: current + 1, total: steps.length })}</strong>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("appForm.statusBar.keepGoing")}
            </p>
            <div className="flex items-center gap-2 border-t pt-3 text-sm text-primary">
              <span className={`size-2 rounded-full ${draft.saveStatus === t("appForm.statusBar.saving") ? "animate-pulse" : ""} ${draft.saveStatus.includes("failed") ? "bg-destructive" : "bg-primary"}`} aria-hidden="true" />
              {draft.saveStatus === t("appForm.statusBar.savedSecurely")
                ? t("appForm.statusBar.saved")
                : draft.saveStatus || (draft.accessKey ? t("appForm.statusBar.connected") : t("appForm.statusBar.connecting"))}
            </div>
          </div>
        </div>
      </section>

      <Card className="mx-auto max-w-[1320px] overflow-hidden shadow-[0_20px_45px_color-mix(in_oklch,var(--foreground)_8%,transparent)]">
        <StepIndicator
          current={current}
          maxVisited={draft.maxVisitedStep}
          steps={steps}
          onStepClick={(index) => draft.setStep(index)}
        />

        <CardContent className="min-h-[440px] p-5 md:p-9">
          {current === 0 && (
            <LocationStepCard
              draft={draft}
              readOnly={readOnly}
              set={set}
            />
          )}
          {current === 1 && (
            <ApplicantStep
              draft={draft}
              set={set}
            />
          )}
          {current === 2 && <GuardianStep draft={draft} set={set} />}
          {current === 3 && (
            <ResidenceStep
              draft={draft}
              set={set}
            />
          )}
          {current === 4 && <CategoryStep />}
          {current === 5 && (
            <DeclarationStep draft={draft} set={set} />
          )}
          {current === 6 && (
            <ReviewStep
              draft={draft}
              onNavigateToStep={(step) => draft.setStep(step)}
            />
          )}
        </CardContent>

        <div className="flex flex-col items-stretch justify-between gap-4 border-t px-5 py-5 sm:flex-row sm:items-center md:px-8 md:py-6">
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
                    <div className={`flex size-11 shrink-0 items-center justify-center rounded-full ${STATUS_SUCCESS.bgSolid} text-white shadow-sm`}>
                      <Check size={23} strokeWidth={2.5} />
                    </div>
                    <div className="grid gap-2">
                      <span className={`text-xs font-bold uppercase tracking-[0.14em] ${SECTION_COLORS.success.label}`}>
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
                    <div className={`mt-4 grid gap-2 rounded-xl border ${STATUS_SUCCESS.border} ${STATUS_SUCCESS.bgSoft} p-4`}>
                      <span className={`text-xs font-bold uppercase tracking-wider ${STATUS_SUCCESS.text}`}>{t("appForm.submitted.categoryMarks")}</span>
                      <div className="grid gap-1.5">
                        {draft.categories.map((category) => {
                          const mark = adminMarks.find((m) => m.categoryType === category.categoryType);
                          if (!mark) return null;
                          return (
                            <div key={category.categoryType} className={`flex items-center justify-between text-sm py-1 border-b border-emerald-500/10 last:border-b-0`}>
                              <span className="text-foreground">{getCategoryLabels(t)[category.categoryType]}</span>
                              <span className={`font-semibold ${STATUS_SUCCESS.textStrong}`}>{mark.total}</span>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between text-sm font-semibold pt-1">
                          <span>{t("appForm.reviewStep.total")}</span>
                          <span className={`${STATUS_SUCCESS.textStrong}`}>{adminMarks.reduce((sum, m) => sum + m.total, 0)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {draft.flags && draft.flags.length > 0 && (
                    <div className={`mt-3 grid gap-2 rounded-xl border ${STATUS_WARNING.border} ${STATUS_WARNING.bgSoft} p-4`}>
                      <span className={`text-xs font-bold uppercase tracking-wider ${STATUS_WARNING.text}`}>{t("appForm.submitted.observations", { count: draft.flags.length })}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {draft.flags.map((f, i) => (
                          <Badge key={i} variant="outline" className={`border-amber-500/40 ${STATUS_WARNING.textStrong} text-xs`}>{f.label || f.key}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {draft.interviewNotes && (
                    <div className={`mt-3 rounded-xl border ${STATUS_SUCCESS.border} ${STATUS_SUCCESS.bgSoft} p-4`}>
                      <span className={`text-xs font-bold uppercase tracking-wider ${STATUS_SUCCESS.text}`}>{t("appForm.submitted.adminNote")}</span>
                      <p className="text-sm mt-1 text-foreground">{draft.interviewNotes}</p>
                    </div>
                  )}
                  {draft.interviewEdits && draft.interviewEdits.length > 0 && (
                    <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-50/20 p-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                        {t("appForm.submitted.changesByAdmin", { count: draft.interviewEdits.length })}
                      </span>
                      <div className="mt-2 grid gap-1 max-h-40 overflow-y-auto">
                        {draft.interviewEdits.map((edit, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-2 text-xs border-b border-blue-500/10 pb-1 last:border-b-0 last:pb-0">
                            <strong className="text-foreground">{edit.label}:</strong>
                            <span className="line-through text-muted-foreground">{edit.previousValue || t("appForm.reviewStep.emptyValue")}</span>
                            <span>→</span>
                            <span className="font-semibold text-primary">{edit.newValue || t("appForm.reviewStep.emptyValue")}</span>
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
                      <span className="text-xs font-bold uppercase tracking-wider text-destructive">{t("appForm.submitted.flaggedItems", { count: draft.flags.length })}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {draft.flags.map((f, i) => (
                          <Badge key={i} variant="destructive" className="text-xs">{f.label || f.key}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {adminMarks.length > 0 && (
                    <div className="mt-3 grid gap-2 rounded-xl border border-border bg-card p-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("appForm.submitted.categoryMarks")}</span>
                      <div className="grid gap-1.5">
                        {draft.categories.map((category) => {
                          const mark = adminMarks.find((m) => m.categoryType === category.categoryType);
                          if (!mark) return null;
                          return (
                            <div key={category.categoryType} className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-b-0">
                              <span className="text-foreground">{getCategoryLabels(t)[category.categoryType]}</span>
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
                      <span className="text-xs font-bold uppercase tracking-wider text-destructive">{t("appForm.submitted.adminNote")}</span>
                      <p className="text-sm mt-1 text-foreground">{draft.interviewNotes}</p>
                    </div>
                  )}
                  {draft.interviewEdits && draft.interviewEdits.length > 0 && (
                    <div className={`mt-3 rounded-xl border ${STATUS_INFO.border} ${STATUS_INFO.bg} p-4`}>
                      <span className={`text-xs font-bold uppercase tracking-wider ${STATUS_INFO.text} `}>
                        {t("appForm.submitted.changesByAdmin", { count: draft.interviewEdits.length })}
                      </span>
                      <div className="mt-2 grid gap-1 max-h-40 overflow-y-auto">
                        {draft.interviewEdits.map((edit, i) => (
                          <div key={i} className={`flex flex-wrap items-center gap-2 text-xs border-b border-blue-500/10 pb-1 last:border-b-0 last:pb-0`}>
                            <strong className="text-foreground">{edit.label}:</strong>
                            <span className="line-through text-muted-foreground">{edit.previousValue || t("appForm.reviewStep.emptyValue")}</span>
                            <span>→</span>
                            <span className="font-semibold text-primary">{edit.newValue || t("appForm.reviewStep.emptyValue")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : draft.submittedAt ? (
                <div className={`flex items-start gap-4 rounded-2xl border ${SECTION_COLORS.warning.card} p-5 sm:p-6`}>
                  <div className={`flex size-11 shrink-0 items-center justify-center rounded-full ${STATUS_WARNING.bgSolid} text-white shadow-sm`}>
                    <FileSearch size={22} strokeWidth={2.5} />
                  </div>
                  <div className="grid gap-2">
                    <span className={`text-xs font-bold uppercase tracking-[0.14em] ${SECTION_COLORS.warning.label}`}>
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
                <section className="grid gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:p-6" aria-labelledby="submitted-access-key-heading">
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid gap-1">
                      <div className="flex items-center gap-2 text-primary">
                        <KeyRound size={18} />
                        <h2 id="submitted-access-key-heading" className="text-base font-semibold text-foreground">
                          {t("appForm.submitted.yourAccessKey")}
                        </h2>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {t("appForm.submitted.accessKeyDescription")}
                      </p>
                    </div>
                    <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={19} aria-hidden="true" />
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
                    {draft.copiedField === "keycard" ? <><Check size={16} /> {t("appForm.submitted.copied")}</> : <><Copy size={16} /> {t("appForm.submitted.copyKey")}</>}
                  </Button>
                </section>

                <aside className="grid content-start gap-4 rounded-2xl border border-border bg-muted/20 p-5 sm:p-6" aria-labelledby="submitted-next-steps-heading">
                  <div className="grid gap-1">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("appForm.submitted.nextSteps.badge")}</span>
                    <h2 id="submitted-next-steps-heading" className="font-heading text-xl">{t("appForm.submitted.nextSteps.title")}</h2>
                  </div>
                  <ol className="grid gap-3 text-sm">
                    <li className="flex items-start gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">1</span>
                      <span className="leading-relaxed text-muted-foreground">{t("appForm.submitted.nextSteps.step1")}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">2</span>
                      <span className="leading-relaxed text-muted-foreground">{t("appForm.submitted.nextSteps.step2")}</span>
                    </li>
                  </ol>
                </aside>
              </div>

              <div className="flex flex-wrap gap-3 border-t pt-5">
                <Button type="button" variant="secondary" onClick={() => void navigate({ to: "/" })}>
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
              <div className="ml-auto flex gap-3">
                {current > 0 && (
                  <Button variant="secondary" onClick={back}>
                    <ArrowLeft size={17} /> {t("appForm.buttons.back")}
                  </Button>
                )}
                {current < steps.length - 1 ? (
                  <Button
                    disabled={isNextDisabled}
                    onClick={next}
                  >
                    {t("appForm.buttons.continue")} <ArrowRight size={17} />
                  </Button>
                ) : (
                  <Button
                    disabled={
                      draft.isSubmitting ||
                      collectionOnly ||
                      !draft.declaration.confirmed ||
                      !draft.declaration.consent
                    }
                    aria-label={collectionOnly ? t("appForm.buttons.collectionOnlyAriaLabel") : undefined}
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

        {nextDisabledReason && current < steps.length - 1 && (
          <div className="flex items-center gap-2 px-(--card-spacing) py-2 text-sm text-muted-foreground border-t">
            <span>{nextDisabledReason}</span>
          </div>
        )}

        {current === steps.length - 1 && !collectionOnly && !draft.isSubmitting && (() => {
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
            <AlertDialog open={draft.clearDraftDialogOpen} onOpenChange={(open) => set({ clearDraftDialogOpen: open })}>
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
                  <AlertDialogCancel>{t("appForm.buttons.clearDraftDialog.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => {
                      localStorage.removeItem("aloysius-g1-application-key");
                      localStorage.removeItem("aloysius-g1-application-session-code");
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
                  disabled={draft.requestSaving || !draft.requestName.trim() || !draft.requestPhone.trim()}
                  onClick={() => void submitApprovalRequest()}
                >
                  {draft.requestSaving ? t("appForm.buttons.submissionRequest.sending") : t("appForm.buttons.submissionRequest.sendButton")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => set({ showSubmissionRequest: false })}
                >
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
