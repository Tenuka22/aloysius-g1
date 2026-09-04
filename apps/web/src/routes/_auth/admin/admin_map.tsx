import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip as LeafletTooltip, useMap } from "react-leaflet";
import L, { DivIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { ClipboardCheck, MapPinned } from "lucide-react";
import { orpc } from "@/utils/orpc";
import { Button } from "@aloysius-g1/ui/components/button";
import { Card } from "@aloysius-g1/ui/components/card";
import { Input } from "@aloysius-g1/ui/components/input";
import { Checkbox } from "@aloysius-g1/ui/components/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aloysius-g1/ui/components/select";
import { schoolsWithCoordinates } from "@/lib/school-coordinates";
import { haversineDistanceKm, getAllSchoolsWithDistance, findSchoolById, isGenderCompatible } from "@/lib/school-utils";
import {
  PROXIMITY_PER_SCHOOL_61, PROXIMITY_MAX_61,
  PROXIMITY_PER_SCHOOL_63, PROXIMITY_MAX_63,
  PROXIMITY_PER_SCHOOL_65, PROXIMITY_MAX_65,
  PROXIMITY_PER_SCHOOL_66, PROXIMITY_MAX_66,
  RESIDENCE_DISTANCE_TIERS_64, RESIDENCE_DISTANCE_FALLBACK_64, RESIDENCE_DISTANCE_MAX_64,
} from "@/lib/marking-scheme";

export const Route = createFileRoute("/_auth/admin/admin_map")({ component: AdminMapPage });

const SCHOOL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`;
const SELECTED_SCHOOL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`;
const HOME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
const APPLICANT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

function createIcon(svg: string, bgColor: string, borderColor: string, size = 28) {
  return new DivIcon({
    className: "",
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 8)],
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;background:${bgColor};border:2.5px solid ${borderColor};border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.25);color:#fff;transform:translateY(-8px)">${svg}<div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid ${borderColor}"/></div>`,
  });
}

const iconHome = createIcon(HOME_SVG, "#dc2626", "#991b1b", 34);
const iconSchool = createIcon(SCHOOL_SVG, "#64748b", "#475569", 24);
const iconIneligible = createIcon(SCHOOL_SVG, "#d1d5db", "#9ca3af", 18);
const iconSelectedSchool = createIcon(SELECTED_SCHOOL_SVG, "#f59e0b", "#b45309", 36);
const iconApplicant = createIcon(APPLICANT_SVG, "#087f5b", "#065f46", 24);

const RADIUS_COLORS = ["#dc2626", "#ea580c", "#d97706", "#65a30d", "#0891b2", "#7c3aed", "#be123c", "#0e7490"];

function MapResizeSync() {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => map.invalidateSize({ pan: false });
    const frame = requestAnimationFrame(invalidate);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(invalidate);
    observer?.observe(map.getContainer());
    window.addEventListener("resize", invalidate);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", invalidate);
    };
  }, [map]);
  return null;
}

function RadiusCircles({ homeLat, homeLng, schools }: { homeLat: number; homeLng: number; schools: Array<{ lat: number; lng: number; id: string }> }) {
  const map = useMap();
  useEffect(() => {
    const layers: L.Circle[] = [];
    for (let i = 0; i < schools.length; i++) {
      const school = schools[i];
      const color = RADIUS_COLORS[i % RADIUS_COLORS.length];
      const distKm = haversineDistanceKm(homeLat, homeLng, school.lat, school.lng);
      const circle = L.circle([homeLat, homeLng], {
        radius: distKm * 1000,
        color,
        fillColor: color,
        fillOpacity: 0.03,
        weight: 2,
        dashArray: "8 4",
      });
      circle.addTo(map);
      layers.push(circle);
    }
    return () => { for (const layer of layers) layer.remove(); };
  }, [map, homeLat, homeLng, schools]);
  return null;
}

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
  const admissions = useQuery(orpc.admin.admissions.listWithLocations.queryOptions());
  const items = (admissions.data ?? []) as Array<{
    id: string;
    applicantName: string;
    admissionStatus: string;
    isBanned: boolean;
    latitude: number | null;
    longitude: number | null;
  }>;

  const [homeLat, setHomeLat] = useState(6.045556);
  const [homeLng, setHomeLng] = useState(80.208583);
  const [selectedSchoolId, setSelectedSchoolId] = useState("st-aloysius-galle");
  const [selectedNearbyIds, setSelectedNearbyIds] = useState<Set<string>>(new Set());

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

  const proximityScore61 = homeToSchoolKm != null ? Math.max(0, PROXIMITY_MAX_61 - schoolsWithinRadius * PROXIMITY_PER_SCHOOL_61) : PROXIMITY_MAX_61;
  const proximityScore63 = homeToSchoolKm != null ? Math.max(0, PROXIMITY_MAX_63 - schoolsWithinRadius * PROXIMITY_PER_SCHOOL_63) : PROXIMITY_MAX_63;
  const proximityScore65 = homeToSchoolKm != null ? Math.max(0, PROXIMITY_MAX_65 - schoolsWithinRadius * PROXIMITY_PER_SCHOOL_65) : PROXIMITY_MAX_65;
  const proximityScore66 = homeToSchoolKm != null ? Math.max(0, PROXIMITY_MAX_66 - schoolsWithinRadius * PROXIMITY_PER_SCHOOL_66) : PROXIMITY_MAX_66;
  const residenceScore64 = tieredResidenceMarks(homeToSchoolKm);

  const located = useMemo(() => items.filter((a) => a.latitude != null && a.longitude != null), [items]);
  const unlocated = useMemo(() => items.filter((a) => a.latitude == null || a.longitude == null), [items]);

  const nearbyList = allSchools.slice(0, 20);

  return (
    <main className="min-h-svh overflow-hidden bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)] p-4 md:p-6 xl:p-8">
      <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Admin / Map</p>
            <h1 className="mt-1 font-heading text-[clamp(1.7rem,3vw,2.6rem)] leading-tight">Applicant locations</h1>
            <p className="mt-1.5 max-w-[60ch] text-sm text-muted-foreground">
              Pick a home point and a school to inspect the distance geometry and proximity marks behind an admission.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" render={<Link to="/admin/schools" />} nativeButton={false}><MapPinned size={16} /> Schools hub</Button>
            <Button variant="secondary" render={<Link to="/admin/admissions" />} nativeButton={false}><ClipboardCheck size={16} /> Open admissions</Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-y border-border/60 py-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Applicants</span>
          <span className="tabular-nums"><strong>{items.length}</strong> <span className="text-xs text-muted-foreground">total</span></span>
          <span className="inline-flex items-center gap-1.5 tabular-nums"><span className="size-2 rounded-full bg-emerald-500" /><strong>{located.length}</strong><span className="text-xs text-muted-foreground">with location</span></span>
          <span className="inline-flex items-center gap-1.5 tabular-nums"><span className="size-2 rounded-full bg-muted-foreground/40" /><strong>{unlocated.length}</strong><span className="text-xs text-muted-foreground">no location</span></span>
        </div>

        <div className="grid gap-4 xl:h-[calc(100dvh-15.75rem)] xl:grid-cols-[minmax(290px,330px)_minmax(0,1fr)]">
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
                        className={`flex min-w-0 cursor-pointer items-center gap-2.5 py-1 text-[0.82rem] ${!compatible ? "opacity-40" : isSelected ? "text-foreground" : "hover:bg-muted/40"}`}
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
                          {!compatible && <span className="ml-1.5 text-[0.65rem] text-muted-foreground">Ineligible</span>}
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

          <Card className="overflow-hidden xl:h-full xl:min-h-0">
            <div className="relative h-[64vh] min-h-[420px] w-full xl:h-full xl:min-h-0">
              <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-lg border bg-card/95 px-2.5 py-1.5 shadow-sm backdrop-blur">
                <span className="truncate text-sm font-semibold">{selectedSchool?.en ?? "No school selected"}</span>
                {homeToSchoolKm != null && (
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{homeToSchoolKm.toFixed(2)} km · {schoolsWithinRadius} within</span>
                )}
              </div>
              <MapContainer center={[homeLat, homeLng]} zoom={13} scrollWheelZoom className="z-0 h-full w-full">
                <MapResizeSync />
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                <RadiusCircles homeLat={homeLat} homeLng={homeLng} schools={circleSchools} />

                <Marker position={[homeLat, homeLng]} icon={iconHome} zIndexOffset={1000}>
                  <LeafletTooltip direction="top" offset={[0, -14]} opacity={1} className="school-tooltip">
                    <span style={{ fontWeight: 700 }}>Home</span>
                    <span style={{ fontFamily: "monospace", opacity: 0.7 }}>{homeLat.toFixed(5)}, {homeLng.toFixed(5)}</span>
                  </LeafletTooltip>
                </Marker>

                {selectedSchool && (
                  <>
                    <Polyline
                      positions={[[homeLat, homeLng], [selectedSchool.lat, selectedSchool.lng]]}
                      pathOptions={{ color: "#b45309", weight: 2.5, opacity: 0.7, dashArray: "6 3" }}
                    />
                    <Marker position={[selectedSchool.lat, selectedSchool.lng]} icon={iconSelectedSchool} zIndexOffset={900}>
                      <LeafletTooltip direction="top" offset={[0, -12]} opacity={1} className="school-tooltip">
                        <span style={{ fontWeight: 700 }}>{selectedSchool.en}</span>
                        <span style={{ fontFamily: "monospace" }}>{homeToSchoolKm?.toFixed(2)} km &middot; {schoolsWithinRadius} schools within</span>
                      </LeafletTooltip>
                    </Marker>
                  </>
                )}

                {selectedNearbySchools.map((school, i) => {
                  const dist = haversineDistanceKm(homeLat, homeLng, school.lat, school.lng);
                  const color = RADIUS_COLORS[(i + 1) % RADIUS_COLORS.length];
                  return (
                    <span key={`nearby-${school.id}`}>
                      <Polyline
                        positions={[[homeLat, homeLng], [school.lat, school.lng]]}
                        pathOptions={{ color, weight: 1.5, opacity: 0.5, dashArray: "4 4" }}
                      />
                      <Marker position={[school.lat, school.lng]} icon={iconSchool} zIndexOffset={800}>
                        <LeafletTooltip direction="top" offset={[0, -6]} opacity={1} className="school-tooltip">
                          <span style={{ fontWeight: 600 }}>{school.en}</span>
                          <span style={{ fontFamily: "monospace" }}>{dist.toFixed(2)} km</span>
                        </LeafletTooltip>
                      </Marker>
                    </span>
                  );
                })}

                {allSchools
                  .filter((s) => s.id !== selectedSchoolId && !selectedNearbyIds.has(s.id))
                  .map((school) => {
                    const compatible = appliedGenderType ? isGenderCompatible(school.genderType, appliedGenderType) : true;
                    return (
                      <Marker key={school.id} position={[school.lat, school.lng]} icon={compatible ? iconSchool : iconIneligible} opacity={compatible ? 1 : 0.4}>
                        <LeafletTooltip direction="top" offset={[0, -6]} opacity={1} className="school-tooltip">
                          <span style={{ fontWeight: 600 }}>{school.en}</span>
                          <span style={{ fontFamily: "monospace" }}>{school.distanceKm.toFixed(1)} km</span>
                          {!compatible && <span style={{ opacity: 0.6, fontSize: "0.65rem" }}>Ineligible</span>}
                        </LeafletTooltip>
                      </Marker>
                    );
                  })}

                {located.map((applicant) => {
                  const dist = haversineDistanceKm(homeLat, homeLng, applicant.latitude!, applicant.longitude!);
                  return (
                    <span key={`app-${applicant.id}`}>
                      <Polyline
                        positions={[[homeLat, homeLng], [applicant.latitude!, applicant.longitude!]]}
                        pathOptions={{ color: "#3b82f6", weight: 1, opacity: 0.15, dashArray: "3 3" }}
                      />
                      <Marker position={[applicant.latitude!, applicant.longitude!]} icon={iconApplicant} zIndexOffset={500}>
                        <LeafletTooltip direction="top" offset={[0, -6]} opacity={1} className="school-tooltip">
                          <span style={{ fontWeight: 600 }}>{applicant.applicantName}</span>
                          <span style={{ fontFamily: "monospace" }}>{dist.toFixed(1)} km from home</span>
                        </LeafletTooltip>
                      </Marker>
                    </span>
                  );
                })}
              </MapContainer>
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
    </main>
  );
}
