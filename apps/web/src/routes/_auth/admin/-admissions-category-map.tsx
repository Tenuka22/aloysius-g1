"use client";

import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip as LeafletTooltip, useMap } from "react-leaflet";
import L, { DivIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { haversineDistanceKm } from "@/lib/school-utils";
import { HOME_SCHOOL_ID, getHomeSchoolDisplayName } from "@/lib/school-config";
import { findSchoolById } from "@/lib/school-utils";

export type LocationEvidence = {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  source: string;
  group: "selected" | "true" | "admin";
};

const SCHOOL_COORDS_FALLBACK = { lat: 6.0456, lng: 80.2086 };

function getSchoolCoords(): { lat: number; lng: number } {
  // Resolve at read time so manual DB overrides (schools hub) apply here too.
  const school = findSchoolById(HOME_SCHOOL_ID);
  if (school?.lat != null && school?.lng != null) return { lat: school.lat, lng: school.lng };
  return SCHOOL_COORDS_FALLBACK;
}

// Accessor object keeps every existing SCHOOL_COORDS.lat/.lng read live against
// the merged catalog (fallback to a Galle-center pin if coordinates are absent).
const SCHOOL_COORDS: { lat: number; lng: number } = {
  get lat() {
    return getSchoolCoords().lat;
  },
  get lng() {
    return getSchoolCoords().lng;
  },
};

const LOCATION_COLORS = [
  { border: "#065f46", fill: "#13b77e" },
  { border: "#1e40af", fill: "#3b82f6" },
  { border: "#9333ea", fill: "#a855f7" },
  { border: "#c2410c", fill: "#f97316" },
  { border: "#be123c", fill: "#fb7185" },
  { border: "#0e7490", fill: "#06b6d4" },
  { border: "#4338ca", fill: "#818cf8" },
  { border: "#a16207", fill: "#eab308" },
];

const RADIUS_COLORS = ["#dc2626", "#ea580c", "#d97706", "#65a30d", "#0891b2"];

function SchoolCircles({ points }: { points: LocationEvidence[] }) {
  const map = useMap();
  useEffect(() => {
    const layers: L.Circle[] = [];
    for (const point of points) {
      const color = RADIUS_COLORS[points.indexOf(point) % RADIUS_COLORS.length];
      const distKm = haversineDistanceKm(point.latitude, point.longitude, SCHOOL_COORDS.lat, SCHOOL_COORDS.lng);
      const circle = L.circle([point.latitude, point.longitude], {
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
  }, [map, points]);
  return null;
}

function createSchoolIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`;
  const size = 32;
  return new DivIcon({
    className: "",
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;background:#f59e0b;border:2.5px solid #b45309;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.25);color:#fff;transform:translateY(-8px)">${svg}<div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid #b45309"/></div>`,
  });
}

const iconSchool = createSchoolIcon();

function MapClickHandler({ editMode, onMapClickRef }: { editMode: boolean; onMapClickRef: React.RefObject<(lat: number, lng: number) => void> }) {
  const map = useMap();
  useEffect(() => {
    if (!editMode) return;
    const handler = (e: L.LeafletMouseEvent) => { onMapClickRef.current?.(e.latlng.lat, e.latlng.lng); };
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [map, editMode, onMapClickRef]);
  return null;
}

export interface AdmissionsCategoryMapProps {
  visiblePoints: LocationEvidence[];
  allPoints: LocationEvidence[];
  editMode: boolean;
  onMapClickRef: React.RefObject<(lat: number, lng: number) => void>;
  pendingPin: { lat: number; lng: number } | null;
  effectivePin: LocationEvidence | null;
  editPosition: [number, number];
}

export default function AdmissionsCategoryMap({
  visiblePoints,
  allPoints,
  editMode,
  onMapClickRef,
  pendingPin,
  effectivePin,
  editPosition,
}: AdmissionsCategoryMapProps) {
  return (
    <MapContainer center={[SCHOOL_COORDS.lat, SCHOOL_COORDS.lng]} zoom={13} scrollWheelZoom className="z-0 h-[420px] w-full max-md:h-[320px]">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <SchoolCircles points={visiblePoints} />
      <MapClickHandler editMode={editMode} onMapClickRef={onMapClickRef} />

      {visiblePoints.map(point => {
        const globalIdx = allPoints.findIndex(p => p.id === point.id);
        const color = RADIUS_COLORS[globalIdx % RADIUS_COLORS.length];
        return (
          <Polyline
            key={`line-${point.id}`}
            positions={[[point.latitude, point.longitude], [SCHOOL_COORDS.lat, SCHOOL_COORDS.lng]]}
            pathOptions={{ color, weight: 1.5, opacity: 0.5, dashArray: "4 4" }}
          />
        );
      })}

      <Marker position={[SCHOOL_COORDS.lat, SCHOOL_COORDS.lng]} icon={iconSchool} zIndexOffset={800}>
        <LeafletTooltip direction="top" offset={[0, -12]} opacity={1}>{getHomeSchoolDisplayName()}</LeafletTooltip>
      </Marker>

      {visiblePoints.map(point => {
        const globalIdx = allPoints.findIndex(p => p.id === point.id);
        const isEffective = effectivePin?.id === point.id;
        const isAdmin = point.group === "admin";
        const color = isAdmin
          ? { border: "#b45309", fill: "#f59e0b" }
          : LOCATION_COLORS[globalIdx % LOCATION_COLORS.length];
        const r = isEffective ? 11 : 7;
        const fillOpacity = isEffective ? 0.95 : 0.55;
        const dist = haversineDistanceKm(point.latitude, point.longitude, SCHOOL_COORDS.lat, SCHOOL_COORDS.lng);
        return (
          <CircleMarker
            key={point.id}
            center={[point.latitude, point.longitude]}
            radius={r}
            pathOptions={{ color: color.border, fillColor: color.fill, fillOpacity, weight: isEffective ? 3 : 2 }}
          >
            <LeafletTooltip direction="top">
              <strong>{point.label}</strong><br />
              {dist.toFixed(1)} km to school{isEffective ? " (active)" : ""}{isAdmin ? " · Admin override" : ""}
            </LeafletTooltip>
          </CircleMarker>
        );
      })}

      {/* Pending pin while in edit mode */}
      {editMode && (
        <CircleMarker
          center={editPosition}
          radius={12}
          pathOptions={{ color: "#c2410c", fillColor: "#f97316", fillOpacity: pendingPin ? 0.9 : 0.4, weight: 3, dashArray: pendingPin ? undefined : "4 4" }}
        >
          <LeafletTooltip direction="top" permanent={!pendingPin}>
            {pendingPin ? "New admin location — click Save location" : "Click map to set admin location"}
          </LeafletTooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
