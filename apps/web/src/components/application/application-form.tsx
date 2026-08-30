import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, Check, Clock3, Copy, House, KeyRound, RotateCcw, ShieldCheck, UserPlus, TriangleAlert } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { LocationStep } from "./location-step";
import { CategoryStep } from "./category-step";
import {
  applyLocationChange,
  emptyDraft,
  normalizeDraft,
  useApplicationStore,
  type ApplicationDraft,
  type CategoryApplication,
  type CategoryType,
} from "@/lib/application-store";
import { G1_DOB_CUTOFF, getNextStepReason } from "@/lib/eligibility";
import { scoreCategory } from "@/lib/scoring";
import { client } from "@/utils/orpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@aloysius-g1/ui/components/card";
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
  "6.2": "6.2 – Alumi",
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
  steps: stepLabels,
  onStepClick,
}: {
  current: number;
  steps: string[];
  onStepClick: (index: number) => void;
}) {
  const progress = Math.round((current / (stepLabels.length - 1)) * 100);
  return (
    <>
      <div className="flex items-center justify-between gap-4 px-8 pt-6 pb-4">
        <div>
          <p className="text-xs text-muted-foreground">
            Step {current + 1} of {stepLabels.length}
          </p>
          <h2 className="font-heading text-2xl">{stepLabels[current]}</h2>
        </div>
        <span className="text-sm text-muted-foreground">{progress}% complete</span>
      </div>
      <div className="h-1 bg-secondary">
        <div
          className="h-full bg-primary transition-[width] duration-350 ease-in-out"
          style={{ width: `${Math.max(progress, 8)}%` }}
        />
      </div>
      <nav
        className="flex gap-1 overflow-auto border-b px-8 py-3"
        aria-label="Form steps"
      >
        {stepLabels.map((step, index) => (
          <button
            type="button"
            key={step}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap bg-transparent px-2.5 py-2 text-xs ${
              index === current
                ? "font-bold text-foreground"
                : index < current
                  ? "text-muted-foreground"
                  : "text-muted-foreground"
            }`}
            onClick={() => index <= current && onStepClick(index)}
          >
            <span
              className={`grid size-6 place-items-center rounded-full border text-[11px] ${
                index === current || index < current
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              }`}
            >
              {index < current ? <Check size={14} /> : index + 1}
            </span>
            {step}
          </button>
        ))}
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
      });
      set({ duplicateBirthCertificate: result.exists, bcDialogOpen: reveal ? result.exists : draft.bcDialogOpen });
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
        defaultValue={draft.defaultLocation ?? emptyDraft.defaultLocation}
        deviceLocationHistory={draft.deviceLocationHistory ?? []}
        userLocationHistory={draft.userLocationHistory ?? []}
        onAvailabilityChange={(canProceed) => set({ locationCanProceed: canProceed })}
        onChange={(value, defaultValue) => {
          if (readOnly) return;
          const histories = applyLocationChange(draft, value, defaultValue);
          set({
            location: value,
            selectedLocation: value,
            ...(defaultValue ? { defaultLocation: defaultValue } : {}),
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
    <div className="grid grid-cols-2 gap-5 max-w-[780px]">
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
    <div className="grid grid-cols-2 gap-5 max-w-[780px]">
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
    <div className="grid grid-cols-2 gap-5 max-w-[780px]">
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
    <div className="max-w-[700px] grid gap-5">
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
        I consent to this information being used to prepare the G1 2026 intake
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
  const sections: [string, string, number][] = [
    ["Location", draft.location.address || "Not selected", 0],
    ["Full name in English", draft.applicant.fullName || "Not completed", 1],
    ["Full name in Sinhala", draft.applicant.sinhalaName || "Not completed", 1],
    ["Gender", draft.applicant.gender || "Not selected", 1],
    ["Religion", draft.applicant.religion || "Not selected", 1],
    [
      "Education medium",
      draft.applicant.educationMedium || "Not selected",
      1,
    ],
    ["Date of birth", draft.applicant.dateOfBirth || "Not completed", 1],
    [
      "Birth certificate number",
      draft.applicant.birthCertificateNumber || "Not completed",
      1,
    ],
    ["Relationship", draft.guardian.relationship || "Not selected", 2],
    ["Guardian name", draft.guardian.fullName || "Not completed", 2],
    ["Guardian name in Sinhala", draft.guardian.sinhalaName || "Not completed", 2],
    ["Guardian NIC", draft.guardian.nic || "Not completed", 2],
    ["Phone number", draft.guardian.phone || "Not completed", 2],
    ["Guardian email", draft.guardian.email || "Not completed", 2],
    [
      "Permanent address",
      draft.residence.permanentAddress || "Not completed",
      3,
    ],
    [
      "Current address",
      draft.residence.currentAddress || "Not completed",
      3,
    ],
    ["District", draft.residence.district || "Not selected", 3],
    [
      "Divisional Secretariat division",
      draft.residence.dsDivision || "Not selected",
      3,
    ],
    [
      "Grama Niladhari division",
      draft.residence.gnDivision || "Not selected",
      3],
    [
      "Electoral district",
      draft.residence.electoralDistrict || "Not selected",
      3,
    ],
  ];

  const categoryRows: [string, string, number][] =
    draft.categories.length > 0
      ? draft.categories.map(
          (category): [string, string, number] => [
            CATEGORY_LABELS[category.categoryType],
            categorySummary(category),
            4,
          ],
        )
      : [["Categories", "None selected", 4]];
  const rows = [...sections, ...categoryRows];

  return (
    <div className="max-w-[780px]">
      <div className="mb-4">
        <h3 className="font-heading text-2xl">Review your draft</h3>
        <p className="text-sm text-muted-foreground">
          Check all collected information before the application submission step
          becomes available.
        </p>
      </div>
      {rows.map(([label, value, step]) => (
        <div
          className="flex items-center justify-between gap-4 border-b py-3"
          key={label}
        >
          <div className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">{label}</span>
            <strong className="text-sm">{value}</strong>
          </div>
          <button
            type="button"
            className="text-xs font-bold text-primary"
            onClick={() => onNavigateToStep(step)}
          >
            Edit
          </button>
        </div>
      ))}
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
  const navigate = useNavigate();

  const set = (patch: Partial<ApplicationDraft>) => draft.updateDraft(patch);

  const collectionOnly = draft.submissionLocked && draft.submittedAt !== null;

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
            const latest = normalizeDraft(
              result.data as Partial<ApplicationDraft>,
            );
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
            set({
              ...merged,
              sessionCode: restoredSessionCode || draft.sessionCode,
              submittedAt: result.submittedAt ? String(result.submittedAt) : null,
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
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSavedSnapshot = useRef("");

  useEffect(() => {
    if (!draft.hydrated || !draft.accessKey) return;
    const snapshot = JSON.stringify(normalizeDraft(draft));
    if (snapshot === lastSavedSnapshot.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      lastSavedSnapshot.current = snapshot;
      void saveToServer();
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [draft.categories, draft.applicant, draft.guardian, draft.residence, draft.declaration, draft.currentStep, draft.hydrated, draft.accessKey]);

  const current = draft.currentStep;

  const saveToServer = async () => {
    const operation = saveQueue.current.then(async () => {
      const data = normalizeDraft(draft);
      set({ saveStatus: "Saving\u2026" });
      if (adminApplicationId)
        await client.admin.application.update({ id: adminApplicationId, data });
      else if (draft.accessKey)
        await client.application.update({ accessKey: draft.accessKey, data });
      set({ saveStatus: "Saved securely" });
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
      await saveToServer();
      if (!draft.accessKey) return;
      set({ saveStatus: "Submitting\u2026" });
      await client.application.submit({ accessKey: draft.accessKey });
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
        Restoring your draft\u2026
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
    <main className="min-h-[calc(100svh-4rem)] px-5 pt-14 pb-20 bg-[radial-gradient(circle_at_82%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_30rem)]">

      <section className="mx-auto max-w-[1120px]">
        <div className="flex justify-between gap-8 items-start mb-9">
          <div className="min-w-0 flex-1">
            <p className="text-primary font-bold tracking-widest uppercase text-xs">
              G1 2026 intake
            </p>
            <h1 className="font-heading text-[clamp(2.4rem,5vw,4.5rem)] leading-none tracking-tight mt-1 mb-4">
              Applicant information
            </h1>
            <p className="max-w-[42rem] text-muted-foreground text-[1.05rem]">
              Complete the details at your own pace. Your progress is saved
              securely and can be reopened with your session code and access key.
            </p>
            {(draft.sessionCode || draft.accessKey) && (
              <div className="grid grid-cols-2 gap-3 mt-5 max-w-[900px]">
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
          <div className="inline-flex items-center gap-1.5 text-primary text-[0.85rem] whitespace-nowrap">
            <ShieldCheck size={17} />{" "}
            {draft.accessKey ? "Saved to database" : "Connecting to database"}
          </div>
        </div>
      </section>

      <Card className="mx-auto max-w-[1120px] overflow-hidden shadow-[0_20px_45px_color-mix(in_oklch,var(--foreground)_8%,transparent)]">
        <StepIndicator
          current={current}
          steps={steps}
          onStepClick={(index) => draft.setStep(index)}
        />

        <CardContent className="p-9 min-h-[440px]">
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

        <div className="flex items-center justify-between gap-4 border-t px-8 py-6">
          {draft.submitError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 max-w-md">
              <TriangleAlert size={16} className="shrink-0 mt-0.5 text-destructive" />
              <p className="text-sm text-destructive break-words">{draft.submitError}</p>
            </div>
          )}
          {draft.submittedAt && !draft.submissionLocked ? (
            <div className="p-6">
              <strong className="text-lg">
                Application submitted successfully.
              </strong>
              <div className="grid gap-3 max-w-[42rem] my-4 p-4 rounded-xl border border-primary/30 bg-primary/7">
                <span className="text-muted-foreground text-sm">
                  Keep this application key safe. You need it to view or update
                  this child&apos;s application.
                </span>
                <code className="block break-all p-3 rounded-lg bg-background text-[0.85rem]">
                  {draft.accessKey}
                </code>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary text-secondary-foreground px-4 py-2 text-sm font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyWithFeedback("keycard", draft.accessKey);
                  }}
                >
                  {draft.copiedField === "keycard" ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy key</>}
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary text-secondary-foreground px-4 py-2 text-sm font-medium"
                  onClick={() => void navigate({ to: "/" })}
                >
                  <House size={17} /> Back to home
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
                  onClick={startAnotherApplication}
                >
                  <UserPlus size={17} /> Apply for another child
                </button>
              </div>
            </div>
          ) : (
            <>
              {draft.lastSavedAt && (
                <span className="inline-flex items-center gap-1 text-primary text-[0.85rem] whitespace-nowrap">
                  <Check size={15} /> Saved locally
                </span>
              )}
              <div className="flex gap-3 ml-auto">
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
          <div className="flex items-center gap-3 px-(--card-spacing) py-4 bg-primary/8 border-t border-primary/20">
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
            <button
              type="button"
              className="bg-transparent text-muted-foreground text-xs border-0 cursor-pointer hover:text-foreground"
              onClick={() => draft.reset()}
            >
              <RotateCcw size={15} /> Clear draft
            </button>
          </div>
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
