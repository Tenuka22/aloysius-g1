import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, CheckCircle2, ClipboardCheck, Edit3, FileWarning, LockKeyhole, Search, ShieldAlert, UserRound, X } from "lucide-react";
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip as LeafletTooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { client, orpc } from "@/utils/orpc";
import { normalizeDraft, type ApplicationDraft } from "@/lib/application-store";
import { scoreCategory } from "@/lib/scoring";
import { findSchoolById } from "@/lib/school-utils";
import { toast } from "sonner";
import { Badge } from "@aloysius-g1/ui/components/badge";
import { Button } from "@aloysius-g1/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aloysius-g1/ui/components/card";
import { Input } from "@aloysius-g1/ui/components/input";
import { Textarea } from "@aloysius-g1/ui/components/textarea";
import { Checkbox } from "@aloysius-g1/ui/components/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aloysius-g1/ui/components/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@aloysius-g1/ui/components/alert-dialog";

export const Route = createFileRoute("/_auth/admin/admissions")({ component: AdmissionsPage });

type AdmissionStatus = "pending" | "verified" | "fake";
type AdmissionSummary = {
  id: string;
  applicantName: string;
  birthCertificateNumber: string;
  sessionCode: string;
  submittedAt: Date | null;
  updatedAt: Date;
  categoryCount: number;
  categoryTypes: string[];
  admissionStatus: AdmissionStatus;
  isBanned: boolean;
  banReason: string | null;
  admissionUpdatedAt: Date | null;
};
type AdmissionDetail = AdmissionSummary & {
  interviewNotes: string;
  data: Record<string, unknown>;
  createdAt: Date;
};

type StatusFilter = "all" | AdmissionStatus | "banned";
const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";
const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All applicants",
  pending: "Pending review",
  verified: "Verified",
  fake: "Potentially fake",
  banned: "Banned applicants",
};
const CATEGORY_LABELS: Record<string, string> = {
  "6.1": "6.1 – Residence Verification & Proximity",
  "6.2": "6.2 – Alumni",
  "6.3": "6.3 – Siblings",
  "6.4": "6.4 – Period of Service & Distance",
  "6.5": "6.5 – Transfer Applications",
  "6.6": "6.6 – Foreign Employment",
};

function formatFieldName(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase());
}

function formatFieldValue(key: string, value: unknown): string {
  if (Array.isArray(value)) {
    if (key === "schoolsWithinRadius") {
      const names = value.flatMap((schoolId) => typeof schoolId === "string" && findSchoolById(schoolId) ? [findSchoolById(schoolId)!.en] : []);
      return names.length > 0 ? names.join(", ") : "None selected";
    }
    return value.length > 0 ? value.map(String).join(", ") : "None";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "Not provided";
  return String(value);
}

function StatusBadge({ status, banned }: { status: AdmissionStatus; banned: boolean }) {
  if (banned) return <Badge variant="destructive">Banned</Badge>;
  if (status === "verified") return <Badge variant="default">Verified</Badge>;
  if (status === "fake") return <Badge variant="destructive">Potentially fake</Badge>;
  return <Badge variant="secondary">Pending review</Badge>;
}

function DataRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="grid gap-1 border-b border-border/70 py-3 last:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <strong className="break-words text-sm leading-relaxed">{value === null || value === undefined || value === "" ? "Not provided" : String(value)}</strong>
    </div>
  );
}

type LocationEvidence = {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  source: string;
};

const LOCATION_RADIUS_OPTIONS = [0.5, 1, 2, 5, 10] as const;

function LocationMapViewport({ points }: { points: LocationEvidence[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points.map((point) => [point.latitude, point.longitude] as [number, number]), { padding: [24, 24], maxZoom: 14 });
    } else if (points[0]) {
      map.setView([points[0].latitude, points[0].longitude], 14);
    }
  }, [map, points]);
  return null;
}

function ApplicantLocationReview({ draft }: { draft: ApplicationDraft }) {
  const points = useMemo(() => {
    const candidates = [
      ["selected", "Selected application location", draft.selectedLocation],
      ["location", "Application location", draft.location],
      ["browser", "Browser location at start", draft.defaultLocation],
      ...draft.userLocationHistory.map((entry, index) => [`selected-history-${index}`, `Previously selected pin ${index + 1}`, entry] as const),
      ...draft.deviceLocationHistory.map((entry, index) => [`device-history-${index}`, `Previous device fix ${index + 1}`, entry] as const),
    ] as const;
    return candidates.flatMap(([id, label, entry]) => entry.latitude != null && entry.longitude != null ? [{ id, label, address: entry.address || entry.label || "Location without address", latitude: entry.latitude, longitude: entry.longitude, source: entry.source || "unknown" }] : []);
  }, [draft]);
  const [visibleLocationIds, setVisibleLocationIds] = useState<Set<string>>(new Set());
  const [visibleRadii, setVisibleRadii] = useState<Set<number>>(new Set([1, 5]));

  useEffect(() => {
    setVisibleLocationIds(new Set(points.map((point) => point.id)));
  }, [points]);

  const visiblePoints = useMemo(() => points.filter((point) => visibleLocationIds.has(point.id)), [points, visibleLocationIds]);
  const mapCenter = visiblePoints[0] ?? points[0] ?? { latitude: 7.8731, longitude: 80.7718 };
  const toggleLocation = (id: string, checked: boolean) => setVisibleLocationIds((current) => {
    const next = new Set(current);
    if (checked) next.add(id); else next.delete(id);
    return next;
  });
  const toggleRadius = (radius: number, checked: boolean) => setVisibleRadii((current) => {
    const next = new Set(current);
    if (checked) next.add(radius); else next.delete(radius);
    return next;
  });

  return (
    <Card>
      <CardHeader><CardTitle>Location evidence</CardTitle><CardDescription>Compare the submitted location with every captured point. Toggle points and radius overlays on the map during the interview.</CardDescription></CardHeader>
      <CardContent className="grid gap-5">
        {points.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No coordinates were captured for this application.</div> : <>
          <div className="relative overflow-hidden rounded-xl border" aria-label="Applicant location evidence map">
            <MapContainer center={[mapCenter.latitude, mapCenter.longitude]} zoom={13} scrollWheelZoom className="z-0 h-[420px] w-full max-md:h-[320px]">
              <LocationMapViewport points={visiblePoints} />
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {visibleRadii.size > 0 && visiblePoints.map((point) => Array.from(visibleRadii).map((radius) => <Circle key={`${point.id}-${radius}`} center={[point.latitude, point.longitude]} radius={radius * 1000} pathOptions={{ color: point.id === "selected" ? "#087f5b" : "#64748b", fillColor: point.id === "selected" ? "#13b77e" : "#94a3b8", fillOpacity: 0.035, weight: 1.5, dashArray: "7 5" }} />))}
              {visiblePoints.map((point) => <CircleMarker key={point.id} center={[point.latitude, point.longitude]} radius={point.id === "selected" ? 10 : 7} pathOptions={{ color: point.id === "selected" ? "#065f46" : "#334155", fillColor: point.id === "selected" ? "#13b77e" : "#cbd5e1", fillOpacity: 0.95, weight: 3 }}><LeafletTooltip direction="top"><strong>{point.label}</strong><br />{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</LeafletTooltip></CircleMarker>)}
            </MapContainer>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.55fr)]">
            <div className="grid gap-2">
              <h3 className="text-sm font-semibold">Captured locations</h3>
              <ul className="grid max-h-[260px] gap-2 overflow-y-auto">
                {points.map((point) => <li key={point.id} className="rounded-lg border p-3"><label htmlFor={`location-${point.id}`} className="flex items-start gap-3"><Checkbox id={`location-${point.id}`} checked={visibleLocationIds.has(point.id)} onCheckedChange={(checked) => toggleLocation(point.id, checked === true)} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{point.label}</span><span className="block truncate text-xs text-muted-foreground">{point.address}</span><span className="mt-1 block font-mono text-[0.7rem] text-muted-foreground">{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)} · {point.source}</span></span></label></li>)}
              </ul>
            </div>
            <div className="grid content-start gap-2">
              <h3 className="text-sm font-semibold">Radius overlays</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">Each selected radius is drawn around every visible location.</p>
              <div className="grid gap-2">
                {LOCATION_RADIUS_OPTIONS.map((radius) => <label key={radius} htmlFor={`radius-${radius}`} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"><Checkbox id={`radius-${radius}`} checked={visibleRadii.has(radius)} onCheckedChange={(checked) => toggleRadius(radius, checked === true)} /><span>{radius} km radius</span></label>)}
              </div>
            </div>
          </div>
        </>}
      </CardContent>
    </Card>
  );
}

function EarlyAccessDialog({ open, onOpenChange, onConfirm, closesAt }: { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void; closesAt: Date | null }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-amber-500/12 text-amber-600"><LockKeyhole size={20} /></div>
          <AlertDialogTitle>Open admissions before the window closes?</AlertDialogTitle>
          <AlertDialogDescription>
            Admissions normally opens after the submission window closes{closesAt ? ` on ${closesAt.toLocaleString()}` : ""}. Open it early only when you are ready to begin interview review.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not yet</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Open admissions</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BanDialog({ open, onOpenChange, onConfirm, applicantName, reason, onReasonChange, pending }: { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void; applicantName: string; reason: string; onReasonChange: (value: string) => void; pending: boolean }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-destructive/12 text-destructive"><Ban size={20} /></div>
          <AlertDialogTitle>Ban this applicant?</AlertDialogTitle>
          <AlertDialogDescription>
            This marks <strong>{applicantName}</strong> as banned in the admissions workspace. Record a reason so the decision is auditable.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <label htmlFor="ban-reason" className="text-sm font-semibold">Reason for ban</label>
          <Textarea id="ban-reason" value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Describe the verified reason…" rows={3} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending || !reason.trim()} onClick={onConfirm}>{pending ? "Banning…" : "Ban applicant"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function InterviewReview({ detail, earlyAccess }: { detail: AdmissionDetail; earlyAccess: boolean }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AdmissionStatus>(detail.admissionStatus);
  const [notes, setNotes] = useState(detail.interviewNotes);
  const [banned, setBanned] = useState(detail.isBanned);
  const [banReason, setBanReason] = useState(detail.banReason ?? "");
  const [banDialogOpen, setBanDialogOpen] = useState(false);

  useEffect(() => {
    setStatus(detail.admissionStatus);
    setNotes(detail.interviewNotes);
    setBanned(detail.isBanned);
    setBanReason(detail.banReason ?? "");
  }, [detail]);

  const reviewMutation = useMutation({
    mutationFn: (input: { admissionStatus: AdmissionStatus; interviewNotes: string; isBanned: boolean; banReason?: string }) =>
      client.admin.admissions.updateReview({ id: detail.id, ...input, earlyAccess }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.admin.admissions.list.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.admin.admissions.get.key() }),
      ]);
      toast.success("Admissions review saved");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save admissions review"),
  });

  const saveReview = (isBanned: boolean = banned) => {
    reviewMutation.mutate({
      admissionStatus: status,
      interviewNotes: notes.trim(),
      isBanned,
      banReason: isBanned ? banReason.trim() : undefined,
    });
  };

  const draftInput = detail.data as Partial<ApplicationDraft>;
  const draft = normalizeDraft(draftInput);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><UserRound size={19} /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-primary">Interview workspace</p>
            <h2 className="font-heading text-2xl">{detail.applicantName}</h2>
            <p className="text-sm text-muted-foreground">Session {detail.sessionCode} · Submitted {detail.submittedAt ? new Date(detail.submittedAt).toLocaleString() : "Not submitted"}</p>
          </div>
        </div>
        <StatusBadge status={status} banned={banned} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Applicant and guardian</CardTitle><CardDescription>Base information to confirm during the interview.</CardDescription></CardHeader>
          <CardContent className="grid gap-1 sm:grid-cols-2">
            <DataRow label="Full name" value={draft.applicant.fullName} />
            <DataRow label="Sinhala name" value={draft.applicant.sinhalaName} />
            <DataRow label="Date of birth" value={draft.applicant.dateOfBirth} />
            <DataRow label="Birth certificate" value={draft.applicant.birthCertificateNumber} />
            <DataRow label="Gender" value={draft.applicant.gender} />
            <DataRow label="Religion" value={draft.applicant.religion} />
            <DataRow label="Guardian" value={draft.guardian.fullName} />
            <DataRow label="Relationship" value={draft.guardian.relationship} />
            <DataRow label="Guardian NIC" value={draft.guardian.nic} />
            <DataRow label="Phone" value={draft.guardian.phone} />
            <DataRow label="Email" value={draft.guardian.email} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Residence and location</CardTitle><CardDescription>Use the submitted address and map point as interview references.</CardDescription></CardHeader>
          <CardContent className="grid gap-1">
            <DataRow label="Permanent address" value={draft.residence.permanentAddress} />
            <DataRow label="Current address" value={draft.residence.currentAddress} />
            <DataRow label="District" value={draft.residence.district} />
            <DataRow label="DS division" value={draft.residence.dsDivision} />
            <DataRow label="GN division" value={draft.residence.gnDivision} />
            <DataRow label="Electoral district" value={draft.residence.electoralDistrict} />
            <DataRow label="Selected location" value={draft.selectedLocation.address || draft.location.address || draft.selectedLocation.label || "Not captured"} />
            <DataRow label="Coordinates" value={draft.selectedLocation.latitude != null && draft.selectedLocation.longitude != null ? `${draft.selectedLocation.latitude}, ${draft.selectedLocation.longitude}` : "Not captured"} />
          </CardContent>
        </Card>
      </div>

      <ApplicantLocationReview draft={draft} />

      <Card>
        <CardHeader><CardTitle>Category entries</CardTitle><CardDescription>Every category submitted for this applicant, with the indicative score and captured answers.</CardDescription></CardHeader>
        <CardContent className="grid gap-4">
          {draft.categories.length === 0 && <p className="text-sm text-muted-foreground">No category entries were submitted.</p>}
          {draft.categories.map((category) => (
            <section className="grid gap-3 rounded-xl border border-border p-4" key={category.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{CATEGORY_LABELS[category.categoryType] ?? category.categoryType}</h3>
                  <p className="text-xs text-muted-foreground">Category entry {category.id}</p>
                </div>
                <Badge variant="outline">{scoreCategory(category).total.toLocaleString(undefined, { maximumFractionDigits: 2 })} / 100 indicative</Badge>
              </div>
              <div className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
                {Object.entries(category.scoringInputs).map(([key, value]) => (
                  <DataRow key={key} label={formatFieldName(key)} value={formatFieldValue(key, value)} />
                ))}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardHeader><CardTitle>Interview decision</CardTitle><CardDescription>Record the review outcome separately from the applicant&apos;s submitted answers.</CardDescription></CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-2 sm:max-w-sm">
            <label htmlFor="admission-status" className="text-sm font-semibold">Review status</label>
            <Select value={status} onValueChange={(value) => setStatus((value ?? "pending") as AdmissionStatus)}>
              <SelectTrigger id="admission-status" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending review</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="fake">Potentially fake</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="interview-notes" className="text-sm font-semibold">Interview notes</label>
            <Textarea id="interview-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Record what was checked and any follow-up needed…" rows={5} maxLength={5000} />
            <span className="text-xs text-muted-foreground">{notes.length.toLocaleString()} / 5,000 characters</span>
          </div>
          {banned && <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive"><Ban size={16} className="mt-0.5 shrink-0" /><span><strong>Applicant banned.</strong> {banReason || "No reason recorded."}</span></div>}
          {reviewMutation.error && <p className="text-sm text-destructive" role="alert">{reviewMutation.error instanceof Error ? reviewMutation.error.message : "Could not save review"}</p>}
          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <Button disabled={reviewMutation.isPending} onClick={() => saveReview()}><Check size={17} /> {reviewMutation.isPending ? "Saving…" : "Save review"}</Button>
            {banned ? (
              <Button variant="secondary" disabled={reviewMutation.isPending} onClick={() => { setBanned(false); saveReview(false); }}><X size={17} /> Remove ban</Button>
            ) : (
              <Button variant="destructive" disabled={reviewMutation.isPending} onClick={() => setBanDialogOpen(true)}><Ban size={17} /> Ban applicant</Button>
            )}
            <Button variant="outline" render={<Link to="/admin/applications/$id?mode=edit" params={{ id: detail.id }} />}><Edit3 size={17} /> Edit application</Button>
          </div>
        </CardContent>
      </Card>
      <BanDialog open={banDialogOpen} onOpenChange={setBanDialogOpen} applicantName={detail.applicantName} reason={banReason} onReasonChange={setBanReason} pending={reviewMutation.isPending} onConfirm={() => { setBanned(true); setBanDialogOpen(false); saveReview(true); }} />
    </div>
  );
}

export function AdmissionsPage() {
  const settings = useQuery(orpc.admin.settings.get.queryOptions());
  const [earlyAccessGranted, setEarlyAccessGranted] = useState(false);
  const [earlyAccessDialogOpen, setEarlyAccessDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const closesAt = settings.data?.closesAt ? new Date(settings.data.closesAt) : null;
  const windowClosed = closesAt ? Date.now() >= closesAt.getTime() : false;
  const admissionsOpen = windowClosed || earlyAccessGranted;

  const admissions = useQuery({
    ...orpc.admin.admissions.list.queryOptions({ input: { page: 1, pageSize: 100, query, status, earlyAccess: earlyAccessGranted } }),
    enabled: admissionsOpen,
  });
  const list = (admissions.data?.items ?? []) as AdmissionSummary[];
  const detail = useQuery({
    ...orpc.admin.admissions.get.queryOptions({ input: { id: selectedId ?? EMPTY_UUID, earlyAccess: earlyAccessGranted } }),
    enabled: admissionsOpen && selectedId !== null,
  });

  useEffect(() => {
    setSelectedId((current) => current && list.some((item) => item.id === current) ? current : list[0]?.id ?? null);
  }, [list]);

  const counts = useMemo(() => ({ total: admissions.data?.total ?? 0, verified: list.filter((item) => item.admissionStatus === "verified").length, pending: list.filter((item) => item.admissionStatus === "pending").length, flagged: list.filter((item) => item.admissionStatus === "fake" || item.isBanned).length }), [admissions.data?.total, list]);

  if (settings.isLoading) {
    return <main className="min-h-svh p-6 md:p-10"><Card><CardContent className="flex items-center gap-3 p-8"><ClipboardCheck className="text-primary" size={20} /> Loading admissions window…</CardContent></Card></main>;
  }

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)] p-6 md:p-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Admin / Admissions</p>
          <h1 className="mt-1 font-heading text-[clamp(2rem,4vw,3.6rem)]">Interview admissions</h1>
          <p className="mt-3 max-w-[68ch] text-muted-foreground">Review submitted applications one at a time, confirm each category entry, and record the interview outcome.</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-primary"><span className="size-2 rounded-full bg-current" /> {windowClosed ? "Submission window closed" : "Early access enabled"}</div>
      </div>

      {!admissionsOpen ? (
        <>
          <Card className="mx-auto max-w-2xl border-amber-500/30 bg-amber-500/5">
            <CardHeader>
              <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-amber-500/12 text-amber-600"><LockKeyhole size={22} /></div>
              <CardTitle>Admissions is not open yet</CardTitle>
              <CardDescription>Submitted applications become available automatically after the submission window closes{closesAt ? ` on ${closesAt.toLocaleString()}` : ""}. You can open the workspace early when you are ready to start interviews.</CardDescription>
            </CardHeader>
            <CardContent><Button onClick={() => setEarlyAccessDialogOpen(true)}><ShieldAlert size={17} /> Open admissions early</Button></CardContent>
          </Card>
          <EarlyAccessDialog open={earlyAccessDialogOpen} onOpenChange={setEarlyAccessDialogOpen} closesAt={closesAt} onConfirm={() => { setEarlyAccessGranted(true); setEarlyAccessDialogOpen(false); }} />
        </>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Submitted applications" value={counts.total} icon={ClipboardCheck} />
            <StatCard label="Pending review" value={counts.pending} icon={FileWarning} />
            <StatCard label="Verified" value={counts.verified} icon={CheckCircle2} />
            <StatCard label="Flagged or banned" value={counts.flagged} icon={ShieldAlert} />
          </div>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><CardTitle>Applicant queue</CardTitle><CardDescription>Choose one applicant to open the interview workspace. Only one detail record is shown at a time.</CardDescription></div>
                {earlyAccessGranted && !windowClosed && <Badge variant="outline">Early access</Badge>}
              </div>
              <div className="flex flex-wrap gap-3 pt-3">
                <div className="relative min-w-[16rem] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search applicant, birth certificate, or session…" /></div>
                <Select value={status} onValueChange={(value) => setStatus((value ?? "all") as StatusFilter)}>
                  <SelectTrigger className="w-full sm:w-[190px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {admissions.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Loading submitted applications…</p>}
              {admissions.error && <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive"><ShieldAlert size={17} className="mt-0.5 shrink-0" /> Could not load admissions: {admissions.error.message}</div>}
              {!admissions.isLoading && !admissions.error && list.length === 0 && <div className="grid place-items-center gap-2 rounded-xl border border-dashed p-10 text-center"><ClipboardCheck className="text-muted-foreground" size={24} /><strong>No submitted applicants match this queue</strong><p className="text-sm text-muted-foreground">Try a different search or status filter.</p></div>}
              {list.length > 0 && <div className="grid gap-2 lg:grid-cols-[minmax(18rem,0.38fr)_minmax(0,1fr)]">
                <div className="grid content-start gap-2" aria-label="Applicant queue">
                  {list.map((item) => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)} className={`grid gap-2 rounded-xl border p-4 text-left transition-colors ${selectedId === item.id ? "border-primary bg-primary/8 shadow-sm" : "border-border hover:border-primary/50 hover:bg-muted/40"}`} aria-pressed={selectedId === item.id}>
                    <div className="flex items-start justify-between gap-3"><span className="font-semibold">{item.applicantName}</span><StatusBadge status={item.admissionStatus} banned={item.isBanned} /></div>
                    <span className="text-xs text-muted-foreground">Birth certificate: {item.birthCertificateNumber}</span>
                    <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground"><span>{item.categoryCount} categor{item.categoryCount === 1 ? "y" : "ies"}</span><span>·</span><span>{item.sessionCode}</span></div>
                  </button>)}
                </div>
                <div className="min-w-0">
                  {detail.isLoading && <Card><CardContent className="flex items-center gap-3 p-8 text-sm text-muted-foreground"><ClipboardCheck className="text-primary" size={18} /> Loading applicant record…</CardContent></Card>}
                  {detail.error && <Card className="border-destructive/25"><CardContent className="flex items-start gap-2 p-6 text-sm text-destructive"><ShieldAlert size={17} className="mt-0.5 shrink-0" /> Could not load applicant: {detail.error.message}</CardContent></Card>}
                  {detail.data && <InterviewReview detail={detail.data as AdmissionDetail} earlyAccess={earlyAccessGranted} />}
                </div>
              </div>}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof ClipboardCheck }) {
  return <div className="grid gap-2 rounded-xl border bg-card p-4 shadow-[0_10px_30px_color-mix(in_oklch,var(--foreground)_5%,transparent)]"><Icon className="text-primary" size={19} /><span className="text-xs text-muted-foreground">{label}</span><strong className="font-heading text-3xl">{value.toLocaleString()}</strong></div>;
}
