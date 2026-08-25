import { useEffect, useMemo, useState } from "react";
import { Check, CircleAlert, LocateFixed, MapPin, Save, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CircleMarker, MapContainer, Marker, TileLayer } from "react-leaflet";
import { divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { client, orpc } from "@/utils/orpc";
import { emptyDraft, normalizeDraft, prependLocationHistory, type ApplicationDraft, type CategoryApplication, type CategoryType, type LocationDraft, type ScoringInputs } from "@/lib/application-store";
import { scoreCategory } from "@/lib/scoring";
import { findSchoolById } from "@/lib/school-utils";
import { toast } from "sonner";

import { Button } from "@aloysius-g1/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@aloysius-g1/ui/components/card";
import { Input } from "@aloysius-g1/ui/components/input";
import { Badge } from "@aloysius-g1/ui/components/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aloysius-g1/ui/components/tabs";

const sections = [
  ["applicant", "Applicant"],
  ["guardian", "Parent / guardian"],
  ["residence", "Residence"],
  ["declaration", "Declaration"],
] as const;

const CATEGORY_LABELS: Record<CategoryType, string> = {
  "6.1": "6.1 – Residence Verification & Proximity",
  "6.2": "6.2 – Educational Qualifications & Co-Curricular Achievements",
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

type CategoryTextFieldKey = "mainDocumentType" | "documentOwnership" | "serviceLocationLevel";
type CategoryNumberFieldKey = "yearsRegistered" | "electoralMotherYears" | "electoralFatherYears" | "schoolsRadiusKm" | "periodOfServiceYears" | "difficultServiceDistanceKm" | "difficultServiceExtraPeriods" | "unutilizedLeaveYears" | "residenceToSchoolKm" | "workplaceToSchoolKm" | "previousWorkplaceDistanceKm" | "previousWorkplacePeriodYears" | "transferElapsedYears" | "periodAbroadYears" | "alumniYearsAtSchool" | "olSubjectCount" | "olGradeS" | "olGradeC" | "olGradeB" | "olGradeA" | "alSubjectCount" | "alGradeS" | "alGradeC" | "alGradeB" | "alGradeA" | "sportsCount" | "siblingsCurrentlyStudyingCount" | "siblingPrefectCount";

const CATEGORY_TEXT_FIELDS: Array<[CategoryTextFieldKey, string]> = [
  ["mainDocumentType", "Main document type"],
  ["documentOwnership", "Document ownership"],
  ["serviceLocationLevel", "Service location level"],
];

const CATEGORY_NUMBER_FIELDS: Array<[CategoryNumberFieldKey, string]> = [
  ["yearsRegistered", "Years registered"],
  ["electoralMotherYears", "Electoral mother years"],
  ["electoralFatherYears", "Electoral father years"],
  ["schoolsRadiusKm", "Schools radius km"],
  ["periodOfServiceYears", "Period of service years"],
  ["difficultServiceDistanceKm", "Difficult service distance km"],
  ["difficultServiceExtraPeriods", "Difficult service extra periods"],
  ["unutilizedLeaveYears", "Unutilized leave years"],
  ["residenceToSchoolKm", "Residence to school km"],
  ["workplaceToSchoolKm", "Workplace to school km"],
  ["previousWorkplaceDistanceKm", "Previous workplace distance km"],
  ["previousWorkplacePeriodYears", "Previous workplace period years"],
  ["transferElapsedYears", "Transfer elapsed years"],
  ["periodAbroadYears", "Period abroad years"],
  ["alumniYearsAtSchool", "Alumni years at school"],
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

const SCORING_INPUT_SUMMARY_ROWS: Array<[keyof ScoringInputs, string]> = [
  ["mainDocumentType", "Main document type"],
  ["documentOwnership", "Document ownership"],
  ["yearsRegistered", "Years registered"],
  ["additionalDocs", "Additional docs"],
  ["electoralMotherYears", "Electoral mother years"],
  ["electoralFatherYears", "Electoral father years"],
  ["schoolsRadiusKm", "Schools radius km"],
  ["grade5ScholarshipPassed", "Grade 5 Scholarship passed"],
  ["alumniYearsAtSchool", "Alumni years at school"],
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
  ["siblingsCurrentlyStudyingCount", "Siblings currently studying"],
  ["siblingStudiedAtAppliedSchool", "Sibling studied at applied school"],
  ["twoOrMoreSiblingsApplying", "Two or more siblings applying"],
  ["siblingPrefectLevel", "Sibling prefect level"],
  ["siblingPrefectCount", "Sibling prefect achievement count"],
  ["siblingExamAchievement", "Sibling exam achievement"],
  ["siblingPraiseworthyAchievement", "Sibling praiseworthy achievement"],
  ["parentsSupportRendered", "Parent support rendered"],
  ["periodOfServiceYears", "Period of service years"],
  ["difficultServiceType", "Difficult service type"],
  ["difficultServiceDistanceKm", "Difficult service distance km"],
  ["difficultServiceExtraPeriods", "Difficult service extra periods"],
  ["unutilizedLeaveYears", "Unutilized leave years"],
  ["serviceLocationLevel", "Service location level"],
  ["residenceToSchoolKm", "Residence to school km"],
  ["workplaceToSchoolKm", "Workplace to school km"],
  ["previousWorkplaceDistanceKm", "Previous workplace distance km"],
  ["previousWorkplacePeriodYears", "Previous workplace period years"],
  ["transferElapsedYears", "Transfer elapsed years"],
  ["periodAbroadYears", "Period abroad years"],
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

function Value({ label, value }: { label: string; value: unknown }) {
  const text = value === null || value === undefined || value === "" ? "Not provided" : String(value);
  return <div className="grid gap-0.5 py-2.5 border-b last:border-b-0"><span>{label}</span><strong className={text === "Not provided" ? "empty-value" : ""}>{text}</strong></div>;
}

function LocationSummary({ label, value }: { label: string; value?: LocationDraft }) {
  return <div className="border rounded-xl p-4"><div className="flex items-center gap-2 text-primary mb-1"><MapPin size={16} /><strong>{label}</strong></div><Value label="Label" value={value?.label} /><Value label="Address" value={value?.address} /><Value label="Coordinates" value={value?.latitude != null && value?.longitude != null ? `${value.latitude}, ${value.longitude}` : "Not captured"} /></div>;
}

function AdminLocationMap({ browser, selected, editable = false, onSelectedChange }: { browser?: LocationDraft; selected?: LocationDraft; editable?: boolean; onSelectedChange?: (latitude: number, longitude: number) => void }) {
  const browserPoint = browser?.latitude != null && browser?.longitude != null ? [browser.latitude, browser.longitude] as [number, number] : null;
  const selectedPoint = selected?.latitude != null && selected?.longitude != null ? [selected.latitude, selected.longitude] as [number, number] : null;
  const center = selectedPoint ?? browserPoint ?? [7.8731, 80.7718] as [number, number];
  return <div className="relative overflow-hidden border rounded-xl"><MapContainer center={center} zoom={selectedPoint || browserPoint ? 13 : 7} scrollWheelZoom className="min-h-[390px] w-full"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{browserPoint && <CircleMarker center={browserPoint} radius={10} pathOptions={{ color: "#2563eb", fillColor: "#60a5fa", fillOpacity: .9, weight: 3 }} />}{selectedPoint && (editable ? <Marker icon={selectedLocationIcon} draggable position={selectedPoint} eventHandlers={{ dragend: (event) => { const point = event.target.getLatLng(); onSelectedChange?.(point.lat, point.lng); } }} /> : <CircleMarker center={selectedPoint} radius={10} pathOptions={{ color: "#087f5b", fillColor: "#13b77e", fillOpacity: .9, weight: 3 }} />)}</MapContainer><div className="absolute z-500 left-4 bottom-4 flex flex-wrap gap-3 p-2.5 border rounded-lg bg-[color-mix(in_oklch,var(--card)_92%,transparent)] shadow-[0_4px_12px_#0002] text-[0.76rem]"><span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#2563eb]" /> Browser location</span><span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#13b77e]" /> {editable ? "Drag to edit selected location" : "Selected / edited location"}</span></div></div>;
}

export function AdminApplicationView({ id }: { id: string }) {
  const detail = useQuery(orpc.admin.application.get.queryOptions({ input: { id } }));
  const [active, setActive] = useState("overview");
  const record = detail.data?.data as ApplicationDraft | undefined;
  const data = record ? normalizeDraft(record) : emptyDraft;
  const metadata = detail.data;
  const validationErrors = (metadata as { validationErrors?: Array<{ path: string; message: string }> })?.validationErrors ?? [];

  return <main className="min-h-svh p-12.5 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
    <AdminHeader title="Application details" description="Review the submitted record in a readable format. Raw JSON is kept out of the workflow." status="Database record" />
    {detail.isLoading && <Card><CardContent><p>Loading application…</p></CardContent></Card>}
    {detail.isError && <Card className="text-destructive"><CardContent className="flex items-center gap-2"><CircleAlert size={18} /> Could not load application: {detail.error.message}</CardContent></Card>}
    {record && <Card className="grid gap-4">
      <CardHeader><div className="flex items-start justify-between gap-4"><div><p className="text-primary font-bold tracking-widest uppercase text-xs">{data.applicant.fullName || "Unnamed applicant"}</p><CardTitle>G1 2026 application</CardTitle></div><Badge variant={metadata?.submittedAt ? "default" : "secondary"}>{metadata?.submittedAt ? "submitted" : "draft"}</Badge></div></CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex gap-4 flex-wrap text-muted-foreground text-sm"><span>Session code <strong>{metadata?.sessionCode ?? "Not available"}</strong></span><span>Created {new Date(metadata?.createdAt ?? "").toLocaleString()}</span><span>Updated {new Date(metadata?.updatedAt ?? "").toLocaleString()}</span></div>
        <Tabs value={active} onValueChange={setActive}>
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {sections.map(([key, label]) => <TabsTrigger key={key} value={key}>{label}</TabsTrigger>)}
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            {validationErrors.length > 0 && <TabsTrigger value="quality">Data quality <Badge variant="destructive" className="ml-1">{validationErrors.length}</Badge></TabsTrigger>}
          </TabsList>
          <TabsContent value="overview">
            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
              <div><h3>Applicant</h3><Value label="Full name" value={data.applicant.fullName} /><Value label="Date of birth" value={data.applicant.dateOfBirth} /><Value label="Birth certificate" value={data.applicant.birthCertificateNumber} /></div>
              <div><h3>Parent / guardian</h3><Value label="Name" value={data.guardian.fullName} /><Value label="Relationship" value={data.guardian.relationship} /><Value label="Phone" value={data.guardian.phone} /></div>
              <div><h3>Residence</h3><Value label="District" value={data.residence.district} /><Value label="DS division" value={data.residence.dsDivision} /><Value label="GN division" value={data.residence.gnDivision} /></div>
              <div><h3>Declaration</h3><Value label="Information confirmed" value={data.declaration.confirmed ? "Yes" : "No"} /><Value label="Consent given" value={data.declaration.consent ? "Yes" : "No"} /></div>
            </div>
          </TabsContent>
          {sections.map(([key]) => <TabsContent key={key} value={key}>
            <div className="grid grid-cols-2 gap-8 max-md:grid-cols-1">
              {Object.entries((data[key] ?? {}) as Record<string, unknown>).filter(([k]) => k !== "sameAsPermanent").map(([field, value]) => <Value key={field} label={field.replace(/[A-Z]/g, (l) => ` ${l}`).replace(/^./, (l) => l.toUpperCase())} value={typeof value === "boolean" ? value ? "Yes" : "No" : value} />)}
            </div>
          </TabsContent>)}
          <TabsContent value="locations">
            <div className="grid gap-4">
              <AdminLocationMap browser={data.defaultLocation} selected={data.selectedLocation.latitude != null ? data.selectedLocation : data.location} />
              <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
                <LocationSummary label="Saved browser location" value={data.defaultLocation} />
                <LocationSummary label="Selected application location" value={data.selectedLocation.latitude != null ? data.selectedLocation : data.location} />
              </div>
              <AdminLocationHistory title="Device fixes (newest first)" history={data.deviceLocationHistory} />
              <AdminLocationHistory title="Selected pins (newest first)" history={data.userLocationHistory} />
            </div>
          </TabsContent>
          <TabsContent value="categories">
            <div className="grid gap-4">
              {data.categories.length === 0 && <p className="text-muted-foreground">No categories selected.</p>}
              {data.categories.map((category) => <div className="border rounded-xl p-4" key={category.id}>
                <h4>{CATEGORY_LABELS[category.categoryType]} — {scoreCategory(category).total}/100</h4>
                {SCORING_INPUT_SUMMARY_ROWS.map(([key, label]) => {
                  const raw = category.scoringInputs[key];
                  if (raw == null) return null;
                  return <Value key={key} label={label} value={Array.isArray(raw) ? raw.join(", ") : String(raw)} />;
                })}
                <Value label="Schools selected" value={schoolsSelectedSummary(category.scoringInputs.schoolsWithinRadius)} />
              </div>)}
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
  useEffect(() => { if (detail.data?.data) setDraft(normalizeDraft(detail.data.data as Partial<ApplicationDraft>)); }, [detail.data?.data]);
  const set = (section: keyof ApplicationDraft, key: string, value: string | boolean) => setDraft((current) => ({ ...current, [section]: { ...(current[section] as object), [key]: value } }));
  const fields = useMemo(() => sections.filter(([key]) => key !== "declaration"), []);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveState("Saving…");
    try {
      await client.admin.application.update({ id, data: normalizeDraft(draft) });
      await detail.refetch();
      setSaveState("Saved just now");
      toast.success("Application changes saved");
      await navigate({ to: "/admin/applications/$id", params: { id } });
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
  return <main className="min-h-svh p-12.5 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]"><AdminHeader title="Edit application" description="Make corrections directly to the saved record. Changes are applied to the database when you save." status="Admin edit mode" /><Card className="grid gap-4"><CardHeader><div className="flex items-start justify-between gap-4"><div><p className="text-primary font-bold tracking-widest uppercase text-xs">{draft.applicant.fullName || "Unnamed applicant"}</p><CardTitle>Application information</CardTitle><p className="text-muted-foreground text-[0.82rem]">Session code: <strong>{detail.data?.sessionCode ?? "Not available"}</strong></p></div>{saveState && <span className={saveState.startsWith("Could") ? "text-destructive" : "text-primary"}>{saveState}</span>}</div></CardHeader>
    <CardContent className="grid gap-4">
      {fields.map(([key, label]) => <AdminFieldSection key={key} section={key} label={label} value={draft[key] as Record<string, unknown>} onChange={set} />)}
      <div className="border rounded-xl p-4"><h3>Locations</h3><p className="text-muted-foreground text-[0.82rem]">Correct the captured browser point or the location selected by the applicant. Drag the green pin, edit the coordinates, or capture a fresh device fix, then save.</p><AdminLocationMap editable browser={draft.defaultLocation} selected={draft.selectedLocation.latitude != null ? draft.selectedLocation : draft.location} onSelectedChange={(latitude, longitude) => setDraft((current) => ({ ...current, selectedLocation: { ...current.selectedLocation, latitude, longitude, source: "map" }, location: { ...current.location, latitude, longitude, source: "map" }, userLocationHistory: prependLocationHistory(current.userLocationHistory, { ...current.selectedLocation, latitude, longitude, source: "map", label: "Selected location" }) }))} /><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => { if (!navigator.geolocation) return; navigator.geolocation.getCurrentPosition(({ coords }) => setDraft((current) => { const devicePoint: LocationDraft = { label: "Your location", address: current.location.address, latitude: coords.latitude, longitude: coords.longitude, source: "device" }; return { ...current, defaultLocation: devicePoint, selectedLocation: devicePoint, location: devicePoint, deviceLocationHistory: prependLocationHistory(current.deviceLocationHistory, devicePoint), userLocationHistory: prependLocationHistory(current.userLocationHistory, devicePoint) }; })); }}><LocateFixed size={16} /> Use my current location</Button></div><div className="grid grid-cols-2 gap-4 max-md:grid-cols-1"><AdminLocationEditor label="Saved browser location" value={draft.defaultLocation} onChange={(key, value) => setDraft((current) => ({ ...current, defaultLocation: { ...current.defaultLocation, [key]: value } }))} /><AdminLocationEditor label="Selected / edited location" value={draft.selectedLocation.latitude != null ? draft.selectedLocation : draft.location} onChange={(key, value) => setDraft((current) => ({ ...current, selectedLocation: { ...current.selectedLocation, [key]: value }, location: { ...current.location, [key]: value } }))} /></div><AdminLocationHistory title="Device fixes (newest first)" history={draft.deviceLocationHistory} /><AdminLocationHistory title="Selected pins (newest first)" history={draft.userLocationHistory} /></div>
      <div className="border rounded-xl p-4"><h3>Categories</h3><p className="text-muted-foreground text-[0.82rem]">Correct the captured category details. Schools within radius are shown for reference and cannot be edited here.</p><div className="grid gap-4">{draft.categories.length === 0 && <p className="text-muted-foreground">No categories selected.</p>}{draft.categories.map((category) => <AdminCategoryEditor key={category.id} category={category} onPatch={(categoryId, patch) => setDraft((current) => ({ ...current, categories: current.categories.map((entry) => entry.id === categoryId ? { ...entry, scoringInputs: { ...entry.scoringInputs, ...patch } } : entry) }))} onRemove={() => setDraft((current) => ({ ...current, categories: current.categories.filter((entry) => entry.id !== category.id) }))} />)}</div></div>
      <div className="border rounded-xl p-4"><h3>Declaration</h3><Toggle label="Information confirmed" checked={draft.declaration.confirmed} onChange={(value) => set("declaration", "confirmed", value)} /><Toggle label="Consent given" checked={draft.declaration.consent} onChange={(value) => set("declaration", "consent", value)} /></div>
      <div className="flex justify-between gap-3 flex-wrap"><Button variant="secondary" disabled={saving} onClick={() => void navigate({ to: "/admin/applications/$id", params: { id } })}><X size={16} /> Cancel</Button><Button disabled={saving} onClick={() => void save()}><Save size={16} /> {saving ? "Saving…" : "Save changes"}</Button></div>
    </CardContent>
  </Card></main>;
}

function AdminFieldSection({ section, label, value, onChange }: { section: keyof ApplicationDraft; label: string; value: Record<string, unknown>; onChange: (section: keyof ApplicationDraft, key: string, value: string | boolean) => void }) {
  return <div className="border rounded-xl p-4"><h3>{label}</h3><div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">{Object.entries(value).filter(([key]) => key !== "sameAsPermanent").map(([key, item]) => <label className="grid gap-1" key={key}><span className="text-muted-foreground text-[0.78rem] font-semibold">{key.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())}</span><Input type={key === "dateOfBirth" ? "date" : key === "email" ? "email" : "text"} value={String(item ?? "")} onChange={(event) => onChange(section, key, event.target.value)} /></label>)}</div>{section === "residence" && <Toggle label="Current address is the same as permanent address" checked={Boolean(value.sameAsPermanent)} onChange={(checked) => onChange(section, "sameAsPermanent", checked)} />}</div>;
}

function AdminLocationHistory({ title, history }: { title: string; history: LocationDraft[] }) {
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
              <span className="truncate">{entry.address || entry.label || "Unnamed point"}</span>
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
  return <div className="grid gap-3 p-4 border rounded-[10px]">
    <div className="flex items-center justify-between gap-3"><h4>{CATEGORY_LABELS[category.categoryType]} — {scoreCategory(category).total}/100</h4><Button variant="secondary" onClick={onRemove}><X size={16} /> Remove</Button></div>
    <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
      {CATEGORY_TEXT_FIELDS.map(([key, label]) => <label className="grid gap-1" key={key}><span className="text-muted-foreground text-[0.78rem] font-semibold">{label}</span><Input type="text" value={inputs[key] ?? ""} onChange={(event) => patch(fieldPatch(key, event.target.value))} /></label>)}
      {CATEGORY_NUMBER_FIELDS.map(([key, label]) => <label className="grid gap-1" key={key}><span className="text-muted-foreground text-[0.78rem] font-semibold">{label}</span><Input type="number" step="any" value={inputs[key] ?? ""} onChange={(event) => patch(fieldPatch(key, parseScoringNumber(event.target.value)))} /></label>)}
      <label className="grid gap-1"><span className="text-muted-foreground text-[0.78rem] font-semibold">Additional docs</span><Input type="text" value={(inputs.additionalDocs ?? []).join(", ")} onChange={(event) => { const docs = event.target.value.split(",").map((doc) => doc.trim()).filter(Boolean); patch({ additionalDocs: docs.length > 0 ? docs : undefined }); }} /></label>
      <label className="grid gap-1"><span className="text-muted-foreground text-[0.78rem] font-semibold">Difficult service type</span><Input type="text" value={inputs.difficultServiceType ?? ""} onChange={(event) => patch({ difficultServiceType: parseScoringEnum(event.target.value, DIFFICULT_SERVICE_TYPES) })} /></label>
      <label className="grid gap-1"><span className="text-muted-foreground text-[0.78rem] font-semibold">Employment purpose</span><Input type="text" value={inputs.employmentPurpose ?? ""} onChange={(event) => patch({ employmentPurpose: parseScoringEnum(event.target.value, EMPLOYMENT_PURPOSES) })} /></label>
      <label className="grid gap-1"><span className="text-muted-foreground text-[0.78rem] font-semibold">Sports level</span><Input type="text" value={inputs.sportsLevel ?? ""} onChange={(event) => patch({ sportsLevel: parseScoringEnum(event.target.value, SPORTS_LEVELS) })} /></label>
      <label className="grid gap-1"><span className="text-muted-foreground text-[0.78rem] font-semibold">Leadership role</span><Input type="text" value={inputs.leadershipRole ?? ""} onChange={(event) => patch({ leadershipRole: parseScoringEnum(event.target.value, LEADERSHIP_ROLES) })} /></label>
      <label className="grid gap-1"><span className="text-muted-foreground text-[0.78rem] font-semibold">Sibling prefect level</span><Input type="text" value={inputs.siblingPrefectLevel ?? ""} onChange={(event) => patch({ siblingPrefectLevel: parseScoringEnum(event.target.value, SPORTS_LEVELS) })} /></label>
      <label className="grid gap-1"><span className="text-muted-foreground text-[0.78rem] font-semibold">Sibling exam achievement</span><Input type="text" value={inputs.siblingExamAchievement ?? ""} onChange={(event) => patch({ siblingExamAchievement: parseScoringEnum(event.target.value, SIBLING_EXAM_ACHIEVEMENTS) })} /></label>
      <label className="grid gap-1"><span className="text-muted-foreground text-[0.78rem] font-semibold">Sibling studied at applied school (yes)</span><Input type="text" value={inputs.siblingStudiedAtAppliedSchool === true ? "yes" : ""} onChange={(event) => patch({ siblingStudiedAtAppliedSchool: event.target.value.trim().toLowerCase() === "yes" ? true : undefined })} /></label>
      <label className="grid gap-1"><span className="text-muted-foreground text-[0.78rem] font-semibold">Two or more siblings applying (yes)</span><Input type="text" value={inputs.twoOrMoreSiblingsApplying === true ? "yes" : ""} onChange={(event) => patch({ twoOrMoreSiblingsApplying: event.target.value.trim().toLowerCase() === "yes" ? true : undefined })} /></label>
      <label className="grid gap-1"><span className="text-muted-foreground text-[0.78rem] font-semibold">Sibling praiseworthy achievement (yes)</span><Input type="text" value={inputs.siblingPraiseworthyAchievement === true ? "yes" : ""} onChange={(event) => patch({ siblingPraiseworthyAchievement: event.target.value.trim().toLowerCase() === "yes" ? true : undefined })} /></label>
      <label className="grid gap-1"><span className="text-muted-foreground text-[0.78rem] font-semibold">Parent support rendered (yes)</span><Input type="text" value={inputs.parentsSupportRendered === true ? "yes" : ""} onChange={(event) => patch({ parentsSupportRendered: event.target.value.trim().toLowerCase() === "yes" ? true : undefined })} /></label>
      <label className="grid gap-1"><span className="text-muted-foreground text-[0.78rem] font-semibold">Grade 5 Scholarship passed</span><Input type="text" value={inputs.grade5ScholarshipPassed === true ? "yes" : ""} onChange={(event) => patch({ grade5ScholarshipPassed: event.target.value.trim().toLowerCase() === "yes" ? true : undefined })} /></label>
    </div>
    <p className="text-muted-foreground text-[0.82rem]">Schools selected: {schoolsSelectedSummary(inputs.schoolsWithinRadius)}</p>
  </div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{checked ? <Check size={14} /> : null}</span>{label}</label>; }
function AdminHeader({ title, description, status }: { title: string; description: string; status: string }) { return <div className="flex items-end justify-between gap-8 mb-8"><div><p className="text-primary font-bold tracking-widest uppercase text-xs">Admin / Applications</p><h1>{title}</h1><p>{description}</p></div><span className="inline-flex items-center gap-1.5 text-primary text-sm font-semibold"><span /> {status}</span></div>; }
