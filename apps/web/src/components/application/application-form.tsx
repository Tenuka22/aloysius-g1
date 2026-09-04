import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Clock3, Copy, FileSearch, House, KeyRound, RotateCcw, ShieldCheck, ShieldX, UserPlus, TriangleAlert } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
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
import { scoreCategory } from "@/lib/scoring";
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

const steps = ["Location", "Applicant", "Parent / guardian", "Residence", "Categories", "Declaration", "Review"];

const CATEGORY_LABELS: Record<CategoryType, string> = {
  "6.1": "6.1 – Residence Verification & Proximity",
  "6.2": "6.2 – Alumni",
  "6.3": "6.3 – Siblings",
  "6.4": "6.4 – Period of Service & Distance",
  "6.5": "6.5 – Transfer Applications",
  "6.6": "6.6 – Foreign Employment",
};

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
  const progress = Math.round((current / (stepLabels.length - 1)) * 100);
  return (
    <>
      <CardHeader className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            Step {current + 1} of {stepLabels.length}
          </p>
          <h2 className="font-heading text-2xl">{stepLabels[current]}</h2>
        </div>
        <span className="text-sm text-muted-foreground">{progress}% complete</span>
      </CardHeader>
      <div className="h-1 bg-secondary">
        <div
          className="h-full bg-primary transition-[width] duration-350 ease-in-out"
          style={{ width: `${Math.max(progress, 8)}%` }}
        />
      </div>
      <nav
        className="flex gap-1 overflow-x-auto border-b px-5 py-3 md:px-8"
        aria-label="Form steps"
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
      set({ bcRequestState: "Sending removal request\u2026" });
      await client.application.requestAccess({
        birthCertificateNumber,
        applicantName: draft.bcApplicantName || draft.applicant.fullName,
        guardianName: draft.bcGuardianName || draft.guardian.fullName,
        contactPhone: draft.bcContactPhone || draft.guardian.phone,
        requestType: "removal",
      });
      set({
        bcRequestState:
          "Removal request sent. The school will review it and contact you before taking action.",
      });
    } catch (error) {
      set({
        bcRequestState:
          error instanceof Error ? error.message : "Could not send the request",
      });
    }
  };

  return (
    <Field>
      <FieldLabel htmlFor="applicant.birthCertificateNumber">
        Birth certificate number
      </FieldLabel>
      <div className="flex gap-2">
        <Input
          className={`flex-1 ${draft.duplicateBirthCertificate ? "border-destructive ring-destructive/20" : ""}`}
          id="applicant.birthCertificateNumber"
          name="applicant.birthCertificateNumber"
          value={draft.applicant.birthCertificateNumber}
          placeholder="Enter birth certificate number"
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
          title="Check this birth certificate number again"
          onClick={() => void check(draft.applicant.birthCertificateNumber, false)}
        >
          <RotateCcw size={14} /> Refresh
        </Button>
      </div>
      <Drawer open={draft.bcDialogOpen} onOpenChange={(open) => set({ bcDialogOpen: open })}>
        {draft.duplicateBirthCertificate && (
          <DrawerTrigger className="border-0 bg-transparent p-0 text-destructive text-sm underline w-fit">
            View existing application options
          </DrawerTrigger>
        )}
        <DrawerContent className="p-6">
          <DrawerHeader>
            <DrawerTitle>Existing application found</DrawerTitle>
            <DrawerDescription>
              An application already exists for this birth certificate
              number. Open the existing student profile instead of creating
              another record.
            </DrawerDescription>
          </DrawerHeader>
          <div className="grid gap-4">
            <section className="grid gap-2">
              <h3 className="text-base font-semibold">
                Ask the school to remove this record
              </h3>
              <p className="text-sm text-muted-foreground">
                Only the school can approve removal after checking the
                record and contacting the family.
              </p>
              <div className="grid gap-2">
                <Input
                  value={draft.bcApplicantName}
                  onChange={(e) => set({ bcApplicantName: e.target.value })}
                  placeholder="Applicant name"
                />
                <Input
                  value={draft.bcGuardianName}
                  onChange={(e) => set({ bcGuardianName: e.target.value })}
                  placeholder="Guardian name"
                />
                <PhoneInput
                  value={draft.bcContactPhone}
                  onChange={(value) => set({ bcContactPhone: value })}
                  placeholder="Contact phone number"
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
                  Request record removal
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
  return (
    <div className="grid gap-4">
      <div className="mb-4">
        <h3 className="font-heading text-2xl">Start with the home location</h3>
        <p className="text-sm text-muted-foreground">
          Your true browser location is saved first. You may then replace the
          selected application location with another point.
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

function ApplicantStep({
  draft,
  set,
}: {
  draft: ApplicationDraft;
  set: (patch: Partial<ApplicationDraft>) => void;
}) {
  return (
    <div className="grid  grid-cols-2 gap-5">
      <div className="col-span-2 mb-4">
        <h3 className="font-heading text-2xl">Tell us about the applicant</h3>
        <p className="text-sm text-muted-foreground">
          Use the name shown on the applicant&apos;s birth certificate.
        </p>
      </div>

      <Field>
        <FieldLabel htmlFor="applicant.fullName">Full name in English</FieldLabel>
        <Input
          id="applicant.fullName"
          value={draft.applicant.fullName}
          placeholder="Enter full name"
          onChange={(e) => set({ applicant: { ...draft.applicant, fullName: e.target.value } })}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="applicant.sinhalaName">
          Full name in Sinhala
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
          Need a Sinhala phonetic keyboard? Open Helakuru
        </a>
      </Field>

      <Field>
        <FieldLabel htmlFor="applicant.gender">Gender</FieldLabel>
        <Select
          value={draft.applicant.gender || ""}
          onValueChange={(value) => set({ applicant: { ...draft.applicant, gender: value ?? "" } })}
        >
          <SelectTrigger
            id="applicant.gender"
            className="w-full"
          >
            <SelectValue placeholder="Select gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Female">Female</SelectItem>
            <SelectItem value="Male">Male</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {draft.applicant.gender === "Female" && (
        <p className="col-span-2 text-sm text-destructive">
          This is a boys&apos; school, so female applicants cannot continue
          with this application.
        </p>
      )}

      <Field>
        <FieldLabel htmlFor="applicant.religion">Religion</FieldLabel>
        <Select
          value={draft.applicant.religion || ""}
          onValueChange={(value) => set({ applicant: { ...draft.applicant, religion: value ?? "" } })}
        >
          <SelectTrigger
            id="applicant.religion"
            className="w-full"
          >
            <SelectValue placeholder="Select religion" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Catholic">Catholic</SelectItem>
            <SelectItem value="Christian">Christian</SelectItem>
            <SelectItem value="Buddhist">Buddhist</SelectItem>
            <SelectItem value="Islam">Islam</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {draft.applicant.religion === "Christian" && (
        <p className="col-span-2 text-sm text-destructive">
          This intake is not available to Christian applicants.
        </p>
      )}

      <Field>
        <FieldLabel htmlFor="applicant.educationMedium">
          Education medium
        </FieldLabel>
        <Select
          value={draft.applicant.educationMedium || ""}
          onValueChange={(value) => set({ applicant: { ...draft.applicant, educationMedium: value ?? "" } })}
        >
          <SelectTrigger
            id="applicant.educationMedium"
            className="w-full"
          >
            <SelectValue placeholder="Select medium" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Sinhala">Sinhala</SelectItem>
            <SelectItem value="Tamil">Tamil</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="applicant.dateOfBirth">
          Date of birth
        </FieldLabel>
        <Input
          id="applicant.dateOfBirth"
          type="date"
          max={G1_DOB_CUTOFF()}
          value={draft.applicant.dateOfBirth}
          onChange={(e) => set({ applicant: { ...draft.applicant, dateOfBirth: e.target.value } })}
        />
        <FieldDescription>
          The child must be at least five years old by 31 January 2027.
        </FieldDescription>
      </Field>

      <div className="col-span-2">
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
  const nicValue = String(draft.guardian.nic || "").trim().toUpperCase();
  const nicValid =
    !nicValue || /^\d{12}$/.test(nicValue) || /^\d{9}[VX]$/.test(nicValue);

  return (
    <div className="grid  grid-cols-2 gap-5">
      <div className="col-span-2 mb-4">
        <h3 className="font-heading text-2xl">Parent or guardian details</h3>
        <p className="text-sm text-muted-foreground">
          We&apos;ll use these details only to contact the family about this
          intake.
        </p>
      </div>

      <Field>
        <FieldLabel htmlFor="guardian.relationship">
          Relationship to applicant
        </FieldLabel>
        <Select
          value={draft.guardian.relationship || ""}
          onValueChange={(value) => set({ guardian: { ...draft.guardian, relationship: value ?? "" } })}
        >
          <SelectTrigger
            id="guardian.relationship"
            className="w-full"
          >
            <SelectValue placeholder="Select relationship" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Mother">Mother</SelectItem>
            <SelectItem value="Father">Father</SelectItem>
            <SelectItem value="Guardian">Guardian</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="guardian.fullName">Full name in English</FieldLabel>
        <Input
          id="guardian.fullName"
          value={draft.guardian.fullName}
          onChange={(e) => set({ guardian: { ...draft.guardian, fullName: e.target.value } })}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="guardian.sinhalaName">Full name in Sinhala</FieldLabel>
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
          Need a Sinhala phonetic keyboard? Open Helakuru
        </a>
      </Field>

      <Field>
        <FieldLabel htmlFor="guardian.nic">NIC number</FieldLabel>
        <Input
          id="guardian.nic"
          value={draft.guardian.nic}
          placeholder="e.g. 123456789V or 200012345678"
          maxLength={12}
          autoCapitalize="characters"
          spellCheck={false}
          onChange={(e) =>
            set({ guardian: { ...draft.guardian, nic: e.target.value.toUpperCase() } })
          }
        />
        {!nicValid && (
          <p className="text-sm text-destructive">
            Enter a valid Sri Lankan NIC: 9 digits followed by V/X, or 12
            digits.
          </p>
        )}
      </Field>

      <Field>
        <FieldLabel htmlFor="guardian.phone">Phone number</FieldLabel>
        <PhoneInput
          value={draft.guardian.phone || ""}
          onChange={(value) => set({ guardian: { ...draft.guardian, phone: value } })}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="guardian.email">Email address</FieldLabel>
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
  const sameAsPermanent = draft.residence.sameAsPermanent;
  const districtSearch = draft.residence.districtSearch;
  const dsSearch = draft.residence.dsSearch;
  const gnSearch = draft.residence.gnSearch;
  const electoralSearch = draft.residence.electoralSearch;

  const normalize = (value: string) => value.trim().toLocaleLowerCase();
  const filterOptions = (values: string[], search: string) => {
    const query = normalize(search);
    return values
      .filter((value) => !query || normalize(value).includes(query))
      .slice(0, 12);
  };

  const selectedDistrict = DISTRICTS.find(
    (d) =>
      d.en === draft.residence.district || d.id === draft.residence.district,
  );
  const selectedDs = DIVISIONAL_SECRETARIATS.find(
    (d) =>
      d.en === draft.residence.dsDivision ||
      d.id === draft.residence.dsDivision,
  );

  const districtOptions = filterOptions(DISTRICTS.map((d) => d.en), districtSearch);
  const dsOptions = filterOptions(
    DIVISIONAL_SECRETARIATS.filter(
      (d) => !selectedDistrict || d.districtId === selectedDistrict.id,
    ).map((d) => d.en),
    dsSearch,
  );
  const gnOptions = filterOptions(
    GN_DIVISIONS.filter(
      (d) => !selectedDs || d.dsId === selectedDs.id,
    ).map((d) => d.en),
    gnSearch,
  );
  const electoralOptions = filterOptions(
    ELECTORAL_CONSTITUENCIES.map((c) => c.en),
    electoralSearch,
  );

  const setResidence = (residence: Partial<ApplicationDraft["residence"]>) =>
    set({ residence: { ...draft.residence, ...residence } } as Partial<ApplicationDraft>);

  return (
    <div className="grid  grid-cols-2 gap-5">
      <div className="col-span-2 mb-4">
        <h3 className="font-heading text-2xl">Where does the family live?</h3>
        <p className="text-sm text-muted-foreground">
          Provide the permanent residence first, then add current details if
          different. The circular requires residence to be supported by official
          documents and, where applicable, GN certification.
        </p>
      </div>

      <Field>
        <FieldLabel htmlFor="residence.permanentAddress">
          Permanent address
        </FieldLabel>
        <Input
          id="residence.permanentAddress"
          value={draft.residence.permanentAddress}
          placeholder="House number, street, town"
          onChange={(e) => setResidence({ permanentAddress: e.target.value })}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="residence.currentAddress">
          Current address
        </FieldLabel>
        <Input
          id="residence.currentAddress"
          value={draft.residence.currentAddress}
          placeholder="Current address"
          disabled={sameAsPermanent}
          onChange={(e) => setResidence({ currentAddress: e.target.value })}
        />
      </Field>

      <div className="col-span-2">
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
          Current address is the same as permanent address
        </label>
      </div>

      <Field>
        <FieldLabel htmlFor="residence.district">District</FieldLabel>
        <input
          id="residence.district"
          list="district-options"
          value={districtSearch}
          placeholder="Search district"
          onChange={(e) => {
            if (!e.target.value) {
              setResidence({ districtSearch: e.target.value, district: "", dsDivision: "", gnDivision: "" });
              return;
            }
            const match = districtOptions.find(
              (opt) => opt.toLowerCase() === e.target.value.toLowerCase(),
            );
            setResidence({
              districtSearch: e.target.value,
              ...(match ? { district: match, dsDivision: "", gnDivision: "" } : {}),
            });
          }}
          className="flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
        <datalist id="district-options">
          {districtOptions.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      </Field>

      <Field>
        <FieldLabel htmlFor="residence.dsDivision">
          Divisional Secretariat division
        </FieldLabel>
        <input
          id="residence.dsDivision"
          list="ds-options"
          value={dsSearch}
          placeholder="Search DS division"
          onChange={(e) => {
            const match = dsOptions.find(
              (opt) => opt.toLowerCase() === e.target.value.toLowerCase(),
            );
            setResidence({
              dsSearch: e.target.value,
              ...(match ? { dsDivision: match, gnDivision: "" } : {}),
            });
          }}
          className="flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
        <datalist id="ds-options">
          {dsOptions.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      </Field>

      <Field>
        <FieldLabel htmlFor="residence.gnDivision">
          Grama Niladhari division
        </FieldLabel>
        <input
          id="residence.gnDivision"
          list="gn-options"
          value={gnSearch}
          placeholder="Search GN division"
          onChange={(e) => {
            const match = gnOptions.find(
              (opt) => opt.toLowerCase() === e.target.value.toLowerCase(),
            );
            setResidence({ gnSearch: e.target.value, ...(match ? { gnDivision: match } : {}) });
          }}
          className="flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
        <datalist id="gn-options">
          {gnOptions.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      </Field>

      <Field>
        <FieldLabel htmlFor="residence.electoralDistrict">
          Electoral district
        </FieldLabel>
        <input
          id="residence.electoralDistrict"
          list="electoral-options"
          value={electoralSearch}
          placeholder="Search electoral district"
          onChange={(e) => {
            const match = electoralOptions.find(
              (opt) => opt.toLowerCase() === e.target.value.toLowerCase(),
            );
            setResidence({ electoralSearch: e.target.value, ...(match ? { electoralDistrict: match } : {}) });
          }}
          className="flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
        <datalist id="electoral-options">
          {electoralOptions.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
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
  return (
    <div className="grid max-w-[920px] gap-5">
      <div className="mb-4">
        <h3 className="font-heading text-2xl">Confirm before review</h3>
        <p className="text-sm text-muted-foreground">
          This is a collection draft. Nothing will be submitted while collection
          mode is active.
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
        I confirm that the information I provide is accurate to the best of my
        knowledge.
      </label>

      <label className="flex items-start gap-2 rounded-lg border p-4 text-sm">
        <Checkbox
          className="size-5 mt-0.5"
          checked={draft.declaration.consent}
          onCheckedChange={(checked) =>
            set({ declaration: { ...draft.declaration, consent: checked === true } })
          }
        />
        I consent to this information being used to prepare the Grade 1 2026 intake
        application.
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
  const marksQuery = useQuery({
    queryKey: ["application-marks", draft.accessKey],
    queryFn: () => client.application.getMarks({ accessKey: draft.accessKey }),
    enabled: Boolean(draft.accessKey),
    staleTime: 60_000,
  });
  const adminMarks = marksQuery.data ?? [];

  const groupedSections = [
    {
      title: "Location",
      step: 0,
      fields: [
        ["Address", draft.location.address || "Not selected"],
      ] as [string, string][],
    },
    {
      title: "Applicant details",
      step: 1,
      fields: [
        ["Full name in English", draft.applicant.fullName || "Not completed"],
        ["Full name in Sinhala", draft.applicant.sinhalaName || "Not completed"],
        ["Gender", draft.applicant.gender || "Not selected"],
        ["Religion", draft.applicant.religion || "Not selected"],
        ["Education medium", draft.applicant.educationMedium || "Not selected"],
        ["Date of birth", draft.applicant.dateOfBirth || "Not completed"],
        ["Birth certificate number", draft.applicant.birthCertificateNumber || "Not completed"],
      ] as [string, string][],
    },
    {
      title: "Parent / guardian",
      step: 2,
      fields: [
        ["Relationship", draft.guardian.relationship || "Not selected"],
        ["Guardian name", draft.guardian.fullName || "Not completed"],
        ["Guardian name in Sinhala", draft.guardian.sinhalaName || "Not completed"],
        ["Guardian NIC", draft.guardian.nic || "Not completed"],
        ["Phone number", draft.guardian.phone || "Not completed"],
        ["Guardian email", draft.guardian.email || "Not completed"],
      ] as [string, string][],
    },
    {
      title: "Residence",
      step: 3,
      fields: [
        ["Permanent address", draft.residence.permanentAddress || "Not completed"],
        ["Current address", draft.residence.currentAddress || "Not completed"],
        ["District", draft.residence.district || "Not selected"],
        ["Divisional Secretariat division", draft.residence.dsDivision || "Not selected"],
        ["Grama Niladhari division", draft.residence.gnDivision || "Not selected"],
        ["Electoral district", draft.residence.electoralDistrict || "Not selected"],
      ] as [string, string][],
    },
  ];

  const categoryRows: [string, string][] =
    draft.categories.length > 0
      ? draft.categories.map(
          (category): [string, string] => [
            CATEGORY_LABELS[category.categoryType],
            categorySummary(category),
          ],
        )
      : [["None selected", ""]];

  return (
    <div className="">
      <div className="mb-5">
        <h3 className="font-heading text-2xl">Review your draft</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Check all collected information before the application submission step
          becomes available.
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
                Edit
              </button>
            </div>
            <div className="divide-y">
              {section.fields.map(([label, value]) => (
                <div className="flex items-baseline justify-between gap-4 px-4 py-2.5" key={label}>
                  <span className="text-xs text-muted-foreground shrink-0">{label}</span>
                  <span className="text-sm font-medium text-right text-foreground truncate">{value || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-foreground">Categories</h4>
          <button
            type="button"
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            onClick={() => onNavigateToStep(4)}
          >
            Edit
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
                <h4 className="text-sm font-medium text-foreground">Admission review</h4>
              </div>
              <div className="flex items-center gap-2">
                {draft.isBanned ? (
                  <Badge variant="destructive" className="text-xs px-2.5 py-0.5">Banned</Badge>
                ) : draft.admissionStatus === "verified" ? (
                  <Badge variant="default" className={`${STATUS_SUCCESS.badgeBg} ${STATUS_SUCCESS.badgeHover} text-xs px-2.5 py-0.5`}>Verified</Badge>
                ) : draft.admissionStatus === "fake" ? (
                  <Badge variant="destructive" className="text-xs px-2.5 py-0.5">Flagged</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs px-2.5 py-0.5">Pending review</Badge>
                )}
              </div>
            </div>
            <div className="grid gap-3 p-4">
              {draft.isBanned && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <div className="flex items-center gap-2 font-semibold mb-1"><ShieldX size={15} /> Application Banned</div>
                  <p>{draft.banReason || "No specific reason provided."}</p>
                </div>
              )}

              {draft.admissionStatus === "verified" && (
                <div className={`rounded-lg border ${STATUS_SUCCESS.borderStrong} ${STATUS_SUCCESS.bgSoft} p-3 text-sm ${STATUS_SUCCESS.textStrong} ${STATUS_SUCCESS.textDark}`}>
                  <div className="flex items-center gap-2 font-semibold"><Check size={15} /> This application has been verified by an administrator.</div>
                </div>
              )}

              {draft.admissionStatus === "fake" && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <div className="flex items-center gap-2 font-semibold"><TriangleAlert size={15} /> This application has been flagged for review.</div>
                </div>
              )}

              {draft.flags && draft.flags.length > 0 && (
                <div className="grid gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <span className="text-xs font-semibold text-destructive uppercase tracking-wider">
                    Observations ({draft.flags.length})
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
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin Notes</span>
                  <p className="text-sm whitespace-pre-wrap text-foreground">{draft.interviewNotes}</p>
                </div>
              )}

              {draft.interviewEdits && draft.interviewEdits.length > 0 && (
                <div className="grid gap-2 rounded-lg border border-border bg-card p-3">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Changes made by admin ({draft.interviewEdits.length})
                  </span>
                  <div className="grid gap-1.5 max-h-48 overflow-y-auto">
                    {draft.interviewEdits.map((edit, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2 text-xs border-b border-border/40 pb-1 last:border-b-0 last:pb-0">
                        <strong className="text-foreground">{edit.label}:</strong>
                        <span className="line-through text-muted-foreground">{edit.previousValue || "(empty)"}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-semibold text-foreground">{edit.newValue || "(empty)"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
              <h4 className="text-sm font-medium text-foreground">Mark Allocation</h4>
              {adminMarks.length === 0 && (
                <Badge variant="secondary" className="text-xs px-2.5 py-0.5">Admin marks pending</Badge>
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
                            {CATEGORY_LABELS[category.categoryType]}
                          </span>
                          <div className="flex items-center gap-3 text-sm">
                            <span>
                              Indicative: <strong className="tabular-nums">{autoScore.total}</strong>
                            </span>
                            {adminMark != null && (
                              <span className="text-primary font-semibold">
                                Admin: <strong className="tabular-nums">{adminMark.total}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                        {adminMark != null ? (
                          <Badge variant="default">Scored</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 mt-1">
                    <span className="text-sm font-medium">Total</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span>
                        Indicative:{" "}
                        <strong className="tabular-nums">
                          {draft.categories.reduce(
                            (sum, c) => sum + scoreCategory(c).total,
                            0,
                          )}
                        </strong>
                      </span>
                      {adminMarks.length > 0 && (
                        <span className="text-primary font-semibold">
                          Admin:{" "}
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
                  No categories selected.
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

  const saveToServer = async (showFeedback = true) => {
    const operation = saveQueue.current.then(async () => {
      const currentDraft = useApplicationStore.getState();
      const data = normalizeDraft(currentDraft);
      const saveStartedAt = Date.now();
      set({ saveStatus: "Saving…" });
      try {
        if (adminApplicationId)
          await client.admin.application.update({ id: adminApplicationId, data });
        else if (currentDraft.accessKey)
          await client.application.update({ accessKey: currentDraft.accessKey, data });
        const remainingFeedbackMs = 120 - (Date.now() - saveStartedAt);
        if (showFeedback && remainingFeedbackMs > 0) {
          const { promise, resolve } = Promise.withResolvers<void>();
          setTimeout(resolve, remainingFeedbackMs);
          await promise;
        }
        set({ saveStatus: "Saved securely" });
      } catch {
        set({ saveStatus: "Save failed — retrying…" });
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
            : "Could not save this step. Please try again.",
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
      if (!accessKey) throw new Error("Could not create a secure application draft");
      set({ saveStatus: "Submitting…" });
      await client.application.submit({ accessKey });
      set({ submittedAt: new Date().toISOString(), saveStatus: "Submitted" });
    } catch (error) {
      set({ saveStatus: "" });
      if (error instanceof Error && error.message.includes("Submissions are outside the configured form window")) {
        set({ showSubmissionRequest: true });
      } else {
        set({
          submitError:
            error instanceof Error
              ? error.message
              : "Could not submit the application. Please try again.",
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
      set({ showSubmissionRequest: false, saveStatus: "Approval request sent" });
    } catch (error) {
      set({ submitError: error instanceof Error ? error.message : "Could not send the approval request" });
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
        Restoring your draft 2026
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
              Applicant information
            </h1>
            <p className="mt-4 max-w-[48rem] text-[1.05rem] leading-relaxed text-muted-foreground">
              G1 2026 intake · Complete the details at your own pace. Your progress is saved securely and can be reopened with your session code and access key.
            </p>
            {(draft.sessionCode || draft.accessKey) && (
              <div className="mt-5 grid max-w-[900px] grid-cols-1 gap-3 sm:grid-cols-2">
                {draft.sessionCode && (
                  <div className="grid gap-2 p-4 rounded-[14px] border border-primary/25 bg-primary/5">
                    <div className="flex items-center justify-between gap-3 text-muted-foreground text-[0.76rem] font-bold tracking-wider uppercase">
                      <span>Session code</span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 border-0 rounded-md px-1.5 py-1 text-primary bg-transparent text-[0.72rem] hover:bg-primary/10"
                        aria-label="Copy session code"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyWithFeedback("session", draft.sessionCode);
                        }}
                      >
                        {draft.copiedField === "session" ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
                      </button>
                    </div>
                    <code className="block overflow-wrap-anywhere text-[clamp(1rem,1.5vw,1.18rem)] font-bold tracking-wide">
                      {draft.sessionCode}
                    </code>
                    <span className="block rounded-lg bg-primary/11 px-2.5 py-2 text-primary text-[0.82rem] font-semibold leading-relaxed">
                      Memorise this code to find this child&apos;s application
                      on another device.
                    </span>
                  </div>
                )}
                {draft.accessKey && (
                  <div className="grid gap-2 p-4 rounded-[14px] border border-primary/25 bg-primary/5">
                    <div className="flex items-center justify-between gap-3 text-muted-foreground text-[0.76rem] font-bold tracking-wider uppercase">
                      <span>Access key</span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 border-0 rounded-md px-1.5 py-1 text-primary bg-transparent text-[0.72rem] hover:bg-primary/10"
                        aria-label="Copy access key"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyWithFeedback("key", draft.accessKey);
                        }}
                      >
                        {draft.copiedField === "key" ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
                      </button>
                    </div>
                    <code className="block break-all text-[clamp(1rem,1.5vw,1.18rem)] font-bold tracking-wide">
                      {draft.accessKey}
                    </code>
                    <span className="block rounded-lg bg-primary/11 px-2.5 py-2 text-primary text-[0.82rem] font-semibold leading-relaxed">
                      This key authorizes you to view, change, and edit this
                      application again. Store it safely.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid gap-3 rounded-2xl border border-primary/20 bg-card/85 p-5 shadow-[0_14px_32px_color-mix(in_oklch,var(--foreground)_6%,transparent)]">
            <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              <span>Application status</span>
              <ShieldCheck className="text-primary" size={17} />
            </div>
            <strong className="font-heading text-2xl">Step {current + 1} of {steps.length}</strong>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Keep going one section at a time. You can leave and return with the access key above.
            </p>
            <div className="flex items-center gap-2 border-t pt-3 text-sm text-primary">
              <span className={`size-2 rounded-full ${draft.saveStatus === "Saving…" ? "animate-pulse" : ""} ${draft.saveStatus.includes("failed") ? "bg-destructive" : "bg-primary"}`} aria-hidden="true" />
              {draft.saveStatus === "Saved securely"
                ? "Saved"
                : draft.saveStatus || (draft.accessKey ? "Connected to secure draft" : "Connecting to secure draft")}
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
                    Submission complete
                  </span>
                  <strong className="font-heading text-2xl leading-tight sm:text-3xl">
                    Application submitted successfully.
                  </strong>
                  <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                    Your application is safely recorded. Keep the access key below
                    so you can return to this child&apos;s application later.
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
                      Application blocked
                    </span>
                    <strong className="font-heading text-xl leading-tight sm:text-2xl">
                      This application has been banned.
                    </strong>
                    <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                      {draft.banReason || "This application has been blocked by an administrator. Please contact the school office for more information."}
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
                        Application verified
                      </span>
                      <strong className="font-heading text-xl leading-tight sm:text-2xl">
                        Your application has been reviewed and verified.
                      </strong>
                      <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                        An administrator has reviewed this application and confirmed the information is accurate.
                      </p>
                    </div>
                  </div>
                  {adminMarks.length > 0 && (
                    <div className={`mt-4 grid gap-2 rounded-xl border ${STATUS_SUCCESS.border} ${STATUS_SUCCESS.bgSoft} p-4`}>
                      <span className={`text-xs font-bold uppercase tracking-wider ${STATUS_SUCCESS.text}`}>Category marks</span>
                      <div className="grid gap-1.5">
                        {draft.categories.map((category) => {
                          const mark = adminMarks.find((m) => m.categoryType === category.categoryType);
                          if (!mark) return null;
                          return (
                            <div key={category.categoryType} className={`flex items-center justify-between text-sm py-1 border-b border-emerald-500/10 last:border-b-0`}>
                              <span className="text-foreground">{CATEGORY_LABELS[category.categoryType]}</span>
                              <span className={`font-semibold ${STATUS_SUCCESS.textStrong} ${STATUS_SUCCESS.textDark}`}>{mark.total}</span>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between text-sm font-semibold pt-1">
                          <span>Total</span>
                          <span className={`${STATUS_SUCCESS.textStrong} ${STATUS_SUCCESS.textDark}`}>{adminMarks.reduce((sum, m) => sum + m.total, 0)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {draft.flags && draft.flags.length > 0 && (
                    <div className={`mt-3 grid gap-2 rounded-xl border ${STATUS_WARNING.border} ${STATUS_WARNING.bgSoft} p-4`}>
                      <span className={`text-xs font-bold uppercase tracking-wider ${STATUS_WARNING.text}`}>Observations ({draft.flags.length})</span>
                      <div className="flex flex-wrap gap-1.5">
                        {draft.flags.map((f, i) => (
                          <Badge key={i} variant="outline" className={`border-amber-500/40 ${STATUS_WARNING.textStrong} ${STATUS_WARNING.textDark} text-xs`}>{f.label || f.key}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {draft.interviewNotes && (
                    <div className={`mt-3 rounded-xl border ${STATUS_SUCCESS.border} ${STATUS_SUCCESS.bgSoft} p-4`}>
                      <span className={`text-xs font-bold uppercase tracking-wider ${STATUS_SUCCESS.text}`}>Admin note</span>
                      <p className="text-sm mt-1 text-foreground">{draft.interviewNotes}</p>
                    </div>
                  )}
                  {draft.interviewEdits && draft.interviewEdits.length > 0 && (
                    <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-50/20 dark:bg-blue-950/20 p-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Changes made by admin ({draft.interviewEdits.length})
                      </span>
                      <div className="mt-2 grid gap-1 max-h-40 overflow-y-auto">
                        {draft.interviewEdits.map((edit, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-2 text-xs border-b border-blue-500/10 pb-1 last:border-b-0 last:pb-0">
                            <strong className="text-foreground">{edit.label}:</strong>
                            <span className="line-through text-muted-foreground">{edit.previousValue || "(empty)"}</span>
                            <span>→</span>
                            <span className="font-semibold text-primary">{edit.newValue || "(empty)"}</span>
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
                        Application flagged
                      </span>
                      <strong className="font-heading text-xl leading-tight sm:text-2xl">
                        This application requires attention.
                      </strong>
                      <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                        An administrator has flagged concerns with this application. Please review the details below and contact the school office if needed.
                      </p>
                    </div>
                  </div>
                  {draft.flags && draft.flags.length > 0 && (
                    <div className="mt-4 grid gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-destructive">Flagged items ({draft.flags.length})</span>
                      <div className="flex flex-wrap gap-1.5">
                        {draft.flags.map((f, i) => (
                          <Badge key={i} variant="destructive" className="text-xs">{f.label || f.key}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {adminMarks.length > 0 && (
                    <div className="mt-3 grid gap-2 rounded-xl border border-border bg-card p-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category marks</span>
                      <div className="grid gap-1.5">
                        {draft.categories.map((category) => {
                          const mark = adminMarks.find((m) => m.categoryType === category.categoryType);
                          if (!mark) return null;
                          return (
                            <div key={category.categoryType} className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-b-0">
                              <span className="text-foreground">{CATEGORY_LABELS[category.categoryType]}</span>
                              <span className="font-semibold">{mark.total}</span>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between text-sm font-semibold pt-1">
                          <span>Total</span>
                          <span>{adminMarks.reduce((sum, m) => sum + m.total, 0)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {draft.interviewNotes && (
                    <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-destructive">Admin note</span>
                      <p className="text-sm mt-1 text-foreground">{draft.interviewNotes}</p>
                    </div>
                  )}
                  {draft.interviewEdits && draft.interviewEdits.length > 0 && (
                    <div className={`mt-3 rounded-xl border ${STATUS_INFO.border} ${STATUS_INFO.bg} ${STATUS_INFO.bgDark} p-4`}>
                      <span className={`text-xs font-bold uppercase tracking-wider ${STATUS_INFO.text} ${STATUS_INFO.textDark}`}>
                        Changes made by admin ({draft.interviewEdits.length})
                      </span>
                      <div className="mt-2 grid gap-1 max-h-40 overflow-y-auto">
                        {draft.interviewEdits.map((edit, i) => (
                          <div key={i} className={`flex flex-wrap items-center gap-2 text-xs border-b border-blue-500/10 pb-1 last:border-b-0 last:pb-0`}>
                            <strong className="text-foreground">{edit.label}:</strong>
                            <span className="line-through text-muted-foreground">{edit.previousValue || "(empty)"}</span>
                            <span>→</span>
                            <span className="font-semibold text-primary">{edit.newValue || "(empty)"}</span>
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
                      Awaiting review
                    </span>
                    <strong className="font-heading text-xl leading-tight sm:text-2xl">
                      Your application is pending admin review.
                    </strong>
                    <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                      Your submission is complete. An administrator will review the details shortly. You can check back later using your access key.
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
                          Your access key
                        </h2>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        This key lets you view or update this child&apos;s application.
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
                    {draft.copiedField === "keycard" ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy key</>}
                  </Button>
                </section>

                <aside className="grid content-start gap-4 rounded-2xl border border-border bg-muted/20 p-5 sm:p-6" aria-labelledby="submitted-next-steps-heading">
                  <div className="grid gap-1">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Next steps</span>
                    <h2 id="submitted-next-steps-heading" className="font-heading text-xl">Keep your application within reach</h2>
                  </div>
                  <ol className="grid gap-3 text-sm">
                    <li className="flex items-start gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">1</span>
                      <span className="leading-relaxed text-muted-foreground">Copy or store the access key somewhere safe.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">2</span>
                      <span className="leading-relaxed text-muted-foreground">Use it with your session code to return to this application.</span>
                    </li>
                  </ol>
                </aside>
              </div>

              <div className="flex flex-wrap gap-3 border-t pt-5">
                <Button type="button" variant="secondary" onClick={() => void navigate({ to: "/" })}>
                  <House size={17} /> Back to home
                </Button>
                {!collectionOnly && (
                  <Button type="button" onClick={startAnotherApplication}>
                    <UserPlus size={17} /> Apply for another child
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              {draft.lastSavedAt && (
                <span className="inline-flex items-center gap-1 text-primary text-[0.85rem] whitespace-nowrap">
                  <Check size={15} /> Saved locally
                </span>
              )}
              <div className="ml-auto flex gap-3">
                {current > 0 && (
                  <Button variant="secondary" onClick={back}>
                    <ArrowLeft size={17} /> Back
                  </Button>
                )}
                {current < steps.length - 1 ? (
                  <Button
                    disabled={isNextDisabled}
                    onClick={next}
                  >
                    Continue <ArrowRight size={17} />
                  </Button>
                ) : (
                  <Button
                    disabled={
                      draft.isSubmitting ||
                      collectionOnly ||
                      !draft.declaration.confirmed ||
                      !draft.declaration.consent
                    }
                    aria-label={collectionOnly ? "Update application — submission opens 9 Sep 2026" : undefined}
                    onClick={() => void submitApplication()}
                  >
                    {collectionOnly ? (
                      <>
                        <Clock3 size={17} /> Submission opens 9 Sep 2026
                      </>
                    ) : draft.submittedAt ? (
                      "Update application"
                    ) : (
                      "Submit application"
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
          if (!draft.declaration.confirmed) reasons.push("Confirm that the information is correct");
          if (!draft.declaration.consent) reasons.push("Give consent to process the data");
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
              <strong>Form submission is outside the open window</strong>
              <span className="text-muted-foreground">
                Your draft is saved locally and synchronized with the server.
                The form window is{" "}
                {draft.submissionOpensAt
                  ? new Date(draft.submissionOpensAt).toLocaleString()
                  : "not yet configured"}{" "}
                to{" "}
                {draft.submissionClosesAt
                  ? new Date(draft.submissionClosesAt).toLocaleString()
                  : "not configured"}
                .
              </span>
            </div>
            <AlertDialog open={draft.clearDraftDialogOpen} onOpenChange={(open) => set({ clearDraftDialogOpen: open })}>
              <button
                type="button"
                className="bg-transparent text-muted-foreground text-xs border-0 cursor-pointer hover:text-foreground flex flex-row gap-2"
                onClick={() => set({ clearDraftDialogOpen: true })}
              >
                <RotateCcw size={15} /> Clear draft
              </button>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear this draft?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all saved data for this application from this device. You can reload it later using the access key.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
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
                    Clear draft
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
              <strong>Request approval to submit</strong>
              <span className="text-sm text-muted-foreground">
                The submission window is closed. Submit this request for admin
                approval.
              </span>
              <div className="grid gap-2 max-w-md">
                <Input
                  placeholder="Your full name"
                  value={draft.requestName}
                  onChange={(e) => set({ requestName: e.target.value })}
                />
                <Input
                  placeholder="Contact phone number"
                  value={draft.requestPhone}
                  onChange={(e) => set({ requestPhone: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={draft.requestSaving || !draft.requestName.trim() || !draft.requestPhone.trim()}
                  onClick={() => void submitApprovalRequest()}
                >
                  {draft.requestSaving ? "Sending\u2026" : "Send approval request"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => set({ showSubmissionRequest: false })}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}
