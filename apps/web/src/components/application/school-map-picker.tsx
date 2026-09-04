import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip as RlTooltip, useMap } from "react-leaflet";
import { DivIcon } from "leaflet";
import { Checkbox } from "@aloysius-g1/ui/components/checkbox";
import { haversineDistanceKm, getAllSchoolsWithDistance, findSchoolById, isGenderCompatible } from "@/lib/school-utils";
import type { GenderType } from "@/lib/schools";
import "leaflet/dist/leaflet.css";
import { STATUS_SUCCESS, STATUS_WARNING } from "@/lib/color-classes";

type SchoolMapPickerProps = {
  centerLat: number;
  centerLng: number;
  selectedIds: string[];
  highlightSchoolId?: string;
  marksPerSchool?: number;
  onToggle: (schoolId: string) => void;
};

const GENDER_LABELS: Record<GenderType, string> = {
  boys: "Boys",
  girls: "Girls",
  mixed: "Mixed",
};

const EXTRA_BEYOND_RADIUS_KM = 0.5;

const SCHOOL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`;
const HOME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;

function createIcon(svg: string, bgColor: string, borderColor: string, size = 32) {
  return new DivIcon({
    className: "",
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 8)],
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;background:${bgColor};border:2.5px solid ${borderColor};border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.25);color:#fff;transform:translateY(-8px)">${svg}<div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid ${borderColor}"/></div>`,
  });
}

const iconHome = createIcon(HOME_SVG, "#dc2626", "#991b1b", 34);
const iconApplied = createIcon(SCHOOL_SVG, "#f59e0b", "#b45309", 36);
const iconSelectedIn = createIcon(SCHOOL_SVG, "#087f5b", "#065f46", 32);
const iconSelectedOut = createIcon(SCHOOL_SVG, "#f97316", "#c2410c", 32);
const iconUnselectedIn = createIcon(SCHOOL_SVG, "#64748b", "#475569", 26);
const iconUnselectedOut = createIcon(SCHOOL_SVG, "#94a3b8", "#64748b", 22);

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

export function SchoolMapPicker({ centerLat, centerLng, selectedIds, highlightSchoolId, marksPerSchool, onToggle }: SchoolMapPickerProps) {
  const highlightSchool = highlightSchoolId ? findSchoolById(highlightSchoolId) : undefined;
  const appliedGenderType = highlightSchool?.genderType;

  const radiusKm = useMemo(() => {
    if (!highlightSchool || highlightSchool.lat == null || highlightSchool.lng == null) return 10;
    return haversineDistanceKm(centerLat, centerLng, highlightSchool.lat, highlightSchool.lng);
  }, [centerLat, centerLng, highlightSchool]);

  const displayRadius = radiusKm + EXTRA_BEYOND_RADIUS_KM;

  const schools = useMemo(() => getAllSchoolsWithDistance(centerLat, centerLng), [centerLat, centerLng]);

  const withinRadius = useMemo(() => schools.filter((s) => s.distanceKm <= radiusKm), [schools, radiusKm]);
  const justOutside = useMemo(() => schools.filter((s) => s.distanceKm > radiusKm && s.distanceKm <= displayRadius), [schools, radiusKm, displayRadius]);
  const selectedSchools = useMemo(() => schools.filter((s) => selectedIds.includes(s.id)), [schools, selectedIds]);
  const withinSelected = useMemo(() => selectedSchools.filter((s) => s.distanceKm <= radiusKm), [selectedSchools, radiusKm]);
  const outsideSelected = useMemo(() => selectedSchools.filter((s) => s.distanceKm > radiusKm), [selectedSchools, radiusKm]);

  return (
    <div className="grid gap-4">
      <div className="relative overflow-hidden rounded-xl border" aria-label="OpenStreetMap nearby schools">
        <MapContainer center={[centerLat, centerLng]} zoom={13} scrollWheelZoom className="h-[500px] w-full z-0 max-md:h-[360px]">
          <MapResizeSync />
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          <Circle center={[centerLat, centerLng]} radius={radiusKm * 1000} pathOptions={{ color: "#087f5b", fillColor: "#13b77e", fillOpacity: 0.04, weight: 2, dashArray: "8 4" }} />

          {withinSelected.map((school) => (
            <Polyline key={`line-in-${school.id}`} positions={[[centerLat, centerLng], [school.lat, school.lng]]} pathOptions={{ color: "#087f5b", weight: 2, opacity: 0.5, dashArray: "4 4" }} />
          ))}
          {outsideSelected.map((school) => (
            <Polyline key={`line-out-${school.id}`} positions={[[centerLat, centerLng], [school.lat, school.lng]]} pathOptions={{ color: "#f97316", weight: 2, opacity: 0.6, dashArray: "6 3" }} />
          ))}

          <Marker position={[centerLat, centerLng]} icon={iconHome} zIndexOffset={1000}>
            <RlTooltip direction="top" offset={[0, -10]} opacity={1} className="school-tooltip">Your home</RlTooltip>
          </Marker>

          {highlightSchool && highlightSchool.lat != null && highlightSchool.lng != null && (
            <Marker position={[highlightSchool.lat, highlightSchool.lng]} icon={iconApplied} zIndexOffset={900}>
              <RlTooltip direction="top" offset={[0, -12]} opacity={1} className="school-tooltip">
                {highlightSchool.en} (Applied school)
              </RlTooltip>
            </Marker>
          )}

          {schools.map((school) => {
            if (school.id === highlightSchoolId) return null;
            const selected = selectedIds.includes(school.id);
            const within = school.distanceKm <= radiusKm;
            const icon = selected ? (within ? iconSelectedIn : iconSelectedOut) : (within ? iconUnselectedIn : iconUnselectedOut);
            const offset = within ? -6 : -4;
            return (
              <Marker key={school.id} position={[school.lat, school.lng]} icon={icon} eventHandlers={{ click: () => onToggle(school.id) }}>
                <RlTooltip direction="top" offset={[0, offset]} opacity={1} className="school-tooltip">
                  <span style={{ fontWeight: 600 }}>{school.en}</span>
                  <span style={{ opacity: 0.7 }}>({GENDER_LABELS[school.genderType]})</span>
                  <span style={{ fontFamily: "monospace" }}>{school.distanceKm.toFixed(1)} km</span>
                </RlTooltip>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <style>{`.school-tooltip{background:#18181b!important;color:#fafafa!important;border:1px solid #27272a!important;border-radius:8px!important;padding:6px 10px!important;font-size:12px!important;box-shadow:0 4px 12px rgba(0,0,0,.3)!important;white-space:nowrap!important;display:flex;flex-direction:column;gap:1px!important}.school-tooltip::before{border-top-color:#18181b!important}`}</style>

      <p className="text-sm text-muted-foreground" role="status">
        Radius: {radiusKm.toFixed(1)} km (home to {highlightSchool?.en ?? "applied school"}) &middot; {withinRadius.length} within &middot; {justOutside.length} near boundary
      </p>
      <a
        href={`https://earth.google.com/web/search/${centerLat},${centerLng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
      >
        Open home location on Google Earth ({centerLat.toFixed(5)}, {centerLng.toFixed(5)})
      </a>

      <ul className="grid gap-1.5 max-h-[400px] overflow-y-auto">
        {withinRadius.map((school) => {
          const rowId = `school-option-${school.id}`;
          const isHighlighted = school.id === highlightSchoolId;
          if (isHighlighted) {
            return (
              <li key={school.id}>
                <div className={`flex items-center gap-3 rounded-lg border ${STATUS_WARNING.border} ${STATUS_WARNING.bg} dark:bg-amber-950/20 p-3 text-sm cursor-default`}>
                  <span className={`size-5 shrink-0 rounded border-2 border-amber-400 bg-amber-100 dark:bg-amber-900 flex items-center justify-center`}>
                    <svg className={`size-3 ${STATUS_WARNING.text} ${STATUS_WARNING.textDark}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    {school.en} <span className="text-muted-foreground">({GENDER_LABELS[school.genderType]})</span>
                    <span className={`ml-1 ${STATUS_WARNING.text} ${STATUS_WARNING.textDark} text-xs font-semibold`}>Applied school</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{school.distanceKm.toFixed(1)} km</span>
                </div>
              </li>
            );
          }
          const compatible = appliedGenderType ? isGenderCompatible(school.genderType, appliedGenderType) : true;
          return (
            <li key={school.id}>
              <label htmlFor={rowId} className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${compatible ? "hover:bg-muted/50" : "opacity-50 cursor-not-allowed"}`}>
                <Checkbox id={rowId} className="size-5 shrink-0" checked={selectedIds.includes(school.id)} disabled={!compatible} onCheckedChange={() => compatible && onToggle(school.id)} />
                <span className="min-w-0 flex-1">
                  {school.en} <span className="text-muted-foreground">({GENDER_LABELS[school.genderType]})</span>
                  {!compatible && <span className="ml-1 text-xs text-muted-foreground">Ineligible</span>}
                </span>
                {marksPerSchool != null && (
                  <span className={`shrink-0 text-xs font-semibold ${STATUS_SUCCESS.textStrong} dark:text-emerald-300 tabular-nums`}>{marksPerSchool} marks</span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{school.distanceKm.toFixed(1)} km</span>
              </label>
            </li>
          );
        })}

        {justOutside.length > 0 && <li className="text-xs text-muted-foreground font-medium pt-2 border-t mt-1">Near boundary (within +{EXTRA_BEYOND_RADIUS_KM} km)</li>}
        {justOutside.map((school) => {
          const isHighlighted = school.id === highlightSchoolId;
          if (isHighlighted) {
            return (
              <li key={school.id} className="opacity-50">
                <div className={`flex items-center gap-3 rounded-lg border ${STATUS_WARNING.borderDash} ${STATUS_WARNING.bg} dark:bg-amber-950/20 p-3 text-sm cursor-default`}>
                  <span className={`size-5 shrink-0 rounded border-2 border-amber-400 bg-amber-100 dark:bg-amber-900 flex items-center justify-center`}>
                    <svg className={`size-3 ${STATUS_WARNING.text} ${STATUS_WARNING.textDark}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    {school.en} <span className="text-muted-foreground">({GENDER_LABELS[school.genderType]})</span>
                    <span className={`ml-1 ${STATUS_WARNING.text} ${STATUS_WARNING.textDark} text-xs font-semibold`}>Applied school</span>
                    <span className="ml-1 text-orange-500 text-xs font-semibold">Just outside</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{school.distanceKm.toFixed(1)} km</span>
                </div>
              </li>
            );
          }
          const compatible = appliedGenderType ? isGenderCompatible(school.genderType, appliedGenderType) : true;
          return (
            <li key={school.id} className="opacity-50">
              <label htmlFor={`school-option-${school.id}`} className={`flex items-center gap-3 rounded-lg border border-dashed p-3 text-sm ${compatible ? "hover:bg-muted/50" : "cursor-not-allowed"}`}>
                <Checkbox id={`school-option-${school.id}`} className="size-5 shrink-0" checked={selectedIds.includes(school.id)} disabled={!compatible} onCheckedChange={() => compatible && onToggle(school.id)} />
                <span className="min-w-0 flex-1">
                  {school.en} <span className="text-muted-foreground">({GENDER_LABELS[school.genderType]})</span>
                  {!compatible && <span className="ml-1 text-xs text-muted-foreground">Ineligible</span>}
                  {compatible && <span className="ml-1 text-orange-500 text-xs font-semibold">Just outside</span>}
                </span>
                {marksPerSchool != null && (
                  <span className={`shrink-0 text-xs font-semibold ${STATUS_SUCCESS.textStrong} dark:text-emerald-300 tabular-nums`}>{marksPerSchool} marks</span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{school.distanceKm.toFixed(1)} km</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
