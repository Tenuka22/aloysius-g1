import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import type { AnyFieldApi, ReactFormExtendedApi } from "@tanstack/react-form";
import { ArrowLeft, ArrowRight, Check, Clock3, Copy, House, KeyRound, RotateCcw, ShieldCheck, UserPlus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { LocationStep } from "./location-step";
import { emptyDraft, normalizeDraft, useApplicationStore, type ApplicationDraft } from "@/lib/application-store";
import { G1_DOB_CUTOFF, getNextStepReason } from "@/lib/eligibility";
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
import { useAppForm } from "@/lib/app-form";
import {
  applicantStepSchema,
  guardianStepSchema,
  residenceStepSchema,
  declarationStepSchema,
} from "@/lib/validation";

// biome-ignore lint/suspicious/noExplicitAny: internal step components need the React form type with .Field
type AppForm = ReactFormExtendedApi<any, any, any, any, any, any, any, any, any, any, any, any>;

const steps = ["Location", "Applicant", "Parent / guardian", "Residence", "Declaration", "Review"];
function FieldErrorDisplay({ field }: { field: AnyFieldApi }) {
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
  if (!isInvalid || !field.state.meta.errors?.length) return null;
  return (
    <p className="text-sm text-destructive">
      {field.state.meta.errors.map((e) => e?.message).join(", ")}
    </p>
  );
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
  form,
  onDuplicateChange,
}: {
  form: AppForm;
  onDuplicateChange?: (duplicate: boolean) => void;
}) {
  const [duplicate, setDuplicate] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [applicantName, setApplicantName] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [requestState, setRequestState] = useState("");
  const checkTimer = useRef<number | undefined>(undefined);

  const existingApplicantName = String(
    form.state.values.applicant?.fullName ?? "",
  );
  const existingGuardianName = String(
    form.state.values.guardian?.fullName ?? "",
  );
  const existingContactPhone = String(
    form.state.values.guardian?.phone ?? "",
  );

  useEffect(() => {
    if (existingApplicantName)
      setApplicantName((c) => c || existingApplicantName);
    if (existingGuardianName)
      setGuardianName((c) => c || existingGuardianName);
    if (existingContactPhone)
      setContactPhone((c) => c || existingContactPhone);
  }, [existingApplicantName, existingGuardianName, existingContactPhone]);

  const check = async (value: string, reveal = true) => {
    const number = value.trim();
    if (!number) {
      setDuplicate(false);
      setDialogOpen(false);
      onDuplicateChange?.(false);
      return;
    }
    try {
      const result = await client.application.checkBirthCertificate({
        birthCertificateNumber: number,
      });
      setDuplicate(result.exists);
      if (reveal) setDialogOpen(result.exists);
      onDuplicateChange?.(result.exists);
    } catch {
      setDuplicate(false);
      setDialogOpen(false);
      onDuplicateChange?.(false);
    }
  };

  const scheduleCheck = (value: string) => {
    if (checkTimer.current) window.clearTimeout(checkTimer.current);
    checkTimer.current = window.setTimeout(() => void check(value, false), 250);
  };

  const watchedValue = String(
    form.state.values.applicant?.birthCertificateNumber ?? "",
  );
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
      setRequestState("Sending removal request\u2026");
      await client.application.requestAccess({
        birthCertificateNumber,
        applicantName,
        guardianName,
        contactPhone,
        requestType: "removal",
      });
      setRequestState(
        "Removal request sent. The school will review it and contact you before taking action.",
      );
    } catch (error) {
      setRequestState(
        error instanceof Error ? error.message : "Could not send the request",
      );
    }
  };

  return (
    <form.Field name="applicant.birthCertificateNumber">
      {(field: AnyFieldApi) => (
        <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
          <FieldLabel htmlFor="applicant.birthCertificateNumber">
            Birth certificate number
          </FieldLabel>
          <div className="flex gap-2">
            <Input
              className={`flex-1 ${duplicate ? "border-destructive ring-destructive/20" : ""}`}
              id="applicant.birthCertificateNumber"
              name="applicant.birthCertificateNumber"
              value={field.state.value}
              placeholder="Enter birth certificate number"
              onChange={(e) => {
                field.handleChange(e.target.value);
                setRequestState("");
                scheduleCheck(e.target.value);
              }}
              onBlur={field.handleBlur}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Check this birth certificate number again"
              onClick={() => void check(field.state.value, false)}
            >
              <RotateCcw size={14} /> Refresh
            </Button>
          </div>
          <Drawer open={dialogOpen} onOpenChange={setDialogOpen}>
            {duplicate && (
              <DrawerTrigger className="border-0 bg-transparent p-0 text-destructive text-sm underline w-fit">
                View existing application options
              </DrawerTrigger>
            )}
            <FieldErrorDisplay field={field} />
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
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder="Applicant name"
                    />
                    <Input
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="Guardian name"
                    />
                    <PhoneInput
                      value={contactPhone}
                      onChange={setContactPhone}
                    />
                    <Button
                      type="button"
                      disabled={
                        !applicantName.trim() ||
                        !guardianName.trim() ||
                        !contactPhone.trim()
                      }
                      onClick={() => void requestRemoval(field.state.value)}
                    >
                      Request record removal
                    </Button>
                  </div>
                  {requestState && (
                    <p className="text-sm text-muted-foreground" role="status">
                      {requestState}
                    </p>
                  )}
                </section>
              </div>
            </DrawerContent>
          </Drawer>
        </Field>
      )}
    </form.Field>
  );
}

function LocationStepCard({
  draft,
  readOnly,
  setSection,
  onLocationCanProceed,
}: {
  draft: ApplicationDraft;
  readOnly: boolean;
  setSection: (section: keyof ApplicationDraft, value: unknown) => void;
  onLocationCanProceed: (canProceed: boolean) => void;
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
        value={draft.location ?? emptyDraft.location}
        defaultValue={draft.defaultLocation ?? emptyDraft.defaultLocation}
        onAvailabilityChange={onLocationCanProceed}
        onChange={(value, defaultValue) => {
          if (readOnly) return;
          setSection("location", value);
          setSection("selectedLocation", value);
          if (defaultValue) setSection("defaultLocation", defaultValue);
        }}
      />
    </div>
  );
}

function ApplicantStep({
  form,
  draft,
  setSection,
  onDuplicateChange,
}: {
  form: AppForm;
  draft: ApplicationDraft;
  setSection: (section: keyof ApplicationDraft, value: unknown) => void;
  onDuplicateChange?: (duplicate: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-5 max-w-[780px]">
      <div className="col-span-2 mb-4">
        <h3 className="font-heading text-2xl">Tell us about the applicant</h3>
        <p className="text-sm text-muted-foreground">
          Use the name shown on the applicant&apos;s birth certificate.
        </p>
      </div>

      <form.Field name="applicant.fullName">
        {(field: AnyFieldApi) => (
          <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
            <FieldLabel htmlFor="applicant.fullName">Full name</FieldLabel>
            <Input
              id="applicant.fullName"
              value={field.state.value}
              placeholder="Enter full name"
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
            />
            <FieldErrorDisplay field={field} />
          </Field>
        )}
      </form.Field>

      <form.Field name="applicant.sinhalaName">
        {(field: AnyFieldApi) => (
          <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
            <FieldLabel htmlFor="applicant.sinhalaName">
              Name in Sinhala
            </FieldLabel>
            <Input
              id="applicant.sinhalaName"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
            />
            <a
              className="text-xs text-primary underline underline-offset-1 hover:text-primary/80"
              href="https://www.helakuru.lk/keyboard"
              target="_blank"
              rel="noreferrer"
            >
              Need a Sinhala phonetic keyboard? Open Helakuru
            </a>
            <FieldErrorDisplay field={field} />
          </Field>
        )}
      </form.Field>

      <form.Field name="applicant.gender">
        {(field: AnyFieldApi) => (
          <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
            <FieldLabel htmlFor="applicant.gender">Gender</FieldLabel>
            <Select
              value={field.state.value || ""}
              onValueChange={(value) => {
                field.handleChange(value);
                setSection("applicant", { ...draft.applicant, gender: value });
              }}
            >
              <SelectTrigger
                id="applicant.gender"
                className="w-full"
                aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
              >
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Male">Male</SelectItem>
              </SelectContent>
            </Select>
            <FieldErrorDisplay field={field} />
          </Field>
        )}
      </form.Field>

      {draft.applicant.gender === "Female" && (
        <p className="col-span-2 text-sm text-destructive">
          This is a boys&apos; school, so female applicants cannot continue
          with this application.
        </p>
      )}

      <form.Field name="applicant.religion">
        {(field: AnyFieldApi) => (
          <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
            <FieldLabel htmlFor="applicant.religion">Religion</FieldLabel>
            <Select
              value={field.state.value || ""}
              onValueChange={(value) => {
                field.handleChange(value);
                setSection("applicant", { ...draft.applicant, religion: value });
              }}
            >
              <SelectTrigger
                id="applicant.religion"
                className="w-full"
                aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
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
            <FieldErrorDisplay field={field} />
          </Field>
        )}
      </form.Field>

      {draft.applicant.religion === "Christian" && (
        <p className="col-span-2 text-sm text-destructive">
          This intake is not available to Christian applicants.
        </p>
      )}

      <form.Field name="applicant.educationMedium">
        {(field: AnyFieldApi) => (
          <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
            <FieldLabel htmlFor="applicant.educationMedium">
              Education medium
            </FieldLabel>
            <Select
              value={field.state.value || ""}
              onValueChange={(value) => {
                field.handleChange(value);
                setSection("applicant", {
                  ...draft.applicant,
                  educationMedium: value,
                });
              }}
            >
              <SelectTrigger
                id="applicant.educationMedium"
                className="w-full"
                aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
              >
                <SelectValue placeholder="Select medium" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sinhala">Sinhala</SelectItem>
                <SelectItem value="Tamil">Tamil</SelectItem>
              </SelectContent>
            </Select>
            <FieldErrorDisplay field={field} />
          </Field>
        )}
      </form.Field>

      <form.Field name="applicant.dateOfBirth">
        {(field: AnyFieldApi) => (
          <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
            <FieldLabel htmlFor="applicant.dateOfBirth">
              Date of birth
            </FieldLabel>
            <Input
              id="applicant.dateOfBirth"
              type="date"
              max={G1_DOB_CUTOFF}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
            />
            <FieldDescription>
              The child must be at least five years old by 31 January 2027.
            </FieldDescription>
            <FieldErrorDisplay field={field} />
          </Field>
        )}
      </form.Field>

      <div className="col-span-2">
        <BirthCertificateField form={form} onDuplicateChange={onDuplicateChange} />
      </div>
    </div>
  );
}

function GuardianStep({
  form,
}: {
  form: AppForm;
}) {
  return (
    <div className="grid grid-cols-2 gap-5 max-w-[780px]">
      <div className="col-span-2 mb-4">
        <h3 className="font-heading text-2xl">Parent or guardian details</h3>
        <p className="text-sm text-muted-foreground">
          We&apos;ll use these details only to contact the family about this
          intake.
        </p>
      </div>

      <form.Field name="guardian.relationship">
        {(field: AnyFieldApi) => (
          <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
            <FieldLabel htmlFor="guardian.relationship">
              Relationship to applicant
            </FieldLabel>
            <Select
              value={field.state.value || ""}
              onValueChange={(value) => field.handleChange(value)}
            >
              <SelectTrigger
                id="guardian.relationship"
                className="w-full"
                aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
              >
                <SelectValue placeholder="Select relationship" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mother">Mother</SelectItem>
                <SelectItem value="Father">Father</SelectItem>
                <SelectItem value="Guardian">Guardian</SelectItem>
              </SelectContent>
            </Select>
            <FieldErrorDisplay field={field} />
          </Field>
        )}
      </form.Field>

      <form.Field name="guardian.fullName">
        {(field: AnyFieldApi) => (
          <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
            <FieldLabel htmlFor="guardian.fullName">Full name</FieldLabel>
            <Input
              id="guardian.fullName"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
            />
            <FieldErrorDisplay field={field} />
          </Field>
        )}
      </form.Field>

      <form.Field name="guardian.nic">
        {(field: AnyFieldApi) => {
          const value = String(field.state.value || "").trim().toUpperCase();
          const valid =
            !value || /^\d{12}$/.test(value) || /^\d{9}[VX]$/.test(value);
          return (
            <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
              <FieldLabel htmlFor="guardian.nic">NIC number</FieldLabel>
              <Input
                id="guardian.nic"
                value={field.state.value}
                placeholder="e.g. 123456789V or 200012345678"
                maxLength={12}
                autoCapitalize="characters"
                spellCheck={false}
                onBlur={field.handleBlur}
                onChange={(e) =>
                  field.handleChange(e.target.value.toUpperCase())
                }
                aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
              />
              {!valid && (
                <p className="text-sm text-destructive">
                  Enter a valid Sri Lankan NIC: 9 digits followed by V/X, or 12
                  digits.
                </p>
              )}
              <FieldErrorDisplay field={field} />
            </Field>
          );
        }}
      </form.Field>

      <form.Field name="guardian.phone">
        {(field: AnyFieldApi) => (
          <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
            <FieldLabel htmlFor="guardian.phone">Phone number</FieldLabel>
            <PhoneInput
              value={field.state.value || ""}
              onChange={field.handleChange}
            />
            <FieldErrorDisplay field={field} />
          </Field>
        )}
      </form.Field>

      <form.Field name="guardian.email">
        {(field: AnyFieldApi) => (
          <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
            <FieldLabel htmlFor="guardian.email">Email address</FieldLabel>
            <Input
              id="guardian.email"
              type="email"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
            />
            <FieldErrorDisplay field={field} />
          </Field>
        )}
      </form.Field>
    </div>
  );
}

function ResidenceStep({
  form,
  draft,
  setSection,
}: {
  form: AppForm;
  draft: ApplicationDraft;
  setSection: (section: keyof ApplicationDraft, value: unknown) => void;
}) {
  const [sameAsPermanent, setSameAsPermanent] = useState(
    draft.residence.sameAsPermanent,
  );
  useEffect(() => {
    setSameAsPermanent(draft.residence.sameAsPermanent);
  }, [draft.residence.sameAsPermanent]);

  const [districtSearch, setDistrictSearch] = useState("");
  const [dsSearch, setDsSearch] = useState("");
  const [gnSearch, setGnSearch] = useState("");
  const [electoralSearch, setElectoralSearch] = useState("");

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

  const districtOptions = useMemo(
    () => filterOptions(DISTRICTS.map((d) => d.en), districtSearch),
    [districtSearch],
  );
  const dsOptions = useMemo(
    () =>
      filterOptions(
        DIVISIONAL_SECRETARIATS.filter(
          (d) => !selectedDistrict || d.districtId === selectedDistrict.id,
        ).map((d) => d.en),
        dsSearch,
      ),
    [dsSearch, selectedDistrict?.id],
  );
  const gnOptions = useMemo(
    () =>
      filterOptions(
        GN_DIVISIONS.filter(
          (d) => !selectedDs || d.dsId === selectedDs.id,
        ).map((d) => d.en),
        gnSearch,
      ),
    [gnSearch, selectedDs?.id],
  );
  const electoralOptions = useMemo(
    () =>
      filterOptions(
        ELECTORAL_CONSTITUENCIES.map((c) => c.en),
        electoralSearch,
      ),
    [electoralSearch],
  );

  const copyPermanent = (checked: boolean) => {
    setSameAsPermanent(checked);
    const residence = form.state.values.residence;
    const updated = {
      ...residence,
      sameAsPermanent: checked,
      currentAddress: checked ? residence.permanentAddress : residence.currentAddress,
    };
    if (checked) form.setFieldValue("residence.currentAddress", residence.permanentAddress);
    setSection("residence", updated);
  };

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

      <form.Field name="residence.permanentAddress">
        {(field: AnyFieldApi) => (
          <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
            <FieldLabel htmlFor="residence.permanentAddress">
              Permanent address
            </FieldLabel>
            <Input
              id="residence.permanentAddress"
              value={field.state.value}
              placeholder="House number, street, town"
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
            />
            <FieldErrorDisplay field={field} />
          </Field>
        )}
      </form.Field>

      <form.Field name="residence.currentAddress">
        {(field: AnyFieldApi) => (
          <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
            <FieldLabel htmlFor="residence.currentAddress">
              Current address
            </FieldLabel>
            <Input
              id="residence.currentAddress"
              value={field.state.value}
              placeholder="Current address"
              disabled={sameAsPermanent}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
            />
            <FieldErrorDisplay field={field} />
          </Field>
        )}
      </form.Field>

      <div className="col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            className="size-5"
            checked={sameAsPermanent}
            onCheckedChange={(checked) => copyPermanent(checked === true)}
          />
          Current address is the same as permanent address
        </label>
      </div>

      <form.Field name="residence.district">
        {(field: AnyFieldApi) => (
          <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
            <FieldLabel htmlFor="residence.district">District</FieldLabel>
            <input
              id="residence.district"
              list="district-options"
              value={field.state.value || districtSearch}
              placeholder="Search district"
              onBlur={field.handleBlur}
              onChange={(e) => {
                setDistrictSearch(e.target.value);
                const match = districtOptions.find(
                  (opt) => opt.toLowerCase() === e.target.value.toLowerCase(),
                );
                if (match) {
                  field.handleChange(match);
                  setSection("residence", {
                    ...form.state.values.residence,
                    district: match,
                    dsDivision: "",
                    gnDivision: "",
                  });
                }
              }}
              className="flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            />
            <datalist id="district-options">
              {districtOptions.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
            <FieldErrorDisplay field={field} />
          </Field>
        )}
      </form.Field>

      <form.Field name="residence.dsDivision">
        {(field: AnyFieldApi) => (
          <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
            <FieldLabel htmlFor="residence.dsDivision">
              Divisional Secretariat division
            </FieldLabel>
            <input
              id="residence.dsDivision"
              list="ds-options"
              value={field.state.value || dsSearch}
              placeholder="Search DS division"
              onBlur={field.handleBlur}
              onChange={(e) => {
                setDsSearch(e.target.value);
                const match = dsOptions.find(
                  (opt) => opt.toLowerCase() === e.target.value.toLowerCase(),
                );
                if (match) {
                  field.handleChange(match);
                  setSection("residence", {
                    ...form.state.values.residence,
                    dsDivision: match,
                    gnDivision: "",
                  });
                }
              }}
              className="flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            />
            <datalist id="ds-options">
              {dsOptions.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
            <FieldErrorDisplay field={field} />
          </Field>
        )}
      </form.Field>

      <form.Field name="residence.gnDivision">
        {(field: AnyFieldApi) => (
          <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
            <FieldLabel htmlFor="residence.gnDivision">
              Grama Niladhari division
            </FieldLabel>
            <input
              id="residence.gnDivision"
              list="gn-options"
              value={field.state.value || gnSearch}
              placeholder="Search GN division"
              onBlur={field.handleBlur}
              onChange={(e) => {
                setGnSearch(e.target.value);
                const match = gnOptions.find(
                  (opt) => opt.toLowerCase() === e.target.value.toLowerCase(),
                );
                if (match) field.handleChange(match);
              }}
              className="flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            />
            <datalist id="gn-options">
              {gnOptions.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
            <FieldErrorDisplay field={field} />
          </Field>
        )}
      </form.Field>

      <form.Field name="residence.electoralDistrict">
        {(field: AnyFieldApi) => (
          <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
            <FieldLabel htmlFor="residence.electoralDistrict">
              Electoral district
            </FieldLabel>
            <input
              id="residence.electoralDistrict"
              list="electoral-options"
              value={field.state.value || electoralSearch}
              placeholder="Search electoral district"
              onBlur={field.handleBlur}
              onChange={(e) => {
                setElectoralSearch(e.target.value);
                const match = electoralOptions.find(
                  (opt) => opt.toLowerCase() === e.target.value.toLowerCase(),
                );
                if (match) field.handleChange(match);
              }}
              className="flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            />
            <datalist id="electoral-options">
              {electoralOptions.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
            <FieldErrorDisplay field={field} />
          </Field>
        )}
      </form.Field>
    </div>
  );
}

function DeclarationStep({
  draft,
  setSection,
}: {
  draft: ApplicationDraft;
  setSection: (section: keyof ApplicationDraft, value: unknown) => void;
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
            setSection("declaration", {
              ...draft.declaration,
              confirmed: checked === true,
            })
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
            setSection("declaration", {
              ...draft.declaration,
              consent: checked === true,
            })
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
  const sections: [string, string, number][] = useMemo(
    () => [
      ["Location", draft.location.address || "Not selected", 0],
      ["Applicant full name", draft.applicant.fullName || "Not completed", 1],
      ["Name in Sinhala", draft.applicant.sinhalaName || "Not completed", 1],
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
    ],
    [draft],
  );

  return (
    <div className="max-w-[780px]">
      <div className="mb-4">
        <h3 className="font-heading text-2xl">Review your draft</h3>
        <p className="text-sm text-muted-foreground">
          Check all collected information before the application submission step
          becomes available.
        </p>
      </div>
      {sections.map(([label, value, step]) => (
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
  const [hydrated, setHydrated] = useState(false);
  const [accessKey, setAccessKey] = useState(
    () =>
      new URLSearchParams(window.location.search).get("key") ??
      localStorage.getItem("aloysius-g1-application-key") ??
      "",
  );
  const [sessionCode, setSessionCode] = useState(
    () =>
      new URLSearchParams(window.location.search).get("code") ??
      localStorage.getItem("aloysius-g1-application-session-code") ??
      "",
  );
  const [saveStatus, setSaveStatus] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionOpensAt, setSubmissionOpensAt] = useState("");
  const [submissionClosesAt, setSubmissionClosesAt] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [locationCanProceed, setLocationCanProceed] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [submissionLocked, setSubmissionLocked] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);
  const [showSubmissionRequest, setShowSubmissionRequest] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestPhone, setRequestPhone] = useState("");
  const [requestSaving, setRequestSaving] = useState(false);
  const saveQueue = useRef(Promise.resolve());
  const navigate = useNavigate();
  const collectionOnly = submissionLocked && submittedAt !== null;

  const form = useForm({
    defaultValues: draft as ApplicationDraft,
    onSubmit: ({ value }) =>
      draft.updateDraft(value as Partial<ApplicationDraft>),
  });

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const key = accessKey;
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
            draft.updateDraft(latest);
            form.reset(latest);
            setSavedSnapshot(JSON.stringify(latest));
            setSubmittedAt(result.submittedAt || null);
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
              setSessionCode(restoredSessionCode);
              localStorage.setItem(
                "aloysius-g1-application-session-code",
                restoredSessionCode,
              );
            }
            draft.updateDraft(latest);
            form.reset(latest);
            setSavedSnapshot(JSON.stringify(latest));
            setSubmittedAt(result.submittedAt || null);
            dataLoaded = true;
          }
        } else if (!adminApplicationId && !readOnly) {
          const result = await client.application.create({ data: {} });
          if (!cancelled) {
            setAccessKey(result.accessKey);
            setSessionCode(result.sessionCode);
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
            draft.updateDraft(latest);
            form.reset(latest);
            setSavedSnapshot(JSON.stringify(latest));
            setSubmittedAt(null);
            dataLoaded = true;
          }
        }
        try {
          const status = await client.application.status();
          if (!cancelled) {
            setSubmissionLocked(status.submissionLocked);
            setSubmissionOpensAt(status.submissionOpensAt);
            setSubmissionClosesAt(status.submissionClosesAt);
          }
        } catch {
          if (!cancelled) {
            setSubmissionLocked(true);
          }
        }
      } catch {
        if (!cancelled && !dataLoaded) {
          draft.reset();
          setAccessKey("");
          setSessionCode("");
          localStorage.removeItem("aloysius-g1-application-key");
          localStorage.removeItem("aloysius-g1-application-session-code");
          setSubmissionLocked(true);
          setSubmittedAt(null);
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = draft.currentStep;

  const setSection = (section: keyof ApplicationDraft, value: unknown) =>
    draft.updateDraft({ [section]: value } as Partial<ApplicationDraft>);

  const saveToServer = async () => {
    const operation = saveQueue.current.then(async () => {
      const data = normalizeDraft({
        ...(form.state.values as ApplicationDraft),
        ...draft,
      });
      setSaveStatus("Saving\u2026");
      if (adminApplicationId)
        await client.admin.application.update({ id: adminApplicationId, data });
      else if (accessKey)
        await client.application.update({ accessKey, data });
      setSavedSnapshot(JSON.stringify(data));
      setSaveStatus("Saved securely");
    });
    saveQueue.current = operation.catch(() => undefined);
    return operation;
  };

  useEffect(() => {
    if (
      !hydrated ||
      !accessKey ||
      !savedSnapshot ||
      JSON.stringify(form.state.values) === savedSnapshot
    )
      return;
    const timer = window.setTimeout(() => {
      void saveToServer();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [
    accessKey,
    hydrated,
    savedSnapshot,
    JSON.stringify(form.state.values),
  ]);

  const next = async () => {
    if (nextDisabledReason) return;
    try {
      setSubmitError("");
      await form.handleSubmit();
      const nextStep = Math.min(current + 1, steps.length - 1);
      draft.setStep(nextStep);
      await saveToServer();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Could not save this step. Please try again.",
      );
      draft.setStep(current);
    }
  };

  const hasUnsavedChanges =
    !accessKey || JSON.stringify(form.state.values) !== savedSnapshot;

  const submitApplication = async () => {
    try {
      setIsSubmitting(true);
      setSubmitError("");
      if (hasUnsavedChanges) await saveToServer();
      if (!accessKey) return;
      setSaveStatus("Submitting…");
      await client.application.submit({ accessKey });
      setSubmitted(true);
      setSubmittedAt(new Date());
      setSaveStatus("Submitted");
    } catch (error) {
      setSaveStatus("");
      if (error instanceof Error && error.message.includes("Submissions are outside the configured form window")) {
        setShowSubmissionRequest(true);
      } else {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Could not submit the application. Please try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitApprovalRequest = async () => {
    try {
      setRequestSaving(true);
      await client.application.requestAccess({ accessKey, applicantName: requestName.trim(), contactPhone: requestPhone.trim(), requestType: "submission" });
      setShowSubmissionRequest(false);
      setSaveStatus("Approval request sent");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not send the approval request");
    } finally {
      setRequestSaving(false);
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
        setCopiedField(label);
        setTimeout(() => setCopiedField(null), 2000);
      },
      () => undefined,
    );
  };

  if (!hydrated)
    return (
      <div className="grid place-items-center min-h-[50vh] text-muted-foreground">
        Restoring your draft\u2026
      </div>
    );

  const nextDisabledReason = getNextStepReason({
    step: current,
    locationCanProceed,
    location: draft.location,
    duplicateBirthCertificate: duplicate,
    applicant: form.state.values.applicant,
    guardian: form.state.values.guardian,
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
            {(sessionCode || accessKey) && (
              <div className="grid grid-cols-2 gap-3 mt-5 max-w-[900px]">
                {sessionCode && (
                  <div className="grid gap-2 p-4 rounded-[14px] border border-primary/25 bg-primary/5">
                    <div className="flex items-center justify-between gap-3 text-muted-foreground text-[0.76rem] font-bold tracking-wider uppercase">
                      <span>Session code</span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 border-0 rounded-md px-1.5 py-1 text-primary bg-transparent text-[0.72rem] hover:bg-primary/10"
                        aria-label="Copy session code"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyWithFeedback("session", sessionCode);
                        }}
                      >
                        {copiedField === "session" ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
                      </button>
                    </div>
                    <code className="block overflow-wrap-anywhere text-[clamp(1rem,1.5vw,1.18rem)] font-bold tracking-wide">
                      {sessionCode}
                    </code>
                    <span className="block rounded-lg bg-primary/11 px-2.5 py-2 text-primary text-[0.82rem] font-semibold leading-relaxed">
                      Memorise this code to find this child&apos;s application
                      on another device.
                    </span>
                  </div>
                )}
                {accessKey && (
                  <div className="grid gap-2 p-4 rounded-[14px] border border-primary/25 bg-primary/5">
                    <div className="flex items-center justify-between gap-3 text-muted-foreground text-[0.76rem] font-bold tracking-wider uppercase">
                      <span>Access key</span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 border-0 rounded-md px-1.5 py-1 text-primary bg-transparent text-[0.72rem] hover:bg-primary/10"
                        aria-label="Copy access key"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyWithFeedback("key", accessKey);
                        }}
                      >
                        {copiedField === "key" ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
                      </button>
                    </div>
                    <code className="block overflow-wrap-anywhere text-[clamp(1rem,1.5vw,1.18rem)] font-bold tracking-wide">
                      {accessKey}
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
            {accessKey ? "Saved to database" : "Connecting to database"}
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
              setSection={setSection}
              onLocationCanProceed={setLocationCanProceed}
            />
          )}
          {current === 1 && (
            <ApplicantStep
              form={form}
              draft={draft}
              setSection={setSection}
              onDuplicateChange={setDuplicate}
            />
          )}
          {current === 2 && <GuardianStep form={form} />}
          {current === 3 && (
            <ResidenceStep
              form={form}
              draft={draft}
              setSection={setSection}
            />
          )}
          {current === 4 && (
            <DeclarationStep draft={draft} setSection={setSection} />
          )}
          {current === 5 && (
            <ReviewStep
              draft={draft}
              onNavigateToStep={(step) => draft.setStep(step)}
            />
          )}
        </CardContent>

        <div className="flex items-center justify-between gap-4 border-t px-8 py-6">
          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
          {submitted ? (
            <div className="p-6">
              <strong className="text-lg">
                Application submitted successfully.
              </strong>
              <div className="grid gap-3 max-w-[42rem] my-4 p-4 rounded-xl border border-primary/30 bg-primary/7">
                <span className="text-muted-foreground text-sm">
                  Keep this application key safe. You need it to view or update
                  this child&apos;s application.
                </span>
                <code className="block overflow-wrap-anywhere p-3 rounded-lg bg-background text-[0.85rem]">
                  {accessKey}
                </code>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary text-secondary-foreground px-4 py-2 text-sm font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyWithFeedback("keycard", accessKey);
                  }}
                >
                  {copiedField === "keycard" ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy key</>}
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
                      isSubmitting ||
                      collectionOnly ||
                      !draft.declaration.confirmed ||
                      !draft.declaration.consent ||
                      (submittedAt !== null && !hasUnsavedChanges)
                    }
                    onClick={() => void submitApplication()}
                  >
                    {collectionOnly ? (
                      <>
                        <Clock3 size={17} /> Submission opens 9 Sep 2026
                      </>
                    ) : submittedAt ? (
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

        {current === steps.length - 1 && !collectionOnly && !isSubmitting && (() => {
          const reasons: string[] = [];
          if (!draft.declaration.confirmed) reasons.push("Confirm that the information is correct");
          if (!draft.declaration.consent) reasons.push("Give consent to process the data");
          if (submittedAt !== null && !hasUnsavedChanges && reasons.length === 0) reasons.push("No changes to save");
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
                {submissionOpensAt
                  ? new Date(submissionOpensAt).toLocaleString()
                  : "not yet configured"}{" "}
                to{" "}
                {submissionClosesAt
                  ? new Date(submissionClosesAt).toLocaleString()
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

        {showSubmissionRequest && (
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
                  value={requestName}
                  onChange={(e) => setRequestName(e.target.value)}
                />
                <Input
                  placeholder="Contact phone number"
                  value={requestPhone}
                  onChange={(e) => setRequestPhone(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={requestSaving || !requestName.trim() || !requestPhone.trim()}
                  onClick={() => void submitApprovalRequest()}
                >
                  {requestSaving ? "Sending…" : "Send approval request"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowSubmissionRequest(false)}
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
