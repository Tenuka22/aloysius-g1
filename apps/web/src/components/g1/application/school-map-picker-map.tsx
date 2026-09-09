import { useEffect } from "react";
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip as RlTooltip, useMap } from "react-leaflet";
import { DivIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { findSchoolById, isGenderCompatible } from "@/lib/g1/school-utils";
import type { SchoolWithDistance } from "@/lib/g1/school-utils";
import { HOME_SCHOOL_ID, MAP_MARKER_COLORS } from "@/lib/g1/school-config";
import type { GenderType } from "@/lib/g1/schools";

type SchoolMapPickerMapProps = {
  centerLat: number;
  centerLng: number;
  selectedIds: string[];
  highlightSchoolId?: string;
  radiusKm: number;
  displayRadius: number;
  schools: SchoolWithDistance[];
  appliedGenderType?: GenderType;
  onToggle?: (schoolId: string) => void;
  readOnly?: boolean;
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

const iconHome = createIcon(HOME_SVG, MAP_MARKER_COLORS.home.bg, MAP_MARKER_COLORS.home.border, 34);
const iconApplied = createIcon(SCHOOL_SVG, MAP_MARKER_COLORS.applied.bg, MAP_MARKER_COLORS.applied.border, 36);
const iconSelectedIn = createIcon(SCHOOL_SVG, MAP_MARKER_COLORS.selectedIn.bg, MAP_MARKER_COLORS.selectedIn.border, 32);
const iconSelectedOut = createIcon(SCHOOL_SVG, MAP_MARKER_COLORS.selectedOut.bg, MAP_MARKER_COLORS.selectedOut.border, 32);
const iconUnselectedIn = createIcon(SCHOOL_SVG, MAP_MARKER_COLORS.unselectedIn.bg, MAP_MARKER_COLORS.unselectedIn.border, 26);
const iconUnselectedOut = createIcon(SCHOOL_SVG, MAP_MARKER_COLORS.unselectedOut.bg, MAP_MARKER_COLORS.unselectedOut.border, 22);
const iconIneligible = createIcon(SCHOOL_SVG, MAP_MARKER_COLORS.ineligible.bg, MAP_MARKER_COLORS.ineligible.border, 20);

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

export default function SchoolMapPickerMap({
  centerLat,
  centerLng,
  selectedIds,
  highlightSchoolId,
  radiusKm,
  displayRadius,
  schools,
  appliedGenderType,
  onToggle,
  readOnly,
}: SchoolMapPickerMapProps) {
  const highlightSchool = highlightSchoolId ? findSchoolById(highlightSchoolId) : undefined;
  // Guard against NaN or invalid coordinates that would crash Leaflet.
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
    return null;
  }
  // Only render markers for schools within the eligible radius (+ near-boundary
  // buffer) - rendering every school nationwide made the map unusable.
  const nearbySchools = schools.filter((s) => s.distanceKm <= displayRadius);

  return (
    <>
      <div className="relative overflow-hidden rounded-xl border" aria-label="OpenStreetMap nearby schools">
        <MapContainer center={[centerLat, centerLng]} zoom={13} scrollWheelZoom className="h-[500px] w-full z-0 max-md:h-[360px]">
          <MapResizeSync />
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          <Circle center={[centerLat, centerLng]} radius={radiusKm * 1000} pathOptions={{ color: MAP_MARKER_COLORS.radius.stroke, fillColor: MAP_MARKER_COLORS.radius.fill, fillOpacity: 0.04, weight: 2, dashArray: "8 4" }} />

          {highlightSchool && highlightSchool.lat != null && highlightSchool.lng != null && (
            <Polyline
              positions={[[centerLat, centerLng], [highlightSchool.lat, highlightSchool.lng]]}
              pathOptions={{ color: MAP_MARKER_COLORS.line.in, weight: 2, opacity: 0.6, dashArray: "4 4" }}
            />
          )}

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

          {nearbySchools.map((school) => {
            if (school.id === highlightSchoolId) return null;
            const selected = selectedIds.includes(school.id);
            const within = school.distanceKm <= radiusKm;
            const compatible = appliedGenderType ? isGenderCompatible(school.genderType, appliedGenderType) : true;
            const icon = !compatible ? iconIneligible : selected ? (within ? iconSelectedIn : iconSelectedOut) : (within ? iconUnselectedIn : iconUnselectedOut);
            const offset = within ? -6 : -4;
            return (
              <Marker key={school.id} position={[school.lat, school.lng]} icon={icon} eventHandlers={{ click: () => !readOnly && compatible && onToggle?.(school.id) }}>
                <RlTooltip direction="top" offset={[0, offset]} opacity={1} className="school-tooltip">
                  <span style={{ fontWeight: 600 }}>{school.en}</span>
                  <span style={{ opacity: 0.7 }}>({GENDER_LABELS[school.genderType]})</span>
                  {!compatible && <span style={{ color: MAP_MARKER_COLORS.ineligible.border, fontSize: "0.65rem" }}>Ineligible</span>}
                  <span style={{ fontFamily: "monospace" }}>{school.distanceKm.toFixed(1)} km</span>
                </RlTooltip>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <style>{`.school-tooltip{background:#18181b!important;color:#fafafa!important;border:1px solid #27272a!important;border-radius:8px!important;padding:6px 10px!important;font-size:12px!important;box-shadow:0 4px 12px rgba(0,0,0,.3)!important;white-space:nowrap!important;display:flex;flex-direction:column;gap:1px!important}.school-tooltip::before{border-top-color:#18181b!important}`}</style>
    </>
  );
}
