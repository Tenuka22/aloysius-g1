import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@aloysius-admissions/ui/components/card";
import { Badge } from "@aloysius-admissions/ui/components/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@aloysius-admissions/ui/components/tooltip";

export const Route = createFileRoute("/_auth/g1/admin/data-extraction")({
  component: DataExtractionPage,
});

type FieldEntry = {
  field: string;
  type: string;
  source: string;
  description: string;
  required?: boolean;
};

type FieldGroup = {
  title: string;
  description: string;
  fields: FieldEntry[];
};

const applicantFields: FieldGroup = {
  title: "Applicant Information",
  description: "Personal details of the child applying for admission",
  fields: [
    { field: "applicant.fullName", type: "string", source: "form", description: "Full name of the applicant", required: true },
    { field: "applicant.sinhalaName", type: "string", source: "form", description: "Name in Sinhala script" },
    { field: "applicant.gender", type: "string", source: "form", description: "Gender (male/female)", required: true },
    { field: "applicant.religion", type: "string", source: "form", description: "Religion of the applicant" },
    { field: "applicant.educationMedium", type: "string", source: "form", description: "Medium of education (Sinhala/Tamil/English)" },
    { field: "applicant.dateOfBirth", type: "string (ISO date)", source: "form", description: "Date of birth (YYYY-MM-DD)", required: true },
    { field: "applicant.birthCertificateNumber", type: "string", source: "form", description: "Birth certificate registration number", required: true },
  ],
};

const guardianFields: FieldGroup = {
  title: "Guardian Information",
  description: "Details of the parent or legal guardian",
  fields: [
    { field: "guardian.relationship", type: "string", source: "form", description: "Relationship to applicant (father/mother/guardian)", required: true },
    { field: "guardian.fullName", type: "string", source: "form", description: "Full name of guardian", required: true },
    { field: "guardian.sinhalaName", type: "string", source: "form", description: "Guardian name in Sinhala" },
    { field: "guardian.nic", type: "string", source: "form", description: "National Identity Card number", required: true },
    { field: "guardian.phone", type: "string", source: "form", description: "Primary phone number", required: true },
    { field: "guardian.whatsappPhone", type: "string", source: "form", description: "WhatsApp number (if different)" },
    { field: "guardian.email", type: "string", source: "form", description: "Email address", required: true },
  ],
};

const residenceFields: FieldGroup = {
  title: "Residence Information",
  description: "Address and administrative division details",
  fields: [
    { field: "residence.permanentAddressEn", type: "string", source: "form", description: "Permanent residential address (English)", required: true },
    { field: "residence.permanentAddressSi", type: "string", source: "form", description: "Permanent residential address (Sinhala)" },
    { field: "residence.currentAddressEn", type: "string", source: "form", description: "Current living address (English)" },
    { field: "residence.currentAddressSi", type: "string", source: "form", description: "Current living address (Sinhala)" },
    { field: "residence.sameAsPermanent", type: "boolean", source: "form", description: "Whether current address equals permanent" },
    { field: "residence.district", type: "string", source: "form", description: "District (e.g., Galle)" },
    { field: "residence.dsDivision", type: "string", source: "form", description: "Divisional Secretariat division" },
    { field: "residence.gnDivision", type: "string", source: "form", description: "Grama Niladhari division" },
    { field: "residence.electoralDistrict", type: "string", source: "form", description: "Electoral district" },
  ],
};

const locationFields: FieldGroup = {
  title: "Location Data",
  description: "GPS coordinates and location source tracking",
  fields: [
    { field: "location.label", type: "string", source: "device/map", description: "Location label or name" },
    { field: "location.address", type: "string", source: "device/map", description: "Resolved address" },
    { field: "location.latitude", type: "number | null", source: "device/map", description: "Latitude coordinate (WGS84)" },
    { field: "location.longitude", type: "number | null", source: "device/map", description: "Longitude coordinate (WGS84)" },
    { field: "location.source", type: "enum", source: "system", description: "How location was obtained: manual | device | map | network | admin" },
    { field: "selectedLocation.*", type: "LocationDraft", source: "user", description: "User-selected location from map picker" },
    { field: "defaultLocations[]", type: "LocationDraft[]", source: "system", description: "Pre-populated location options" },
    { field: "deviceLocationHistory[]", type: "LocationDraft[]", source: "device", description: "History of device-captured locations (max 25)" },
    { field: "userLocationHistory[]", type: "LocationDraft[]", source: "user", description: "History of user-picked locations (max 25)" },
  ],
};

const scoringFields61: FieldGroup = {
  title: "6.1 - Residence Verification & Proximity",
  description: "Scoring inputs for proximity-based admission category",
  fields: [
    { field: "scoringInputs.mainDocumentType", type: "string", source: "form", description: "Main residence document type (title-deed-applicant, title-deed-parents, feeder-electoral-5yrs, lease-deed, municipal-ds-certificate, other-documents)" },
    { field: "scoringInputs.documentOwnership", type: "string", source: "form", description: "Who owns the document (applicant/parents/spouse)" },
    { field: "scoringInputs.deedTransferDate", type: "string (ISO date)", source: "form", description: "Date the deed was transferred (affects age-weight multiplier)" },
    { field: "scoringInputs.additionalDocs[]", type: "string[]", source: "form", description: "List of additional supporting document types" },
    { field: "scoringInputs.electoralMotherYears[]", type: "number[]", source: "form", description: "Years mother is registered in the electoral register, checked individually (dynamic 5-year window, see electoralRegisterYears())" },
    { field: "scoringInputs.electoralFatherYears[]", type: "number[]", source: "form", description: "Years father is registered in the electoral register, checked individually (dynamic 5-year window, see electoralRegisterYears())" },
    { field: "scoringInputs.schoolsWithinRadius[]", type: "string[]", source: "map", description: "IDs of schools within the home-to-applied-school radius" },
    { field: "scoringInputs.schoolsRadiusKm", type: "number", source: "map", description: "Radius distance in km from home to applied school" },
  ],
};

const scoringFields62: FieldGroup = {
  title: "6.2 - Alumni",
  description: "Scoring inputs for past-pupil admission category",
  fields: [
    { field: "scoringInputs.alumniStartDate", type: "string (ISO date)", source: "form", description: "Start date of alumni's education at school" },
    { field: "scoringInputs.alumniEndDate", type: "string (ISO date)", source: "form", description: "End date of alumni's education at school" },
    { field: "scoringInputs.grade5ScholarshipPassed", type: "boolean", source: "form", description: "Whether alumni passed Grade 5 Scholarship" },
    { field: "scoringInputs.olSubjectCount", type: "number", source: "form", description: "Number of O/L subjects (6, 8, or 9)" },
    { field: "scoringInputs.olGradeS", type: "number", source: "form", description: "Count of S-grade subjects in O/L" },
    { field: "scoringInputs.olGradeC", type: "number", source: "form", description: "Count of C-grade subjects in O/L" },
    { field: "scoringInputs.olGradeB", type: "number", source: "form", description: "Count of B/D-grade subjects in O/L" },
    { field: "scoringInputs.olGradeA", type: "number", source: "form", description: "Count of A-grade subjects in O/L (9-subject only)" },
    { field: "scoringInputs.alSubjectCount", type: "number", source: "form", description: "Number of A/L subjects (3 or 4)" },
    { field: "scoringInputs.alGradeS", type: "number", source: "form", description: "Count of S-grade subjects in A/L" },
    { field: "scoringInputs.alGradeC", type: "number", source: "form", description: "Count of C-grade subjects in A/L" },
    { field: "scoringInputs.alGradeB", type: "number", source: "form", description: "Count of B-grade subjects in A/L" },
    { field: "scoringInputs.alGradeA", type: "number", source: "form", description: "Count of A-grade subjects in A/L" },
    { field: "scoringInputs.sportsEntries", type: "Array<{name?, level?}>", source: "form", description: "Up to 5 named sports, each with its own competition level: inter-house | zonal | district | provincial | national | international" },
    { field: "scoringInputs.leadershipRole", type: "string", source: "form", description: "Leadership role held: prefect-primary | junior | senior | deputy-hp | head-prefect | vice-captain | captain" },
    { field: "scoringInputs.studentSocietiesRole", type: "string", source: "form", description: "Society role: committee-member | vice-president | president" },
    { field: "scoringInputs.studentSocietiesCount", type: "number", source: "form", description: "Number of societies held at that role, marks summed and capped at 5" },
    { field: "scoringInputs.otherActivities", type: "string[]", source: "form", description: "Other activities selected (multiple allowed): band, scouts, cadets, debating, St John's, other - marks summed and capped at 5" },
    { field: "scoringInputs.otherActivityName", type: "string", source: "form", description: "Custom activity name if 'other' selected" },
    { field: "scoringInputs.pastPupilsLifeMember", type: "boolean", source: "form", description: "Whether alumni is a life member of Past Pupils' Association (switches scoring to the life-member rate below)" },
    { field: "scoringInputs.pastPupilsLifeMemberStart", type: "string (ISO date)", source: "form", description: "Date became a life member; 1 mark/year, max 10" },
    { field: "scoringInputs.pastPupilsMembershipStart", type: "string (ISO date)", source: "form", description: "Start of PPA membership period" },
    { field: "scoringInputs.pastPupilsMembershipEnd", type: "string (ISO date)", source: "form", description: "End of PPA membership period (regular, non-life membership); 0.5 marks/year, max 10" },
    { field: "scoringInputs.pastPupilsCommitteeYears", type: "number", source: "form", description: "Years/terms served on PPA committee (0.25 marks/yr, max 3)" },
    { field: "scoringInputs.pastPupilsExecutiveCount", type: "number", source: "form", description: "PPA executive office posts held, up to 2 (1.5 marks/post; committee + executive combined, max 3)" },
    { field: "scoringInputs.highestDegree", type: "string", source: "form", description: "Highest degree: first-degree | postgraduate | doctorate | chartered-professional" },
    { field: "scoringInputs.hasDiploma", type: "boolean", source: "form", description: "Whether alumni has diploma/NVQ 5-6" },
    { field: "scoringInputs.sportsMeetContribution", type: "number", source: "form", description: "Times contributed to school sports meet (0.5 marks each)" },
    { field: "scoringInputs.shramadanaContribution", type: "number", source: "form", description: "Times participated in Shramadana campaigns (0.5 marks each); sports meet + shramadana combined, max 2" },
    { field: "scoringInputs.schoolProjectsContribution", type: "boolean", source: "form", description: "Contributed to school projects" },
    { field: "scoringInputs.schoolProjectsDescription", type: "string", source: "form", description: "Free-text description of the school project(s) contributed to" },
  ],
};

const scoringFields63: FieldGroup = {
  title: "6.3 - Siblings",
  description: "Scoring inputs for sibling-based admission category",
  fields: [
    { field: "scoringInputs.siblingGradesCompletedCount", type: "number", source: "form", description: "Grades completed by the sibling at this school, one sibling only (max 10)" },
    { field: "scoringInputs.siblingStudiedAtAppliedSchool", type: "boolean", source: "form", description: "Whether the sibling was admitted to Grade 1 and is currently studying at this school" },
    { field: "scoringInputs.twoOrMoreSiblingsStudyingOtherGrades", type: "boolean", source: "form", description: "Whether 2+ siblings are currently studying in other grades of the same school" },
    { field: "scoringInputs.siblingSportsEntries", type: "array<{name?, levels?}>", source: "form", description: "Sibling co-curricular/sports skills table (up to 3 named activities), each with checked levels: inter-house | zonal | district | provincial | national | international" },
    { field: "scoringInputs.siblingExamAchievements", type: "string[]", source: "form", description: "Checked sibling exam achievements (any of): scholarship | ol | al, summed and capped at 2 marks" },
    { field: "scoringInputs.siblingLeadershipAchievement", type: "boolean", source: "form", description: "Sibling held a leadership role (Prefect / Student Leader / Scout)" },
    { field: "scoringInputs.parentsSupportRendered", type: "boolean", source: "form", description: "Parents rendered support to school" },
    { field: "scoringInputs.parentsSupportDescription", type: "string", source: "form", description: "Free-text description of the support parents rendered (shown only when parentsSupportRendered is checked)" },
  ],
};

const scoringFields64: FieldGroup = {
  title: "6.4 - Education Sector / Teaching Staff",
  description: "Scoring inputs for the education sector / teaching staff admission category",
  fields: [
    { field: "scoringInputs.contributionPath", type: "enum", source: "form", description: "7.5.1 eligibility gate: institution | university - earning zero here zeroes the rest of category 6.4" },
    { field: "scoringInputs.contributionSameSchool", type: "boolean", source: "form", description: "Institution path: whether the current station is the very school being applied to (2/yr vs 1.5/yr)" },
    { field: "scoringInputs.contributionServiceStartDate", type: "string (ISO date)", source: "form", description: "Institution path: date started at current qualifying station" },
    { field: "scoringInputs.contributionExamYears", type: "number", source: "form", description: "University path: years involved with national exams (0.5/yr, max 2.5)" },
    { field: "scoringInputs.contributionCurriculumYears", type: "number", source: "form", description: "University path: years involved with NIE curriculum development (0.5/yr, max 2.5)" },
    { field: "scoringInputs.contributionTrainingYears", type: "number", source: "form", description: "University path: years involved with national teacher-training programmes (0.5/yr, max 2.5)" },
    { field: "scoringInputs.serviceStartDate", type: "string (ISO date)", source: "form", description: "Start date of teaching / education-sector service" },
    { field: "scoringInputs.difficultServiceType", type: "enum", source: "form", description: "Difficult service status: current | previous | none" },
    { field: "scoringInputs.difficultServiceStartDate", type: "string (ISO date)", source: "form", description: "Current branch: date started at this difficult station (5 marks/yr, max 25)" },
    { field: "scoringInputs.difficultServicePreviousStartDate", type: "string (ISO date)", source: "form", description: "Previous branch: date started at that difficult station" },
    { field: "scoringInputs.difficultServicePreviousEndDate", type: "string (ISO date)", source: "form", description: "Previous branch: date service there ended" },
    { field: "scoringInputs.difficultServiceDistanceStartDate", type: "string (ISO date)", source: "form", description: "Distance branch: date started at the far first-appointment station (independent of the previous-difficult-service dates)" },
    { field: "scoringInputs.difficultServiceDistanceEndDate", type: "string (ISO date)", source: "form", description: "Distance branch: date service there ended" },
    { field: "scoringInputs.difficultServiceDistanceKm", type: "number", source: "form", description: "Distance from permanent residence to first appointment (km)" },
    { field: "scoringInputs.unutilizedLeaveYears", type: "number", source: "form", description: "Years of unutilized leave (>20 days)" },
    { field: "scoringInputs.residenceToSchoolKm", type: "number", source: "map", description: "Distance from permanent residence to applied school (km)" },
    { field: "scoringInputs.workplaceToSchoolKm", type: "number", source: "map", description: "Distance from current workplace to applied school (km)" },
  ],
};

const scoringFields65: FieldGroup = {
  title: "6.5 - Transfer Applications",
  description: "Scoring inputs for the transferred government / public service employee admission category",
  fields: [
    { field: "scoringInputs.previousWorkplaceDistanceKm", type: "number", source: "form", description: "Distance from previous to new workplace (km, min 50)" },
    { field: "scoringInputs.previousWorkplaceStartDate", type: "string (ISO date)", source: "form", description: "Start date at previous workplace" },
    { field: "scoringInputs.transferDate", type: "string (ISO date)", source: "form", description: "Date of transfer (must be within 5 years)" },
  ],
};

const scoringFields66: FieldGroup = {
  title: "6.6 - Foreign Employment",
  description: "Scoring inputs for foreign employment admission category",
  fields: [
    { field: "scoringInputs.abroadStartDate", type: "string (ISO date)", source: "form", description: "Start date of foreign employment period" },
    { field: "scoringInputs.abroadEndDate", type: "string (ISO date)", source: "form", description: "End date of foreign employment period" },
    { field: "scoringInputs.employmentPurpose", type: "enum", source: "form", description: "Purpose: diplomatic | government | education | employment" },
  ],
};

const systemFields: FieldGroup = {
  title: "System & Session",
  description: "Internal system fields for session management and submission state",
  fields: [
    { field: "accessKey", type: "string (UUID)", source: "system", description: "Unique access key for this application session", required: true },
    { field: "sessionCode", type: "string", source: "system", description: "Session identifier for device tracking" },
    { field: "currentStep", type: "number", source: "system", description: "Currently active form step (0-indexed)" },
    { field: "maxVisitedStep", type: "number", source: "system", description: "Highest step the user has visited" },
    { field: "lastSavedAt", type: "string (ISO datetime) | null", source: "system", description: "Timestamp of last auto-save" },
    { field: "submittedAt", type: "string (ISO datetime) | null", source: "system", description: "Timestamp when application was submitted" },
    { field: "submissionLocked", type: "boolean", source: "system", description: "Whether the form is locked after submission" },
    { field: "duplicateBirthCertificate", type: "boolean", source: "system", description: "Whether this birth certificate number AND guardian NIC together match an already-submitted application" },
    { field: "locationCanProceed", type: "boolean", source: "system", description: "Whether the location step allows proceeding" },
    { field: "admissionStatus", type: "string", source: "admin", description: "Admission decision status (pending | accepted | rejected)" },
    { field: "interviewNotes", type: "string", source: "admin", description: "Admin notes from interview review" },
    { field: "isBanned", type: "boolean", source: "admin", description: "Whether applicant is banned" },
    { field: "banReason", type: "string | null", source: "admin", description: "Reason for ban" },
    { field: "flags[]", type: "Array<{type, key, label}>", source: "system", description: "System-generated flags for this application" },
    { field: "interviewEdits[]", type: "InterviewEdit[]", source: "admin", description: "History of admin edits during review" },
  ],
};

const allGroups = [
  applicantFields,
  guardianFields,
  residenceFields,
  locationFields,
  scoringFields61,
  scoringFields62,
  scoringFields63,
  scoringFields64,
  scoringFields65,
  scoringFields66,
  systemFields,
];

const sourceColors: Record<string, string> = {
  form: "bg-blue-600/30 text-blue-900",
  device: "bg-emerald-600/30 text-emerald-900",
  map: "bg-amber-600/30 text-amber-900",
  system: "bg-zinc-600/25 text-zinc-900",
  admin: "bg-rose-600/30 text-rose-900",
  user: "bg-violet-600/30 text-violet-900",
};

function DataExtractionPage() {
  const totalFields = allGroups.reduce((sum, g) => sum + g.fields.length, 0);
  const requiredFields = allGroups.reduce((sum, g) => sum + g.fields.filter((f) => f.required).length, 0);

  return (
    <TooltipProvider>
      <main className="min-h-svh overflow-hidden bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)] p-4 md:p-6 xl:p-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Admin / Reference</p>
            <h1 className="mt-1 font-heading text-[clamp(1.7rem,3vw,2.6rem)] leading-tight">Data extraction</h1>
            <p className="mt-1.5 max-w-[60ch] text-sm text-muted-foreground">
              All fields captured by the application form, their data types, sources, and which scoring categories they feed.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            <div className="rounded-xl border bg-card px-4 py-3">
              <span className="block text-2xl font-bold tabular-nums">{totalFields}</span>
              <span className="text-xs text-muted-foreground">Total fields</span>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3">
              <span className="block text-2xl font-bold tabular-nums">{requiredFields}</span>
              <span className="text-xs text-muted-foreground">Required</span>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3">
              <span className="block text-2xl font-bold tabular-nums">{allGroups.length}</span>
              <span className="text-xs text-muted-foreground">Field groups</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {Object.entries(sourceColors).map(([key, cls]) => (
                <span key={key} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${cls}`}>
                  <span className="size-1.5 rounded-full bg-current" /> {key}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {allGroups.map((group) => (
              <Card key={group.title} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="border-b px-4 py-3">
                    <h2 className="text-sm font-semibold">{group.title}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Field</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Type</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Source</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.fields.map((f, i) => (
                          <tr key={f.field} className={`hover:bg-muted/30 transition-colors ${i < group.fields.length - 1 ? "border-b border-border/40" : ""}`}>
                            <td className="px-4 py-2">
                              <code className="text-xs font-mono bg-muted/60 rounded px-1.5 py-0.5">{f.field}</code>
                              {f.required && <span className="ml-1 text-rose-500 text-xs">*</span>}
                            </td>
                            <td className="px-4 py-2">
                              <span className="text-xs text-muted-foreground">{f.type}</span>
                            </td>
                            <td className="px-4 py-2">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${sourceColors[f.source] ?? sourceColors.system}`}>
                                {f.source}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs text-muted-foreground max-w-xs">{f.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </TooltipProvider>
  );
}
