import { useEffect } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip as LeafletTooltip, useMap } from "react-leaflet";
import L, { DivIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { haversineDistanceKm, isGenderCompatible } from "@/lib/school-utils";
import type { GenderType } from "@/lib/schools";

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

function createLabeledIcon(svg: string, bgColor: string, borderColor: string, label: string, size = 24) {
  return new DivIcon({
    className: "",
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 8)],
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px"><div style="position:relative;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;background:${bgColor};border:2px solid ${borderColor};border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.3);color:#fff">${svg}</div><span style="font-size:10px;font-weight:600;color:#1e293b;background:rgba(255,255,255,.85);padding:1px 4px;border-radius:3px;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;line-height:1.2">${label}</span></div>`,
  });
}

const iconHome = createIcon(HOME_SVG, "#dc2626", "#991b1b", 34);
const iconSchool = createIcon(SCHOOL_SVG, "#64748b", "#475569", 24);
const iconIneligible = createIcon(SCHOOL_SVG, "#c4b5fd", "#8b5cf6", 18);
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

interface AdminMapViewProps {
  homeLat: number;
  homeLng: number;
  selectedSchool?: { id: string; en: string; lat: number; lng: number; genderType: GenderType };
  homeToSchoolKm: number | null;
  schoolsWithinRadius: number;
  selectedNearbySchools: Array<{ id: string; en: string; lat: number; lng: number; genderType: GenderType; distanceKm: number }>;
  circleSchools: Array<{ lat: number; lng: number; id: string }>;
  allSchools: Array<{ id: string; en: string; lat: number; lng: number; genderType: GenderType; distanceKm: number }>;
  selectedSchoolId: string;
  selectedNearbyIds: Set<string>;
  appliedGenderType?: GenderType;
  located: Array<{ id: string; applicantName: string; latitude: number; longitude: number }>;
  fullscreen?: boolean;
}

export default function AdminMapView({
  homeLat,
  homeLng,
  selectedSchool,
  homeToSchoolKm,
  schoolsWithinRadius,
  selectedNearbySchools,
  circleSchools,
  allSchools,
  selectedSchoolId,
  selectedNearbyIds,
  appliedGenderType,
  located,
  fullscreen = false,
}: AdminMapViewProps) {
  const zoom = fullscreen ? 12 : 13;

  return (
    <MapContainer center={[homeLat, homeLng]} zoom={zoom} scrollWheelZoom className="z-0 h-full w-full">
      <MapResizeSync />
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      <RadiusCircles homeLat={homeLat} homeLng={homeLng} schools={circleSchools} />

      {fullscreen ? (
        <Marker position={[homeLat, homeLng]} icon={createLabeledIcon(HOME_SVG, "#dc2626", "#991b1b", "Home", 30)} zIndexOffset={1000} />
      ) : (
        <Marker position={[homeLat, homeLng]} icon={iconHome} zIndexOffset={1000}>
          <LeafletTooltip direction="top" offset={[0, -14]} opacity={1} className="school-tooltip">
            <span style={{ fontWeight: 700 }}>Home</span>
            <span style={{ fontFamily: "monospace", opacity: 0.7 }}>{homeLat.toFixed(5)}, {homeLng.toFixed(5)}</span>
          </LeafletTooltip>
        </Marker>
      )}

      {selectedSchool && (
        <>
          <Polyline
            positions={[[homeLat, homeLng], [selectedSchool.lat, selectedSchool.lng]]}
            pathOptions={{ color: "#b45309", weight: fullscreen ? 3 : 2.5, opacity: fullscreen ? 0.8 : 0.7, dashArray: fullscreen ? "8 4" : "6 3" }}
          />
          {fullscreen ? (
            <Marker position={[selectedSchool.lat, selectedSchool.lng]} icon={createLabeledIcon(SELECTED_SCHOOL_SVG, "#f59e0b", "#b45309", selectedSchool.en, 32)} zIndexOffset={900} />
          ) : (
            <Marker position={[selectedSchool.lat, selectedSchool.lng]} icon={iconSelectedSchool} zIndexOffset={900}>
              <LeafletTooltip direction="top" offset={[0, -12]} opacity={1} className="school-tooltip">
                <span style={{ fontWeight: 700 }}>{selectedSchool.en}</span>
                <span style={{ fontFamily: "monospace" }}>{homeToSchoolKm?.toFixed(2)} km &middot; {schoolsWithinRadius} schools within</span>
              </LeafletTooltip>
            </Marker>
          )}
        </>
      )}

      {selectedNearbySchools.map((school, i) => {
        const dist = haversineDistanceKm(homeLat, homeLng, school.lat, school.lng);
        const color = RADIUS_COLORS[(i + 1) % RADIUS_COLORS.length];
        return (
          <span key={`nearby-${school.id}`}>
            <Polyline
              positions={[[homeLat, homeLng], [school.lat, school.lng]]}
              pathOptions={{ color, weight: fullscreen ? 2 : 1.5, opacity: fullscreen ? 0.6 : 0.5, dashArray: fullscreen ? "6 3" : "4 4" }}
            />
            {fullscreen ? (
              <Marker position={[school.lat, school.lng]} icon={createLabeledIcon(SCHOOL_SVG, color, color, `${school.en} (${dist.toFixed(1)} km)`, 22)} zIndexOffset={800} />
            ) : (
              <Marker position={[school.lat, school.lng]} icon={iconSchool} zIndexOffset={800}>
                <LeafletTooltip direction="top" offset={[0, -6]} opacity={1} className="school-tooltip">
                  <span style={{ fontWeight: 600 }}>{school.en}</span>
                  <span style={{ fontFamily: "monospace" }}>{dist.toFixed(2)} km</span>
                </LeafletTooltip>
              </Marker>
            )}
          </span>
        );
      })}

      {allSchools
        .filter((s) => s.id !== selectedSchoolId && !selectedNearbyIds.has(s.id))
        .map((school) => {
          const compatible = appliedGenderType ? isGenderCompatible(school.genderType, appliedGenderType) : true;
          if (fullscreen) {
            return (
              <Marker
                key={`fs-${school.id}`}
                position={[school.lat, school.lng]}
                icon={compatible
                  ? createLabeledIcon(SCHOOL_SVG, "#64748b", "#475569", school.en, 18)
                  : createLabeledIcon(SCHOOL_SVG, "#c4b5fd", "#8b5cf6", school.en, 14)}
                opacity={compatible ? 0.7 : 0.7}
              />
            );
          }
          return (
            <Marker key={school.id} position={[school.lat, school.lng]} icon={compatible ? iconSchool : iconIneligible}>
              <LeafletTooltip direction="top" offset={[0, -6]} opacity={1} className="school-tooltip">
                <span style={{ fontWeight: 600 }}>{school.en}</span>
                <span style={{ fontFamily: "monospace" }}>{school.distanceKm.toFixed(1)} km</span>
                {!compatible && <span style={{ color: "#8b5cf6", fontSize: "0.65rem" }}>Ineligible</span>}
              </LeafletTooltip>
            </Marker>
          );
        })}

      {!fullscreen &&
        located.map((applicant) => {
          const dist = haversineDistanceKm(homeLat, homeLng, applicant.latitude, applicant.longitude);
          return (
            <span key={`app-${applicant.id}`}>
              <Polyline
                positions={[[homeLat, homeLng], [applicant.latitude, applicant.longitude]]}
                pathOptions={{ color: "#3b82f6", weight: 1, opacity: 0.15, dashArray: "3 3" }}
              />
              <Marker position={[applicant.latitude, applicant.longitude]} icon={iconApplicant} zIndexOffset={500}>
                <LeafletTooltip direction="top" offset={[0, -6]} opacity={1} className="school-tooltip">
                  <span style={{ fontWeight: 600 }}>{applicant.applicantName}</span>
                  <span style={{ fontFamily: "monospace" }}>{dist.toFixed(1)} km from home</span>
                </LeafletTooltip>
              </Marker>
            </span>
          );
        })}
    </MapContainer>
  );
}
