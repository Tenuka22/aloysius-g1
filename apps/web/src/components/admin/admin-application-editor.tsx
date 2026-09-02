import { useEffect, useMemo, useState } from "react";
import { Check, CircleAlert, MapPin, Save, X, User, Phone, Mail, Calendar, CreditCard, Hash, Map, FileText, Building, Globe, ChevronRight, CircleDot, Settings, Eye, EyeOff, LayoutGrid, Rows3 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";
import { divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { client, orpc } from "@/utils/orpc";
import { emptyDraft, normalizeDraft, prependLocationHistory, type ApplicationDraft, type CategoryApplication, type CategoryType, type LocationDraft, type ScoringInputs } from "@/lib/application-store";
import { scoreCategory } from "@/lib/scoring";
import { CATEGORY_MAX_MARKS } from "@/lib/marking-scheme";
import { findSchoolById } from "@/lib/school-utils";
import { toast } from "sonner";
import { useAdminPreferences, isFieldVisible, type AdminFieldVisibility } from "@/lib/admin-preferences";

import { Button } from "@aloysius-g1/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@aloysius-g1/ui/components/card";
import { Checkbox } from "@aloysius-g1/ui/components/checkbox";
import { Input } from "@aloysius-g1/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aloysius-g1/ui/components/select";
import { Badge } from "@aloysius-g1/ui/components/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aloysius-g1/ui/components/tabs";
import { Category61Fields, Category62Fields, Category63Fields, Category64Fields, Category66Fields } from "@/components/application/category-step";

const sections = [
  ["applicant", "Applicant"],
  ["guardian", "Parent / guardian"],
  ["residence", "Residence"],
  ["declaration", "Declaration"],
] as const;

const SECTION_FIELD_LABELS: Record<string, Record<string, string>> = {
  applicant: {
    fullName: "Full name (English)",
    sinhalaName: "Full name (Sinhala)",
    gender: "Gender",
    religion: "Religion",
    educationMedium: "Education medium",
    dateOfBirth: "Date of birth",
    birthCertificateNumber: "Birth certificate number",
  },
  guardian: {
    relationship: "Relationship to applicant",
    fullName: "Full name (English)",
    sinhalaName: "Full name (Sinhala)",
    nic: "NIC number",
    phone: "Phone number",
    whatsappPhone: "WhatsApp number",
    email: "Email address",
  },
  residence: {
    permanentAddress: "Permanent address",
    currentAddress: "Current address",
    district: "District",
    dsDivision: "DS division",
    gnDivision: "GN division",
    electoralDistrict: "Electoral district",
  },
  declaration: {
    confirmed: "Information confirmed",
    consent: "Consent given",
  },
};

const SECTION_FIELD_HINTS: Record<string, Record<string, string>> = {
  applicant: {
    dateOfBirth: "YYYY-MM-DD",
    birthCertificateNumber: "e.g. 202012345678",
  },
  guardian: {
    nic: "e.g. 200012345678",
    phone: "e.g. +94 77 123 4567",
    whatsappPhone: "e.g. +94 77 123 4567",
    email: "e.g. name@example.com",
  },
};

const SECTION_FIELD_TYPES: Record<string, Record<string, FieldType>> = {
  applicant: {
    fullName: "name",
    sinhalaName: "name",
    gender: "select",
    religion: "select",
    educationMedium: "select",
    dateOfBirth: "date",
    birthCertificateNumber: "document",
  },
  guardian: {
    relationship: "select",
    fullName: "name",
    sinhalaName: "name",
    nic: "nic",
    phone: "phone",
    whatsappPhone: "phone",
    email: "email",
  },
  residence: {
    permanentAddress: "address",
    currentAddress: "address",
    district: "select",
    dsDivision: "select",
    gnDivision: "select",
    electoralDistrict: "select",
  },
  declaration: {
    confirmed: "boolean",
    consent: "boolean",
  },
};

const CATEGORY_LABELS: Record<CategoryType, string> = {
  "6.1": "6.1 – Residence Verification & Proximity",
  "6.2": "6.2 – Alumni",
  "6.3": "6.3 – Siblings",
  "6.4": "6.4 – Period of Service & Distance",
  "6.5": "6.5 – Transfer Applications",
  "6.6": "6.6 – Foreign Employment",
};

const DIFFICULT_SERVICE_TYPES = ["current", "previous", "none"] as const;
const EMPLOYMENT_PURPOSES = ["board", "personal", "government", "education"] as const;
const SPORTS_LEVELS = ["none", "inter-house", "zonal", "district", "provincial", "national", "international"] as const;
const SIBLING_EXAM_ACHIEVEMENTS = ["none", "scholarship", "ol", "al"] as const;
const LEADERSHIP_ROLES = [
  "none",
  "prefect-primary",
  "prefect-junior",
  "prefect-senior",
  "deputy-head-prefect",
  "head-prefect",
  "first-team-vice-captain",
  "first-team-captain",
] as const;
const STUDENT_SOCIETIES_ROLES = ["none", "committee-member", "vice-president", "president"] as const;
const OTHER_ACTIVITIES = [
  "none",
  "junior-band-leader",
  "junior-band-member",
  "senior-band-leader",
  "senior-band-member",
  "scout-leader",
  "scout-member",
  "cub-scout",
  "cadet-team-leader",
  "cadet-team-member",
  "debating-team-leader",
  "debating-team-member",
  "st-john-ambulance-leader",
  "st-john-ambulance-member",
  "other",
] as const;
const DEGREE_LEVELS = ["none", "first-degree", "postgraduate", "doctorate", "chartered-professional"] as const;

type CategoryTextFieldKey = "mainDocumentType" | "documentOwnership" | "serviceLocationLevel" | "studentSocietiesRole" | "otherActivity" | "otherActivityName" | "highestDegree";
type CategoryDateFieldKey = "deedTransferDate" | "serviceStartDate" | "previousWorkplaceStartDate" | "transferDate" | "abroadStartDate" | "abroadEndDate" | "alumniStartDate" | "alumniEndDate" | "pastPupilsMembershipStart" | "pastPupilsMembershipEnd";
type CategoryNumberFieldKey = "electoralMotherSince" | "electoralFatherSince" | "schoolsRadiusKm" | "difficultServiceDistanceKm" | "difficultServiceExtraPeriods" | "unutilizedLeaveYears" | "residenceToSchoolKm" | "workplaceToSchoolKm" | "previousWorkplaceDistanceKm" | "olSubjectCount" | "olGradeS" | "olGradeC" | "olGradeB" | "olGradeA" | "alSubjectCount" | "alGradeS" | "alGradeC" | "alGradeB" | "alGradeA" | "sportsCount" | "siblingsCurrentlyStudyingCount" | "siblingPrefectCount";
type CategoryBooleanFieldKey = "grade5ScholarshipPassed" | "pastPupilsLifeMember" | "pastPupilsCommitteeMember" | "pastPupilsExecutiveOffice" | "hasDiploma" | "sportsMeetContribution" | "shramadanaContribution" | "schoolProjectsContribution";

const CATEGORY_TEXT_FIELDS: Array<[CategoryTextFieldKey, string]> = [
  ["mainDocumentType", "Main document type"],
  ["documentOwnership", "Document ownership"],
  ["serviceLocationLevel", "Service location level"],
  ["studentSocietiesRole", "Student societies role"],
  ["otherActivity", "Other activity"],
  ["otherActivityName", "Other activity name"],
  ["highestDegree", "Highest degree"],
];

const CATEGORY_DATE_FIELDS: Array<[CategoryDateFieldKey, string]> = [
  ["deedTransferDate", "Deed transfer date"],
  ["serviceStartDate", "Service start date"],
  ["previousWorkplaceStartDate", "Previous workplace start date"],
  ["transferDate", "Transfer date"],
  ["abroadStartDate", "Abroad start date"],
  ["abroadEndDate", "Abroad end date"],
  ["alumniStartDate", "Alumni start date"],
  ["alumniEndDate", "Alumni end date"],
  ["pastPupilsMembershipStart", "Past Pupils membership start date"],
  ["pastPupilsMembershipEnd", "Past Pupils membership end date"],
];

const CATEGORY_NUMBER_FIELDS: Array<[CategoryNumberFieldKey, string]> = [
  ["electoralMotherSince", "Electoral mother year"],
  ["electoralFatherSince", "Electoral father year"],
  ["schoolsRadiusKm", "Schools radius km"],
  ["difficultServiceDistanceKm", "Difficult service distance km"],
  ["difficultServiceExtraPeriods", "Difficult service extra periods"],
  ["unutilizedLeaveYears", "Unutilized leave years"],
  ["residenceToSchoolKm", "Residence to school km"],
  ["workplaceToSchoolKm", "Workplace to school km"],
  ["previousWorkplaceDistanceKm", "Previous workplace distance km"],
  ["olSubjectCount", "O/L subject count"],
  ["olGradeS", "O/L S passes"],
  ["olGradeC", "O/L C passes"],
  ["olGradeB", "O/L B passes"],
  ["olGradeA", "O/L A passes"],
  ["alSubjectCount", "A/L subject count"],
  ["alGradeS", "A/L S passes"],
  ["alGradeC", "A/L C passes"],
  ["alGradeB", "A/L B passes"],
  ["alGradeA", "A/L A passes"],
  ["sportsCount", "Sports achievements count"],
  ["siblingsCurrentlyStudyingCount", "Siblings currently studying"],
  ["siblingPrefectCount", "Sibling prefect achievement count"],
];

const CATEGORY_BOOLEAN_FIELDS: Array<[CategoryBooleanFieldKey, string]> = [
  ["grade5ScholarshipPassed", "Grade 5 Scholarship passed"],
  ["pastPupilsLifeMember", "Past Pupils life member"],
  ["pastPupilsCommitteeMember", "Past Pupils committee member"],
  ["pastPupilsExecutiveOffice", "Past Pupils executive office"],
  ["hasDiploma", "Has Diploma / Higher Diploma"],
  ["sportsMeetContribution", "Sports Meet contribution"],
  ["shramadanaContribution", "Shramadana contribution"],
  ["schoolProjectsContribution", "School Projects contribution"],
];

const SCORING_INPUT_SUMMARY_ROWS: Array<[keyof ScoringInputs, string]> = [
  ["mainDocumentType", "Main document type"],
  ["documentOwnership", "Document ownership"],
  ["deedTransferDate", "Deed transfer date"],
  ["additionalDocs", "Additional docs"],
  ["electoralMotherSince", "Electoral mother year"],
  ["electoralFatherSince", "Electoral father year"],
  ["schoolsRadiusKm", "Schools radius km"],
  ["grade5ScholarshipPassed", "Grade 5 Scholarship passed"],
  ["alumniStartDate", "Alumni start date"],
  ["alumniEndDate", "Alumni end date"],
  ["olSubjectCount", "O/L subject count"],
  ["olGradeS", "O/L S passes"],
  ["olGradeC", "O/L C passes"],
  ["olGradeB", "O/L B passes"],
  ["olGradeA", "O/L A passes"],
  ["alSubjectCount", "A/L subject count"],
  ["alGradeS", "A/L S passes"],
  ["alGradeC", "A/L C passes"],
  ["alGradeB", "A/L B passes"],
  ["alGradeA", "A/L A passes"],
  ["sportsLevel", "Sports level"],
  ["sportsCount", "Sports achievements count"],
  ["leadershipRole", "Leadership role"],
  ["studentSocietiesRole", "Student societies role"],
  ["otherActivity", "Other activity"],
  ["otherActivityName", "Other activity name"],
  ["pastPupilsLifeMember", "Past Pupils life member"],
  ["pastPupilsMembershipStart", "Past Pupils membership start date"],
  ["pastPupilsMembershipEnd", "Past Pupils membership end date"],
  ["pastPupilsCommitteeMember", "Past Pupils committee member"],
  ["pastPupilsExecutiveOffice", "Past Pupils executive office"],
  ["highestDegree", "Highest degree"],
  ["hasDiploma", "Has Diploma / Higher Diploma"],
  ["sportsMeetContribution", "Sports Meet contribution"],
  ["shramadanaContribution", "Shramadana contribution"],
  ["schoolProjectsContribution", "School Projects contribution"],
  ["siblingsCurrentlyStudyingCount", "Siblings currently studying"],
  ["siblingStudiedAtAppliedSchool", "Sibling studied at applied school"],
  ["twoOrMoreSiblingsApplying", "Two or more siblings applying"],
  ["siblingPrefectLevel", "Sibling prefect level"],
  ["siblingPrefectCount", "Sibling prefect achievement count"],
  ["siblingExamAchievement", "Sibling exam achievement"],
  ["siblingPraiseworthyAchievement", "Sibling praiseworthy achievement"],
  ["parentsSupportRendered", "Parent support rendered"],
  ["serviceStartDate", "Service start date"],
  ["difficultServiceType", "Difficult service type"],
  ["difficultServiceDistanceKm", "Difficult service distance km"],
  ["difficultServiceExtraPeriods", "Difficult service extra periods"],
  ["unutilizedLeaveYears", "Unutilized leave years"],
  ["serviceLocationLevel", "Service location level"],
  ["residenceToSchoolKm", "Residence to school km"],
  ["workplaceToSchoolKm", "Workplace to school km"],
  ["previousWorkplaceDistanceKm", "Previous workplace distance km"],
  ["previousWorkplaceStartDate", "Previous workplace start date"],
  ["transferDate", "Transfer date"],
  ["abroadStartDate", "Abroad start date"],
  ["abroadEndDate", "Abroad end date"],
  ["employmentPurpose", "Employment purpose"],
];

const selectedLocationIcon = divIcon({ className: "bg-transparent border-0", html: "<span></span>", iconSize: [22, 22], iconAnchor: [11, 11] });

function parseScoringNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseScoringEnum<T extends string>(value: string, options: readonly T[]): T | undefined {
  const trimmed = value.trim();
  return (options as readonly string[]).includes(trimmed) ? (trimmed as T) : undefined;
}

function fieldPatch<K extends keyof ScoringInputs>(key: K, value: ScoringInputs[K]): Partial<ScoringInputs> {
  const patch: Partial<ScoringInputs> = {};
  patch[key] = value;
  return patch;
}

function schoolsSelectedSummary(ids: string[] | undefined): string {
  const names = (ids ?? []).flatMap((schoolId) => {
    const school = findSchoolById(schoolId);
    return school ? [school.en] : [];
  });
  return names.length === 0 ? "0" : `(${names.length}) ${names.join(", ")}`;
}

type FieldType = "text" | "name" | "date" | "phone" | "email" | "nic" | "boolean" | "address" | "select" | "number" | "document";

const FIELD_STYLES: Record<FieldType, { icon: React.ReactNode; colorClass: string }> = {
  text:     { icon: <FileText size={13} />,     colorClass: "text-foreground" },
  name:     { icon: <User size={13} />,         colorClass: "text-blue-400" },
  date:     { icon: <Calendar size={13} />,     colorClass: "text-amber-400" },
  phone:    { icon: <Phone size={13} />,        colorClass: "text-emerald-400" },
  email:    { icon: <Mail size={13} />,         colorClass: "text-purple-400" },
  nic:      { icon: <CreditCard size={13} />,   colorClass: "text-orange-400" },
  boolean:  { icon: <CircleDot size={13} />,    colorClass: "text-foreground" },
  address:  { icon: <Building size={13} />,     colorClass: "text-sky-400" },
  select:   { icon: <ChevronRight size={13} />, colorClass: "text-foreground" },
  number:   { icon: <Hash size={13} />,         colorClass: "text-teal-400" },
  document: { icon: <CreditCard size={13} />,   colorClass: "text-rose-400" },
};

function Value({ label, value, hint, type = "text" }: { label: string; value: unknown; hint?: string; type?: FieldType }) {
  const isEmpty = value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  const text = isEmpty ? "Not provided" : Array.isArray(value) ? value.join(", ") : typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  const style = FIELD_STYLES[type] ?? FIELD_STYLES.text;
  return (
    <div className="grid gap-0.5 py-2.5 border-b last:border-b-0">
      <span className="text-muted-foreground text-xs flex items-center gap-1.5">
        <span className="opacity-50">{style.icon}</span>
        {label}
        {hint && <span className="text-[0.65rem] opacity-50">({hint})</span>}
      </span>
      <strong className={isEmpty ? "text-muted-foreground italic font-normal" : style.colorClass}>{text}</strong>
    </div>
  );
}

function formatScoringValue(key: string, raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  if (Array.isArray(raw)) {
    if (key === "schoolsWithinRadius") return `${raw.length} school${raw.length === 1 ? "" : "s"} selected`;
    return raw.map((v) => typeof v === "string" ? v.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : String(v)).join(", ");
  }
  if (typeof raw === "string") {
    return raw.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return String(raw);
}

function MarkBar({ marks, max }: { marks: number; max: number }) {
  const pct = max > 0 ? (marks / max) * 100 : 0;
  const barColor = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : pct > 0 ? "bg-red-400" : "bg-muted";
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="relative h-2 w-24 rounded-full bg-muted overflow-hidden shrink-0">
        <div className={`absolute inset-y-0 left-0 ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono tabular-nums text-xs whitespace-nowrap shrink-0">
        {marks.toLocaleString(undefined, { maximumFractionDigits: 2 })} / {max}
      </span>
    </div>
  );
}

function CategoryScoreBar({ total }: { total: number }) {
  const pct = Math.min(total, CATEGORY_MAX_MARKS);
  const barColor = total >= 70 ? "bg-emerald-500" : total >= 40 ? "bg-amber-500" : total > 0 ? "bg-red-400" : "bg-muted";
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="relative h-3 flex-1 rounded-full bg-muted overflow-hidden">
        <div className={`absolute inset-y-0 left-0 ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono tabular-nums text-sm font-semibold whitespace-nowrap shrink-0">
        {total.toLocaleString(undefined, { maximumFractionDigits: 2 })} / {CATEGORY_MAX_MARKS}
      </span>
    </div>
  );
}

function LocationSummary({ label, value }: { label: string; value?: LocationDraft }) {
  const sourceLabels: Record<string, string> = { device: "Device GPS", network: "Network (IP)", map: "Map selection", manual: "Manual entry", "": "Not recorded" };
  return <div className="border rounded-xl p-4"><div className="flex items-center gap-2 text-primary mb-1"><MapPin size={16} /><strong>{label}</strong></div><Value label="Label" value={value?.label} /><Value label="Address" value={value?.address} /><Value label="Coordinates" value={value?.latitude != null && value?.longitude != null ? `${value.latitude.toFixed(6)}, ${value.longitude.toFixed(6)}` : "Not captured"} /><Value label="Source" value={sourceLabels[value?.source ?? ""] ?? (value?.source || "Not recorded")} /></div>;
}

function AdminLocationMap({ browser, selected, history = [], editable = false, onSelectedChange }: { browser?: LocationDraft; selected?: LocationDraft; history?: LocationDraft[]; editable?: boolean; onSelectedChange?: (latitude: number, longitude: number) => void }) {
  const browserPoint = browser?.latitude != null && browser?.longitude != null ? [browser.latitude, browser.longitude] as [number, number] : null;
  const selectedPoint = selected?.latitude != null && selected?.longitude != null ? [selected.latitude, selected.longitude] as [number, number] : null;
  const historyPoints = history
    .filter((entry) => entry.latitude != null && entry.longitude != null)
    .map((entry, index) => ({ coords: [entry.latitude!, entry.longitude!] as [number, number], label: entry.address || entry.label || `Previous pin ${index + 1}`, source: entry.source || "unknown" }));
  const allPoints = [...historyPoints.map((h) => h.coords), ...(browserPoint ? [browserPoint] : []), ...(selectedPoint ? [selectedPoint] : [])];
  const center = selectedPoint ?? browserPoint ?? (historyPoints.length > 0 ? historyPoints[0].coords : null) ?? [7.8731, 80.7718] as [number, number];
  return (
    <div className="relative overflow-hidden border rounded-xl">
      <MapContainer center={center} zoom={allPoints.length > 0 ? 13 : 7} scrollWheelZoom className="min-h-[390px] w-full">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {browserPoint && (
          <CircleMarker center={browserPoint} radius={8} pathOptions={{ color: "#1d4ed8", fillColor: "#60a5fa", fillOpacity: .9, weight: 2 }}>
            <Tooltip direction="top" permanent>Browser location</Tooltip>
          </CircleMarker>
        )}
        {historyPoints.map((entry, index) => (
          <CircleMarker key={`history-${index}`} center={entry.coords} radius={6} pathOptions={{ color: "#7c3aed", fillColor: "#a78bfa", fillOpacity: .85, weight: 2 }}>
            <Tooltip direction="top">
              {entry.label}<br />
              <span className="font-mono text-[0.7rem]">{entry.coords[0].toFixed(5)}, {entry.coords[1].toFixed(5)}</span><br />
              Source: {entry.source}
            </Tooltip>
          </CircleMarker>
        ))}
        {selectedPoint && (editable ? (
          <Marker icon={selectedLocationIcon} draggable position={selectedPoint} eventHandlers={{ dragend: (event) => { const point = event.target.getLatLng(); onSelectedChange?.(point.lat, point.lng); } }}>
            <Tooltip direction="top" permanent>Selected location (drag to edit)</Tooltip>
          </Marker>
        ) : (
          <CircleMarker center={selectedPoint} radius={10} pathOptions={{ color: "#087f5b", fillColor: "#13b77e", fillOpacity: .9, weight: 3 }}>
            <Tooltip direction="top" permanent>Last selected location</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="absolute z-500 left-4 bottom-4 flex flex-wrap gap-3 p-2.5 border rounded-lg bg-[color-mix(in_oklch,var(--card)_92%,transparent)] shadow-[0_4px_12px_#0002] text-[0.76rem]">
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#60a5fa]" /> Browser location</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#13b77e]" /> {editable ? "Drag to edit" : "Last selected"}</span>
        {historyPoints.length > 0 && <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#a78bfa]" /> Previous pins ({historyPoints.length})</span>}
      </div>
    </div>
  );
}

export function AdminApplicationView({ id }: { id: string }) {
  const detail = useQuery(orpc.admin.application.get.queryOptions({ input: { id } }));
  const prefs = useAdminPreferences();
  const [active, setActive] = useState(prefs.defaultTab);
  const [showPrefs, setShowPrefs] = useState(false);
  const record = detail.data?.data as ApplicationDraft | undefined;
  const data = record ? normalizeDraft(record) : emptyDraft;
  const metadata = detail.data;
  const validationErrors = (metadata as { validationErrors?: Array<{ path: string; message: string }> })?.validationErrors ?? [];
  const isCompact = prefs.density === "compact";
  const fv = prefs.fieldVisibility;

  useEffect(() => {
    if (record) prefs.addRecentlyViewed(id, data.applicant.fullName || "Unnamed applicant");
  }, [record?.applicant?.fullName]);

  useEffect(() => {
    prefs.setDefaultTab(active);
  }, [active]);

  return <main className="min-h-svh p-12.5 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
    <AdminHeader title="Application details" description="Review the submitted record in a readable format." />
    {detail.isLoading && <Card><CardContent><p>Loading application…</p></CardContent></Card>}
    {detail.isError && <Card className="text-destructive"><CardContent className="flex items-center gap-2"><CircleAlert size={18} /> Could not load application: {detail.error.message}</CardContent></Card>}
    {record && <Card className="grid gap-4">
      <CardHeader><div className="flex items-start justify-between gap-4"><div><p className="text-primary font-bold tracking-widest uppercase text-xs">{data.applicant.fullName || "Unnamed applicant"}</p><CardTitle>G1 2026 application</CardTitle></div><Badge variant={metadata?.submittedAt ? "default" : "secondary"}>{metadata?.submittedAt ? "submitted" : "draft"}</Badge></div></CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex gap-4 flex-wrap text-muted-foreground text-sm"><span>Session code <strong>{metadata?.sessionCode ?? "Not available"}</strong></span><span>Created {new Date(metadata?.createdAt ?? "").toLocaleString()}</span><span>Updated {new Date(metadata?.updatedAt ?? "").toLocaleString()}</span></div>
        <div className="flex items-center justify-between gap-2">
          <div />
          <div className="flex items-center gap-1">
            <button onClick={() => prefs.setDensity(isCompact ? "comfortable" : "compact")} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors" title={isCompact ? "Switch to comfortable" : "Switch to compact"}>
              {isCompact ? <LayoutGrid size={13} /> : <Rows3 size={13} />}
              {isCompact ? "Comfortable" : "Compact"}
            </button>
            <button onClick={() => setShowPrefs(!showPrefs)} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${showPrefs ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"}`} title="View preferences">
              <Settings size={13} />
            </button>
          </div>
        </div>
        {showPrefs && (
          <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 px-4 py-2.5 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer"><Checkbox checked={prefs.showMarkBars} onCheckedChange={(checked) => prefs.setShowMarkBars(checked === true)} /> Mark bars</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><Checkbox checked={prefs.showMarkBreakdown} onCheckedChange={(checked) => prefs.setShowMarkBreakdown(checked === true)} /> Score breakdown</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><Checkbox checked={prefs.autoExpandScoringInputs} onCheckedChange={(checked) => prefs.setAutoExpandScoringInputs(checked === true)} /> Auto-expand inputs</label>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">Default tab:</span>
            <Select value={prefs.defaultTab} onValueChange={(value) => value && prefs.setDefaultTab(value)}>
              <SelectTrigger className="h-7 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Overview</SelectItem>
                {sections.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                <SelectItem value="locations">Locations</SelectItem>
                <SelectItem value="categories">Categories</SelectItem>
              </SelectContent>
            </Select>
            <button onClick={() => prefs.resetPreferences()} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">Reset</button>
          </div>
        )}
        <Tabs value={active} onValueChange={setActive}>
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {sections.map(([key, label]) => <TabsTrigger key={key} value={key}>{label}</TabsTrigger>)}
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            {validationErrors.length > 0 && <TabsTrigger value="quality">Data quality <Badge variant="destructive" className="ml-1">{validationErrors.length}</Badge></TabsTrigger>}
          </TabsList>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.65rem] text-muted-foreground py-1 border-b mb-2">
            <span className="flex items-center gap-1"><User size={10} className="text-blue-400" /> Name</span>
            <span className="flex items-center gap-1"><Calendar size={10} className="text-amber-400" /> Date</span>
            <span className="flex items-center gap-1"><Phone size={10} className="text-emerald-400" /> Phone</span>
            <span className="flex items-center gap-1"><Mail size={10} className="text-purple-400" /> Email</span>
            <span className="flex items-center gap-1"><CreditCard size={10} className="text-orange-400" /> NIC</span>
            <span className="flex items-center gap-1"><Building size={10} className="text-sky-400" /> Address</span>
            <span className="flex items-center gap-1"><CreditCard size={10} className="text-rose-400" /> Document</span>
            <span className="flex items-center gap-1"><CircleDot size={10} /> Yes / No</span>
            <span className="flex items-center gap-1"><ChevronRight size={10} /> Selection</span>
          </div>
          <TabsContent value="overview">
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">Applicant</h3>
                <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                  <Value label="Full name" value={data.applicant.fullName} type="name" />
                  <Value label="Sinhala name" value={data.applicant.sinhalaName} type="name" />
                  <Value label="Gender" value={data.applicant.gender} type="select" />
                  <Value label="Religion" value={data.applicant.religion} type="select" />
                  <Value label="Education medium" value={data.applicant.educationMedium} type="select" />
                  <Value label="Date of birth" value={data.applicant.dateOfBirth} type="date" hint="YYYY-MM-DD" />
                  <Value label="Birth certificate" value={data.applicant.birthCertificateNumber} type="document" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-3">Parent / guardian</h3>
                <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                  <Value label="Name" value={data.guardian.fullName} type="name" />
                  <Value label="Sinhala name" value={data.guardian.sinhalaName} type="name" />
                  <Value label="Relationship" value={data.guardian.relationship} type="select" />
                  <Value label="NIC" value={data.guardian.nic} type="nic" />
                  <Value label="Phone" value={data.guardian.phone} type="phone" />
                  <Value label="WhatsApp" value={data.guardian.whatsappPhone} type="phone" />
                  <Value label="Email" value={data.guardian.email} type="email" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-3">Residence</h3>
                <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                  <Value label="Permanent address" value={data.residence.permanentAddress} type="address" />
                  <Value label="Current address" value={data.residence.currentAddress} type="address" />
                  <Value label="District" value={data.residence.district} type="select" />
                  <Value label="DS division" value={data.residence.dsDivision} type="select" />
                  <Value label="GN division" value={data.residence.gnDivision} type="select" />
                  <Value label="Electoral district" value={data.residence.electoralDistrict} type="select" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-3">Declaration</h3>
                <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                  <Value label="Information confirmed" value={data.declaration.confirmed} type="boolean" />
                  <Value label="Consent given" value={data.declaration.consent} type="boolean" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-3">Categories</h3>
                {data.categories.length === 0 ? <p className="text-muted-foreground text-sm">None selected</p> : <div className="grid gap-1">{data.categories.map((c) => { const s = scoreCategory(c); return <div key={c.id} className="flex items-baseline justify-between gap-3 text-sm"><span className="text-muted-foreground">{CATEGORY_LABELS[c.categoryType]}</span><span className="font-mono tabular-nums">{s.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} / {CATEGORY_MAX_MARKS}</span></div>; })}<div className="flex items-baseline justify-between gap-3 border-t pt-1 text-sm font-semibold"><span>Total</span><span className="font-mono tabular-nums">{data.categories.reduce((sum, c) => sum + scoreCategory(c).total, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} / {data.categories.length * CATEGORY_MAX_MARKS}</span></div></div>}
              </div>
            </div>
          </TabsContent>
          {sections.map(([key]) => <TabsContent key={key} value={key}>
            <div className={isCompact ? "grid grid-cols-4 gap-4 max-md:grid-cols-2 max-sm:grid-cols-1" : "grid grid-cols-2 gap-8 max-md:grid-cols-1"}>
              {Object.entries((data[key] ?? {}) as Record<string, unknown>)
                .filter(([k]) => k !== "sameAsPermanent" && k !== "districtSearch" && k !== "dsSearch" && k !== "gnSearch" && k !== "electoralSearch")
                .filter(([k]) => isFieldVisible(fv, key, k))
                .map(([field, value]) => <Value key={field} label={SECTION_FIELD_LABELS[key]?.[field] ?? field.replace(/[A-Z]/g, (l) => ` ${l}`).replace(/^./, (l) => l.toUpperCase())} value={value} hint={SECTION_FIELD_HINTS[key]?.[field]} type={SECTION_FIELD_TYPES[key]?.[field] ?? "text"} />)}
            </div>
          </TabsContent>)}
          <TabsContent value="locations">
            <div className={isCompact ? "grid gap-3" : "grid gap-4"}>
              <AdminLocationMap browser={data.defaultLocations[0]} selected={data.selectedLocation.latitude != null ? data.selectedLocation : data.location} history={data.userLocationHistory} />
              <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
                <LocationSummary label="Saved browser location" value={data.defaultLocations[0]} />
                <LocationSummary label="Selected application location" value={data.selectedLocation.latitude != null ? data.selectedLocation : data.location} />
              </div>
              <AdminLocationHistory title="Device fixes (newest first)" history={data.deviceLocationHistory} />
              <AdminLocationHistory title="Selected pins (newest first)" history={data.userLocationHistory} />
            </div>
          </TabsContent>
          <TabsContent value="categories">
            <div className={isCompact ? "grid gap-3" : "grid gap-5"}>
              {data.categories.length === 0 && <p className="text-muted-foreground">No categories selected.</p>}
              {data.categories.map((category) => {
                const score = scoreCategory(category);
                return (
                  <div className="border rounded-xl overflow-hidden" key={category.id}>
                    <div className="bg-muted/30 px-5 py-4 border-b">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <h4 className="font-semibold">{CATEGORY_LABELS[category.categoryType]}</h4>
                      </div>
                      {prefs.showMarkBars && <CategoryScoreBar total={score.total} />}
                    </div>
                    {prefs.showMarkBreakdown && (
                      <div className="px-5 py-3">
                        <div className="grid gap-2">
                          {score.breakdown.map((row) => (
                            <div key={row.label} className="flex items-center justify-between gap-4 py-1.5 border-b last:border-b-0">
                              <span className="text-sm text-muted-foreground">{row.label}</span>
                              {prefs.showMarkBars ? <MarkBar marks={row.marks} max={row.max} /> : (
                                <span className="font-mono tabular-nums text-xs">{row.marks.toLocaleString(undefined, { maximumFractionDigits: 2 })} / {row.max}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {category.scoringInputs.schoolsWithinRadius && category.scoringInputs.schoolsWithinRadius.length > 0 && (
                      <div className="px-5 py-3 border-t bg-muted/20">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Nearby schools</p>
                        <div className="flex flex-wrap gap-1.5">
                          {category.scoringInputs.schoolsWithinRadius.map((schoolId) => {
                            const school = findSchoolById(schoolId);
                            return (
                              <span key={schoolId} className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                                <MapPin size={10} />
                                {school?.en ?? schoolId}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <details className="group border-t" open={prefs.autoExpandScoringInputs}>
                      <summary className="cursor-pointer px-5 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors bg-muted/10">Show scoring inputs</summary>
                      <div className="px-5 py-3 grid grid-cols-2 gap-x-8 gap-y-1 max-md:grid-cols-1">
                        {SCORING_INPUT_SUMMARY_ROWS.map(([key, label]) => {
                          const raw = category.scoringInputs[key];
                          if (raw == null) return null;
                          const displayValue = formatScoringValue(key, raw);
                          if (!displayValue) return null;
                          const fieldType: FieldType = key.endsWith("Date") || key.includes("Start") || key.includes("End") ? "date"
                            : key.includes("phone") || key.includes("Phone") ? "phone"
                            : key.includes("email") || key.includes("Email") ? "email"
                            : key.includes("Count") || key.includes("Since") || key.includes("Km") || key.includes("Years") ? "number"
                            : typeof raw === "boolean" ? "boolean"
                            : "select";
                          return <Value key={key} label={label} value={displayValue} type={fieldType} />;
                        })}
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          </TabsContent>
          {validationErrors.length > 0 && <TabsContent value="quality">
            <div className="grid gap-3">
              <h3>Data quality issues</h3>
              {validationErrors.map((err, i) => <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive"><CircleAlert size={16} className="mt-0.5 shrink-0" /><div><span className="font-mono text-xs">{err.path}</span><p className="text-sm">{err.message}</p></div></div>)}
            </div>
          </TabsContent>}
        </Tabs>
        <div className="flex justify-between gap-3 flex-wrap"><Button variant="secondary" render={<a href="/admin/applications" />}>Back to applications</Button><Button render={<a href={`/admin/applications/${id}?mode=edit`} />}>Edit application</Button></div>
      </CardContent>
    </Card>}
  </main>;
}

export function AdminApplicationEditor({ id }: { id: string }) {
  const navigate = useNavigate();
  const detail = useQuery(orpc.admin.application.get.queryOptions({ input: { id } }));
  const [draft, setDraft] = useState<ApplicationDraft>(emptyDraft);
  const [saveState, setSaveState] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  useEffect(() => { if (detail.data?.data) setDraft(normalizeDraft(detail.data.data as Partial<ApplicationDraft>)); }, [detail.data?.data]);
  const set = (section: keyof ApplicationDraft, key: string, value: string | boolean) => setDraft((current) => ({ ...current, [section]: { ...(current[section] as object), [key]: value } }));
  const fields = useMemo(() => sections.filter(([key]) => key !== "declaration"), []);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveState("Saving…");
    setSavedAt(null);
    try {
      await client.admin.application.update({ id, data: normalizeDraft(draft) });
      await detail.refetch();
      setSavedAt(new Date());
      setSaveState("Saved just now");
      toast.success("Application changes saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save changes";
      setSaveState(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };
  if (detail.isLoading) return <main className="min-h-svh p-12.5 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]"><Card><CardContent><p>Loading application…</p></CardContent></Card></main>;
  if (detail.isError) return <main className="min-h-svh p-12.5 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]"><Card className="text-destructive"><CardContent className="flex items-center gap-2"><CircleAlert size={18} /> Could not load application: {detail.error.message}</CardContent></Card></main>;
  return <main className="min-h-svh p-12.5 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]"><AdminHeader title="Edit application" description="Make corrections directly to the saved record. Changes are applied to the database when you save." status="Admin edit mode" /><Card className="grid gap-4"><CardHeader><div className="flex items-start justify-between gap-4"><div><p className="text-primary font-bold tracking-widest uppercase text-xs">{draft.applicant.fullName || "Unnamed applicant"}</p><CardTitle>Application information</CardTitle><p className="text-muted-foreground text-[0.82rem]">Session code: <strong>{detail.data?.sessionCode ?? "Not available"}</strong></p></div><div className="text-right">{saveState && <span className={saveState.startsWith("Could") ? "text-destructive" : "text-primary"}>{saveState}</span>}{savedAt && <span className="block text-xs text-muted-foreground mt-1">{savedAt.toLocaleString()}</span>}</div></div></CardHeader>
    <CardContent className="grid gap-4">
      {fields.map(([key, label]) => <AdminFieldSection key={key} section={key} label={label} value={draft[key] as Record<string, unknown>} onChange={set} />)}
      <div className="border rounded-xl p-4"><h3>Locations</h3><p className="text-muted-foreground text-[0.82rem]">Correct the captured browser point or the location selected by the applicant. Drag the green pin, edit the coordinates, then save.</p><AdminLocationMap editable browser={draft.defaultLocations[0]} selected={draft.selectedLocation.latitude != null ? draft.selectedLocation : draft.location} history={draft.userLocationHistory} onSelectedChange={(latitude, longitude) => setDraft((current) => ({ ...current, selectedLocation: { ...current.selectedLocation, latitude, longitude, source: "map" }, location: { ...current.location, latitude, longitude, source: "map" }, userLocationHistory: prependLocationHistory(current.userLocationHistory, { ...current.selectedLocation, latitude, longitude, source: "map", label: "Selected location" }) }))} /><div className="grid grid-cols-2 gap-4 max-md:grid-cols-1"><AdminLocationEditor label="Saved browser location" value={draft.defaultLocations[0] ?? emptyDraft.location} onChange={(key, value) => setDraft((current) => ({ ...current, defaultLocations: current.defaultLocations.length > 0 ? current.defaultLocations.map((loc, i) => i === 0 ? { ...loc, [key]: value } : loc) : [{ ...emptyDraft.location, [key]: value }] }))} /><AdminLocationEditor label="Selected / edited location" value={draft.selectedLocation.latitude != null ? draft.selectedLocation : draft.location} onChange={(key, value) => setDraft((current) => ({ ...current, selectedLocation: { ...current.selectedLocation, [key]: value }, location: { ...current.location, [key]: value } }))} /></div><AdminLocationHistory title="Device fixes (newest first)" history={draft.deviceLocationHistory} /><AdminLocationHistory title="Previously selected locations" history={draft.userLocationHistory} /></div>
      <div className="border rounded-xl p-4"><h3>Categories</h3><p className="text-muted-foreground text-[0.82rem]">Correct the captured category details. Schools within radius are shown for reference and cannot be edited here.</p><div className="grid gap-4">{draft.categories.length === 0 && <p className="text-muted-foreground">No categories selected.</p>}{draft.categories.map((category) => <AdminCategoryEditor key={category.id} category={category} onPatch={(categoryId, patch) => setDraft((current) => ({ ...current, categories: current.categories.map((entry) => entry.id === categoryId ? { ...entry, scoringInputs: { ...entry.scoringInputs, ...patch } } : entry) }))} onRemove={() => setDraft((current) => ({ ...current, categories: current.categories.filter((entry) => entry.id !== category.id) }))} />)}</div></div>
      <div className="border rounded-xl p-4"><h3>Declaration</h3><Toggle label="Information confirmed" checked={draft.declaration.confirmed} onChange={(value) => set("declaration", "confirmed", value)} /><Toggle label="Consent given" checked={draft.declaration.consent} onChange={(value) => set("declaration", "consent", value)} /></div>
      <div className="flex justify-between gap-3 flex-wrap"><Button variant="secondary" disabled={saving} onClick={() => void navigate({ to: "/admin/applications/$id", params: { id } })}><X size={16} /> Cancel</Button><div className="flex gap-2"><Button variant="outline" disabled={saving} onClick={() => void navigate({ to: "/admin/applications/$id", params: { id } })}><Check size={16} /> View</Button><Button disabled={saving} onClick={() => void save()}><Save size={16} /> {saving ? "Saving…" : "Save changes"}</Button></div></div>
    </CardContent>
  </Card></main>;
}

function AdminFieldSection({ section, label, value, onChange }: { section: keyof ApplicationDraft; label: string; value: Record<string, unknown>; onChange: (section: keyof ApplicationDraft, key: string, value: string | boolean) => void }) {
  return <div className="border rounded-xl p-4"><h3>{label}</h3><div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">{Object.entries(value).filter(([key]) => key !== "sameAsPermanent" && !key.endsWith("Search")).map(([key, item]) => <label className="grid gap-1" key={key}><span className="text-muted-foreground text-[0.78rem] font-semibold">{SECTION_FIELD_LABELS[section]?.[key] ?? key.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())}</span><Input type={key === "dateOfBirth" ? "date" : key === "email" ? "email" : "text"} value={String(item ?? "")} onChange={(event) => onChange(section, key, event.target.value)} /></label>)}</div>{section === "residence" && <Toggle label="Current address is the same as permanent address" checked={Boolean(value.sameAsPermanent)} onChange={(checked) => onChange(section, "sameAsPermanent", checked)} />}</div>;
}

function AdminLocationHistory({ title, history }: { title: string; history: LocationDraft[] }) {
  const sourceLabels: Record<string, string> = { device: "GPS", network: "Network", map: "Map", manual: "Manual" };
  return (
    <div className="grid gap-2">
      <p className="text-[0.78rem] font-semibold text-muted-foreground">{title}</p>
      {history.length === 0 ? (
        <p className="text-muted-foreground text-[0.82rem]">No entries recorded.</p>
      ) : (
        <ol className="grid gap-1">
          {history.map((entry, index) => (
            <li key={`${entry.latitude}-${entry.longitude}-${index}`} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-[0.82rem]">
              <MapPin size={13} className="shrink-0 text-muted-foreground" />
              <span className="truncate flex-1">{entry.address || entry.label || "Unnamed point"}</span>
              {entry.source && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">{sourceLabels[entry.source] ?? entry.source}</span>}
              <span className="ml-auto shrink-0 font-mono text-[0.72rem] text-muted-foreground">
                {entry.latitude?.toFixed(5) ?? "?"}, {entry.longitude?.toFixed(5) ?? "?"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function AdminLocationEditor({ label, value, onChange }: { label: string; value: LocationDraft; onChange: (key: keyof LocationDraft, value: string | number | null) => void }) {
  return <div className="grid gap-2 p-4 border rounded-[10px]"><h4>{label}</h4><label className="grid gap-1"><span className="text-muted-foreground text-[0.78rem] font-semibold">Label</span><Input value={value.label} onChange={(event) => onChange("label", event.target.value)} /></label><label className="grid gap-1"><span className="text-muted-foreground text-[0.78rem] font-semibold">Address</span><Input value={value.address} onChange={(event) => onChange("address", event.target.value)} /></label><div className="grid grid-cols-2 gap-4 max-md:grid-cols-1"><label className="grid gap-1"><span className="text-muted-foreground text-[0.78rem] font-semibold">Latitude</span><Input type="number" step="any" value={value.latitude ?? ""} onChange={(event) => onChange("latitude", event.target.value === "" ? null : Number(event.target.value))} /></label><label className="grid gap-1"><span className="text-muted-foreground text-[0.78rem] font-semibold">Longitude</span><Input type="number" step="any" value={value.longitude ?? ""} onChange={(event) => onChange("longitude", event.target.value === "" ? null : Number(event.target.value))} /></label></div></div>;
}

function AdminCategoryEditor({ category, onPatch, onRemove }: { category: CategoryApplication; onPatch: (id: string, patch: Partial<ScoringInputs>) => void; onRemove: () => void }) {
  const inputs = category.scoringInputs;
  const patch = (partial: Partial<ScoringInputs>) => onPatch(category.id, partial);
  const score = scoreCategory(category);

  const renderFields = () => {
    switch (category.categoryType) {
      case "6.1": return <Category61Fields category={category} onChange={patch} />;
      case "6.2": return <Category62Fields category={category} onChange={patch} />;
      case "6.3": return <Category63Fields category={category} onChange={patch} />;
      case "6.4": return <Category64Fields category={category} onChange={patch} />;
      case "6.6": return <Category66Fields category={category} onChange={patch} />;
      default: return (
        <div className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
          {Object.entries(inputs).map(([key, value]) => (
            <div key={key} className="grid gap-1 border-b border-border/70 py-3">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{key.replace(/[A-Z]/g, (l) => ` ${l}`).replace(/^./, (l) => l.toUpperCase())}</span>
              <span className="text-sm">{Array.isArray(value) ? value.join(", ") : String(value ?? "Not provided")}</span>
            </div>
          ))}
        </div>
      );
    }
  };

  return (
    <div className="grid gap-3 p-4 border rounded-[10px]">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-semibold">{CATEGORY_LABELS[category.categoryType]} – <span className="font-mono">{score.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}/{CATEGORY_MAX_MARKS}</span></h4>
        <Button variant="secondary" size="sm" onClick={onRemove}><X size={16} /> Remove</Button>
      </div>
      {renderFields()}
      <p className="text-muted-foreground text-[0.82rem]">Schools selected: {schoolsSelectedSummary(inputs.schoolsWithinRadius)}</p>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{checked ? <Check size={14} /> : null}</span>{label}</label>; }
function AdminHeader({ title, description, status }: { title: string; description: string; status?: string }) { return <div className="flex items-end justify-between gap-8 mb-8"><div><p className="text-primary font-bold tracking-widest uppercase text-xs">Admin / Applications</p><h1>{title}</h1><p>{description}</p></div>{status && <span className="inline-flex items-center gap-1.5 text-primary text-sm font-semibold"><span /> {status}</span>}</div>; }
