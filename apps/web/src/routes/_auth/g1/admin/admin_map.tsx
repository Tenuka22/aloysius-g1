import { useEffect, lazy, Suspense, useMemo, useState } from "react";
import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, MapPinned, Maximize2 } from "lucide-react";
import { consumeEventIterator } from "@orpc/client";
import { client, orpc } from "@/utils/orpc";
import { Button } from "@aloysius-admissions/ui/components/button";
import { Card } from "@aloysius-admissions/ui/components/card";
import { Input } from "@aloysius-admissions/ui/components/input";
import { Checkbox } from "@aloysius-admissions/ui/components/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aloysius-admissions/ui/components/select";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogDescription } from "@aloysius-admissions/ui/components/dialog";
import { schoolsWithCoordinates } from "@/lib/g1/school-coordinates";
import { haversineDistanceKm, getAllSchoolsWithDistance, findSchoolById, isGenderCompatible } from "@/lib/g1/school-utils";
import { HOME_SCHOOL_ID } from "@/lib/g1/school-config";
import {
  PROXIMITY_PER_SCHOOL_61, PROXIMITY_MAX_61,
  PROXIMITY_PER_SCHOOL_63, PROXIMITY_MAX_63,
  PROXIMITY_PER_SCHOOL_65, PROXIMITY_MAX_65,
  PROXIMITY_PER_SCHOOL_66, PROXIMITY_MAX_66,
  RESIDENCE_DISTANCE_TIERS_64, RESIDENCE_DISTANCE_FALLBACK_64, RESIDENCE_DISTANCE_MAX_64,
} from "@/lib/g1/marking-scheme";
import { intakeYearSearchSchema } from "@/lib/g1/intake-year";
const AdminMapView = lazy(() => import("@/components/g1/admin/admin-map-view"));

export const Route = createFileRoute("/_auth/g1/admin/admin_map")({
  validateSearch: intakeYearSearchSchema,
  loaderDeps: ({ search }) => ({ intakeYear: search.intakeYear }),
  loader: async ({ context, deps }) => {
    await context.queryClient.prefetchQuery(context.orpc.admin.admissions.listWithLocations.queryOptions({ input: { intakeYear: deps.intakeYear } }));
  },
  component: AdminMapPage,
});


function tieredResidenceMarks(km: number | null): number {
  if (km == null) return 0;
  for (const [limit, marks] of RESIDENCE_DISTANCE_TIERS_64) {
    if (km <= limit) return marks;
  }
  return RESIDENCE_DISTANCE_FALLBACK_64;
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border/80 bg-card">
      <div className="px-3.5 pt-3 pb-1.5">
        <h2 className="text-[0.92rem] font-semibold tracking-tight">{title}</h2>
        {hint && <p className="mt-0.5 text-[0.78rem] leading-snug text-muted-foreground">{hint}</p>}
      </div>
      <div className="px-3.5 pb-3">{children}</div>
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[0.66rem] font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>;
}

function ProximityRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[0.82rem] text-muted-foreground">{label}</span>
        <span className="shrink-0 font-mono text-[0.72rem] tabular-nums text-foreground">{value} <span className="text-muted-foreground">/ {max}</span></span>
      </div>
      <div className="h-[3px] overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/80" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function AdminMapPage() {
  const { intakeYear } = Route.useSearch();
  const admissions = useQuery(orpc.admin.admissions.listWithLocations.queryOptions({ input: { intakeYear } }));
  const items = (admissions.data ?? []) as Array<{
    id: string;
    applicantName: string;
    admissionStatus: string;
    isBanned: boolean;
    latitude: number | null;
    longitude: number | null;
  }>;

  useEffect(() => {
    const controller = new AbortController();
    const cancel = consumeEventIterator(client.application.liveCount(undefined, { signal: controller.signal }), {
      onEvent: () => { void admissions.refetch(); },
      onError: () => undefined,
    });
    return () => { controller.abort(); cancel(); };
  }, []);

  const homeSchool = findSchoolById(HOME_SCHOOL_ID);
  const [homeLat, setHomeLat] = useState(homeSchool?.lat ?? 6.045556);
  const [homeLng, setHomeLng] = useState(homeSchool?.lng ?? 80.208583);
  const [selectedSchoolId, setSelectedSchoolId] = useState(HOME_SCHOOL_ID);
  const [selectedNearbyIds, setSelectedNearbyIds] = useState<Set<string>>(new Set());
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const toggleNearby = (schoolId: string) => {
    setSelectedNearbyIds((prev) => {
      const next = new Set(prev);
      next.has(schoolId) ? next.delete(schoolId) : next.add(schoolId);
      return next;
    });
  };

  // Re-read each render: manual coordinates from the DB hub can change between page loads.
  const locatedSchools = schoolsWithCoordinates();

  const selectedSchool = locatedSchools.find((s) => s.id === selectedSchoolId);
  const appliedGenderType = selectedSchool?.genderType;

  const allSchools = useMemo(() => getAllSchoolsWithDistance(homeLat, homeLng), [homeLat, homeLng]);

  const homeToSchoolKm = selectedSchool
    ? haversineDistanceKm(homeLat, homeLng, selectedSchool.lat, selectedSchool.lng)
    : null;

  const schoolsWithinRadius = useMemo(() => {
    if (homeToSchoolKm == null) return 0;
    return allSchools.filter((s) => s.distanceKm <= homeToSchoolKm && s.id !== selectedSchoolId).length;
  }, [allSchools, homeToSchoolKm, selectedSchoolId]);

  const selectedNearbySchools = useMemo(
    () => allSchools.filter((s) => selectedNearbyIds.has(s.id)),
    [allSchools, selectedNearbyIds],
  );

  const circleSchools = useMemo(() => {
    const list: Array<{ lat: number; lng: number; id: string }> = [];
    if (selectedSchool) list.push({ lat: selectedSchool.lat, lng: selectedSchool.lng, id: selectedSchool.id });
    for (const s of selectedNearbySchools) list.push({ lat: s.lat, lng: s.lng, id: s.id });
    return list;
  }, [selectedSchool, selectedNearbySchools]);

  const proximityScore61 = homeToSchoolKm != null ? Math.min(PROXIMITY_MAX_61, schoolsWithinRadius * PROXIMITY_PER_SCHOOL_61) : 0;
  const proximityScore63 = homeToSchoolKm != null ? Math.min(PROXIMITY_MAX_63, schoolsWithinRadius * PROXIMITY_PER_SCHOOL_63) : 0;
  const proximityScore65 = homeToSchoolKm != null ? Math.min(PROXIMITY_MAX_65, schoolsWithinRadius * PROXIMITY_PER_SCHOOL_65) : 0;
  const proximityScore66 = homeToSchoolKm != null ? Math.min(PROXIMITY_MAX_66, schoolsWithinRadius * PROXIMITY_PER_SCHOOL_66) : 0;
  const residenceScore64 = tieredResidenceMarks(homeToSchoolKm);

  const located = useMemo(
    () => items.filter((a): a is typeof a & { latitude: number; longitude: number } => a.latitude != null && a.longitude != null),
    [items],
  );
  const unlocated = useMemo(() => items.filter((a) => a.latitude == null || a.longitude == null), [items]);

  const nearbyList = allSchools.slice(0, 20);

  return (
    <main className="min-h-svh overflow-hidden bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)] p-4 md:p-6 xl:p-8">
      <div className="mx-auto flex w-full max-w-[min(1700px,100%)] flex-col gap-4 2xl:max-w-[calc(100%-2rem)]">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Admin / Map</p>
            <h1 className="mt-1 font-heading text-[clamp(1.7rem,3vw,2.6rem)] leading-tight">Applicant locations</h1>
            <p className="mt-1.5 max-w-[60ch] text-sm text-muted-foreground">
              Pick a home point and a school to inspect the distance geometry and proximity marks behind an admission.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" render={<Link to="/g1/admin/schools" search={true} />} nativeButton={false}><MapPinned size={16} /> Schools hub</Button>
            <Button variant="secondary" render={<Link to="/g1/admin/admissions" search={true} />} nativeButton={false}><ClipboardCheck size={16} /> Open admissions</Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-y border-border/60 py-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Applicants</span>
          <span className="tabular-nums"><strong>{items.length}</strong> <span className="text-xs text-muted-foreground">total</span></span>
          <span className="inline-flex items-center gap-1.5 tabular-nums"><span className="size-2 rounded-full bg-emerald-500" /><strong>{located.length}</strong><span className="text-xs text-muted-foreground">with location</span></span>
          <span className="inline-flex items-center gap-1.5 tabular-nums"><span className="size-2 rounded-full bg-muted-foreground/40" /><strong>{unlocated.length}</strong><span className="text-xs text-muted-foreground">no location</span></span>
        </div>

        <div className="grid gap-4 xl:h-[calc(100dvh-15.75rem)] xl:grid-cols-[minmax(290px,clamp(330px,22vw,420px))_minmax(0,1fr)]">
          <aside className="grid content-start gap-3 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
            <Panel title="Scenario" hint="Home point and selected school.">
              <div className="grid gap-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1">
                    <FieldLabel>Home latitude</FieldLabel>
                    <Input type="number" step="any" value={homeLat} onChange={(e) => setHomeLat(Number(e.target.value))} className="h-7 font-mono text-sm" />
                  </label>
                  <label className="grid gap-1">
                    <FieldLabel>Home longitude</FieldLabel>
                    <Input type="number" step="any" value={homeLng} onChange={(e) => setHomeLng(Number(e.target.value))} className="h-7 font-mono text-sm" />
                  </label>
                </div>
                <Select value={selectedSchoolId} onValueChange={(v) => { if (v) setSelectedSchoolId(v); }}>
                  <SelectTrigger className="h-7 w-full min-w-0" title={selectedSchool?.en}>
                    <SelectValue className="min-w-0">{() => selectedSchool?.en ?? "Select a school"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-w-[min(24rem,calc(100vw-2rem))]">
                    {locatedSchools.map((school) => (
                      <SelectItem key={school.id} value={school.id} className="min-w-0">
                        <span className="block w-full truncate">{school.en}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Panel>

            <Panel title="Nearby schools" hint="Tick one to draw its radius circle on the map.">
              <ul className="grid max-h-[228px] overflow-y-auto pr-1 xl:max-h-[146px]">
                {nearbyList.map((school) => {
                  const isSelected = school.id === selectedSchoolId;
                  const isChecked = selectedNearbyIds.has(school.id);
                  const isWithin = homeToSchoolKm != null && school.distanceKm <= homeToSchoolKm;
                  const compatible = appliedGenderType ? isGenderCompatible(school.genderType, appliedGenderType) : true;
                  return (
                    <li key={school.id} className="border-b border-border/60 last:border-b-0">
                      <label
                        htmlFor={`nearby-${school.id}`}
                        className={`flex min-w-0 cursor-pointer items-center gap-2.5 py-1 text-[0.82rem] ${!compatible ? "text-violet-600" : isSelected ? "text-foreground" : "hover:bg-muted/40"}`}
                      >
                        <Checkbox
                          id={`nearby-${school.id}`}
                          checked={isChecked}
                          disabled={isSelected || !compatible}
                          onCheckedChange={() => toggleNearby(school.id)}
                          className="size-3.5 shrink-0"
                        />
                        <span className={`inline-block size-1.5 shrink-0 rounded-full ${isSelected ? "bg-amber-500" : isChecked ? "bg-primary" : isWithin ? "bg-emerald-500" : "bg-muted-foreground/25"}`} />
                        <span className="min-w-0 flex-1 truncate">
                          {school.en}
                          {isSelected && <span className="ml-1.5 text-xs font-semibold text-amber-600">selected</span>}
                          {!compatible && <span className="ml-1.5 text-[0.65rem] text-violet-500 font-medium">Ineligible</span>}
                        </span>
                        <span className="shrink-0 font-mono text-[0.7rem] tabular-nums text-muted-foreground">{school.distanceKm.toFixed(1)} km</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[0.66rem] leading-relaxed text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-emerald-500" /> within radius</span>
                <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-primary" /> drawing circle</span>
                <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-muted-foreground/25" /> outside</span>
              </p>
            </Panel>

            <Panel title="Proximity readout">
              <div className="grid gap-2">
                <ProximityRow label="6.1 Residence proximity" value={proximityScore61} max={PROXIMITY_MAX_61} />
                <ProximityRow label="6.3 Sibling proximity" value={proximityScore63} max={PROXIMITY_MAX_63} />
                <ProximityRow label="6.4 Residence distance" value={residenceScore64} max={RESIDENCE_DISTANCE_MAX_64} />
                <ProximityRow label="6.5 Transfer proximity" value={proximityScore65} max={PROXIMITY_MAX_65} />
                <ProximityRow label="6.6 Foreign proximity" value={proximityScore66} max={PROXIMITY_MAX_66} />
              </div>
            </Panel>
          </aside>

          <Card className="overflow-hidden xl:h-full xl:min-h-0 py-0">
            <div className="relative h-[64vh] min-h-[420px] w-full xl:h-full xl:min-h-0">
              <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-lg border bg-card/95 px-2.5 py-1.5 shadow-sm backdrop-blur">
                <span className="truncate text-sm font-semibold">{selectedSchool?.en ?? "No school selected"}</span>
                {homeToSchoolKm != null && (
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{homeToSchoolKm.toFixed(2)} km · {schoolsWithinRadius} within</span>
                )}
                <button
                  onClick={() => setFullscreenOpen(true)}
                  className="pointer-events-auto -my-1.5 -mr-1 ml-1 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Open fullscreen map"
                  aria-label="Open fullscreen map"
                >
                  <Maximize2 size={15} />
                </button>
              </div>
              <ClientOnly fallback={<div className="h-full w-full bg-muted" />}>
                <Suspense fallback={<div className="h-full w-full bg-muted" />}>
                  <AdminMapView
                    homeLat={homeLat}
                    homeLng={homeLng}
                    selectedSchool={selectedSchool}
                    homeToSchoolKm={homeToSchoolKm}
                    schoolsWithinRadius={schoolsWithinRadius}
                    selectedNearbySchools={selectedNearbySchools}
                    circleSchools={circleSchools}
                    allSchools={allSchools}
                    selectedSchoolId={selectedSchoolId}
                    selectedNearbyIds={selectedNearbyIds}
                    appliedGenderType={appliedGenderType}
                    located={located}
                    fullscreen={false}
                    />
                </Suspense>
              </ClientOnly>
              <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex flex-wrap gap-2.5 rounded-lg border bg-card/90 px-2.5 py-1.5 text-[0.7rem] text-muted-foreground shadow-sm backdrop-blur">
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-red-600" /> Home</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-500" /> Selected school</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-600" /> Applicant</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-500" /> School</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
      <style>{`.school-tooltip{background:#18181b!important;color:#fafafa!important;border:1px solid #27272a!important;border-radius:8px!important;padding:6px 10px!important;font-size:12px!important;box-shadow:0 4px 12px rgba(0,0,0,.3)!important;white-space:nowrap!important;display:flex;flex-direction:column;gap:1px!important}.school-tooltip::before{border-top-color:#18181b!important}`}</style>

      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="!fixed !top-[5dvh] !left-[5dvw] !translate-x-0 !translate-y-0 !max-w-none !w-[90dvw] !h-[90dvh] !p-0 !gap-0 !overflow-hidden !rounded-xl !grid !grid-rows-[auto_1fr] !z-[1100]" showCloseButton={false}>
          <DialogTitle className="px-4 py-3 border-b flex items-center justify-between shrink-0">
            <span>{selectedSchool?.en ?? "Map"} - Fullscreen</span>
            <div className="flex items-center gap-3 text-sm text-muted-foreground font-normal">
              {homeToSchoolKm != null && <span className="font-mono">{homeToSchoolKm.toFixed(2)} km · {schoolsWithinRadius} within</span>}
              <DialogClose render={<Button variant="ghost" size="icon-sm" />}>
                <span className="sr-only">Close</span>
                <span className="text-lg leading-none">&times;</span>
              </DialogClose>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">Fullscreen map view with school name labels and radius lines</DialogDescription>
          <div className="relative flex-1 min-h-0">
            {fullscreenOpen && (
              <ClientOnly fallback={<div className="h-full w-full bg-muted" />}>
                <Suspense fallback={<div className="h-full w-full bg-muted" />}>
                  <AdminMapView
                    homeLat={homeLat}
                    homeLng={homeLng}
                    selectedSchool={selectedSchool}
                    homeToSchoolKm={homeToSchoolKm}
                    schoolsWithinRadius={schoolsWithinRadius}
                    selectedNearbySchools={selectedNearbySchools}
                    circleSchools={circleSchools}
                    allSchools={allSchools}
                    selectedSchoolId={selectedSchoolId}
                    selectedNearbyIds={selectedNearbyIds}
                    appliedGenderType={appliedGenderType}
                    located={located}
                    fullscreen={true}
                  />
                </Suspense>
              </ClientOnly>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
