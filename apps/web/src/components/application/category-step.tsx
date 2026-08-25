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
import { SchoolMapPicker } from "./school-map-picker";
import { scoreCategory } from "@/lib/scoring";

const CATEGORY_LABELS: Record<CategoryType, string> = {
  "6.1": "6.1 – Residence Verification & Proximity",
  "6.2": "6.2 – Educational Qualifications & Co-Curricular Achievements",
  "6.3": "6.3 – Siblings",
  "6.4": "6.4 – Period of Service & Distance",
  "6.5": "6.5 – Transfer Applications",
  "6.6": "6.6 – Foreign Employment",
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
  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <DocumentTypeSelect category={category} onChange={onChange} />
      <NumberField
        id={`years-registered-${category.id}`}
        label="Years registered at this address"
        value={inputs.yearsRegistered}
        onChange={(yearsRegistered) => onChange({ yearsRegistered })}
      />
      <AdditionalDocsCheckboxGroup category={category} onChange={onChange} />
      <YearsSelect
        id={`electoral-mother-years-${category.id}`}
        label="Mother on electoral register (years)"
        value={inputs.electoralMotherYears}
        onChange={(electoralMotherYears) => onChange({ electoralMotherYears })}
      />
      <YearsSelect
        id={`electoral-father-years-${category.id}`}
        label="Father on electoral register (years)"
        value={inputs.electoralFatherYears}
        onChange={(electoralFatherYears) => onChange({ electoralFatherYears })}
      />
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
  onChange,
}: {
  category: CategoryApplication;
  prefix: string;
  grades: readonly string[];
  onChange: (patch: Partial<ScoringInputs>) => void;
}) {
  const keyFor = (grade: string) => `${prefix}Grade${grade}` as keyof ScoringInputs;
  return (
    <div className="col-span-2 grid grid-cols-4 gap-3 max-md:col-span-1 max-md:grid-cols-2">
      {grades.map((grade) => {
        const key = keyFor(grade);
        return (
          <NumberField
            key={`${category.id}-${key}`}
            id={`${prefix}-grade-${grade}-${category.id}`}
            label={`${grade} passes`}
            value={category.scoringInputs[key] as number | undefined}
            onChange={(next) => onChange({ [key]: next } as Partial<ScoringInputs>)}
          />
        );
      })}
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
  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <NumberField
        id={`alumni-years-${id}`}
        label="Years educated at this school"
        value={inputs.alumniYearsAtSchool}
        onChange={(alumniYearsAtSchool) => onChange({ alumniYearsAtSchool })}
      />
      <label className="mt-1 flex items-center gap-2 self-end text-sm">
        <Checkbox
          className="size-4"
          checked={inputs.grade5ScholarshipPassed === true}
          onCheckedChange={(checked) => onChange({ grade5ScholarshipPassed: checked === true })}
        />
        Passed Grade 5 Scholarship Examination
      </label>
      <CountSelect
        id={`ol-subject-count-${id}`}
        label="G.C.E. (O/L) result"
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
          onChange={onChange}
        />
      )}
      <CountSelect
        id={`al-subject-count-${id}`}
        label="G.C.E. (A/L) result"
        value={inputs.alSubjectCount}
        options={AL_SUBJECT_OPTIONS}
        placeholder="Select A/L subject count"
        onChange={(alSubjectCount) => onChange({ alSubjectCount })}
      />
      {inputs.alSubjectCount != null && (
        <GradeCounts category={category} prefix="al" grades={["S", "C", "B", "A"]} onChange={onChange} />
      )}
      <StringSelect
        id={`sports-level-${id}`}
        label="Highest sports / co-curricular level"
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
      <StringSelect
        id={`leadership-role-${id}`}
        label="Highest leadership role held"
        value={inputs.leadershipRole}
        options={LEADERSHIP_ROLE_OPTIONS}
        placeholder="Select leadership role"
        onChange={(leadershipRole) => onChange({ leadershipRole })}
      />
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
  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <NumberField
        id={`siblings-count-${id}`}
        label="Siblings currently studying at this school"
        value={inputs.siblingsCurrentlyStudyingCount}
        onChange={(siblingsCurrentlyStudyingCount) => onChange({ siblingsCurrentlyStudyingCount })}
      />
      <label className="mt-1 flex items-center gap-2 self-end text-sm">
        <Checkbox
          className="size-4"
          checked={inputs.siblingStudiedAtAppliedSchool === true}
          onCheckedChange={(checked) => onChange({ siblingStudiedAtAppliedSchool: checked === true })}
        />
        Applying to the school where the sibling studied
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          className="size-4"
          checked={inputs.twoOrMoreSiblingsApplying === true}
          onCheckedChange={(checked) => onChange({ twoOrMoreSiblingsApplying: checked === true })}
        />
        Two or more siblings applying to other grades of the same school
      </label>
      <StringSelect
        id={`sibling-prefect-level-${id}`}
        label="Sibling prefect skill level (Primary / Junior)"
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
      <DocumentTypeSelect category={category} onChange={onChange} options={SIBLING_DOCUMENT_OPTIONS} />
      <YearsSelect
        id={`electoral-mother-years-${id}`}
        label="Mother on electoral register (years)"
        value={inputs.electoralMotherYears}
        onChange={(electoralMotherYears) => onChange({ electoralMotherYears })}
      />
      <YearsSelect
        id={`electoral-father-years-${id}`}
        label="Father on electoral register (years)"
        value={inputs.electoralFatherYears}
        onChange={(electoralFatherYears) => onChange({ electoralFatherYears })}
      />
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
  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <NumberField
        id={`service-years-${category.id}`}
        label="Period of service (years)"
        value={inputs.periodOfServiceYears}
        onChange={(periodOfServiceYears) => onChange({ periodOfServiceYears })}
      />
      <Field className="col-span-2 max-md:col-span-1">
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
        <>
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
        </>
      )}
      <YearsSelect
        id={`unutilized-leave-${category.id}`}
        label="Unutilized leave (years)"
        value={inputs.unutilizedLeaveYears}
        onChange={(unutilizedLeaveYears) => onChange({ unutilizedLeaveYears })}
      />
      <Field className="col-span-2 max-md:col-span-1">
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
      <NumberField
        id={`residence-to-school-${category.id}`}
        label="Residence to school distance (km)"
        value={inputs.residenceToSchoolKm}
        onChange={(residenceToSchoolKm) => onChange({ residenceToSchoolKm })}
      />
      <NumberField
        id={`workplace-to-school-${category.id}`}
        label="Workplace to school distance (km)"
        value={inputs.workplaceToSchoolKm}
        onChange={(workplaceToSchoolKm) => onChange({ workplaceToSchoolKm })}
      />
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
  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <NumberField
        id={`prev-workplace-distance-${category.id}`}
        label="Previous workplace distance (km)"
        value={inputs.previousWorkplaceDistanceKm}
        onChange={(previousWorkplaceDistanceKm) => onChange({ previousWorkplaceDistanceKm })}
      />
      <NumberField
        id={`transfer-service-years-${category.id}`}
        label="Period of service (years)"
        value={inputs.periodOfServiceYears}
        onChange={(periodOfServiceYears) => onChange({ periodOfServiceYears })}
      />
      <NumberField
        id={`prev-workplace-years-${category.id}`}
        label="Time at previous workplace (years)"
        value={inputs.previousWorkplacePeriodYears}
        onChange={(previousWorkplacePeriodYears) => onChange({ previousWorkplacePeriodYears })}
      />
      <NumberField
        id={`transfer-elapsed-years-${category.id}`}
        label="Years since transfer request (years)"
        value={inputs.transferElapsedYears}
        onChange={(transferElapsedYears) => onChange({ transferElapsedYears })}
      />
      <YearsSelect
        id={`transfer-unutilized-leave-${category.id}`}
        label="Unutilized leave (years)"
        value={inputs.unutilizedLeaveYears}
        onChange={(unutilizedLeaveYears) => onChange({ unutilizedLeaveYears })}
      />
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
  return (
    <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <NumberField
        id={`abroad-years-${category.id}`}
        label="Period abroad (years)"
        value={inputs.periodAbroadYears}
        onChange={(periodAbroadYears) => onChange({ periodAbroadYears })}
      />
      <Field className="col-span-2 max-md:col-span-1">
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
  const selectedSchoolIds = category.scoringInputs.schoolsWithinRadius ?? [];
  const score = scoreCategory(category);
  const hasCenter = centerLat != null && centerLng != null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {CATEGORY_LABELS[category.categoryType]}
          {occurrence != null && (
            <span className="text-muted-foreground font-normal"> — entry {occurrence}</span>
          )}
        </CardTitle>
        <CardAction>
          <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onRemove}>
            Remove
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-5">
        {category.categoryType === "6.1" && <Category61Fields category={category} onChange={onUpdate} />}
        {category.categoryType === "6.2" && <Category62Fields category={category} onChange={onUpdate} />}
        {category.categoryType === "6.3" && <Category63Fields category={category} onChange={onUpdate} />}
        {category.categoryType === "6.4" && <Category64Fields category={category} onChange={onUpdate} />}
        {category.categoryType === "6.5" && <Category65Fields category={category} onChange={onUpdate} />}
        {category.categoryType === "6.6" && <Category66Fields category={category} onChange={onUpdate} />}
        {hasCenter ? (
          <div className="grid gap-2 border-t pt-5">
            <p className="text-sm font-medium">Nearby schools</p>
            <p className="text-sm text-muted-foreground">
              Select the schools within reach of the home location. Choices apply to this category&apos;s proximity scoring.
            </p>
            <SchoolMapPicker
              centerLat={centerLat}
              centerLng={centerLng}
              selectedIds={selectedSchoolIds}
              onToggle={(schoolId) =>
                onUpdate({
                  schoolsWithinRadius: selectedSchoolIds.includes(schoolId)
                    ? selectedSchoolIds.filter((existing) => existing !== schoolId)
                    : [...selectedSchoolIds, schoolId],
                })
              }
            />
          </div>
        ) : (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            Complete the location step to choose nearby schools for this category.
          </p>
        )}
        <div className="grid gap-2 border-t pt-5">
          <p className="text-sm font-medium">Example marks — {CATEGORY_LABELS[category.categoryType]}</p>
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

  return (
    <div className="grid gap-6 max-w-[860px]">
      <div className="mb-1">
        <h3 className="font-heading text-2xl">Marking scheme categories</h3>
        <p className="text-sm text-muted-foreground">
          Add every circular category that applies to your application. A category can be added more than once — for
          example one entry per parent&apos;s service record — and each entry lists the schools near the home location.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {CATEGORY_TYPES.map((type) => (
          <Button
            key={type}
            type="button"
            variant="outline"
            className="justify-start"
            onClick={() => draft.addCategory(type)}
          >
            + Add {CATEGORY_LABELS[type]}
          </Button>
        ))}
      </div>

      <div className="grid gap-5">
        {draft.categories.map((category, index) => {
          const occurrence =
            draft.categories.filter((existing) => existing.categoryType === category.categoryType).length > 1
              ? draft.categories
                  .slice(0, index + 1)
                  .filter((existing) => existing.categoryType === category.categoryType).length
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
    </div>
  );
}
