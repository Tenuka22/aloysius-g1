import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip as RlTooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { findSchoolById, haversineDistanceKm } from "@/lib/g1/school-utils";
import { HOME_SCHOOL_ID, MAP_MARKER_COLORS } from "@/lib/g1/school-config";
import { iconApplied } from "./map-icons";

const DEFAULT_CENTER: [number, number] = [7.8731, 80.7718];

// Leaflet computes flyTo/pan animation frames by unprojecting pixel
// coordinates using the map's *current* size - if the container is still
// zero-sized (e.g. a dialog that hasn't finished its open animation yet, or
// the very first paint before layout settles), that projection math divides
// by zero and Leaflet throws "Invalid LatLng object: (NaN, NaN)" even though
// the target point itself is perfectly valid. invalidateSize() forces
// Leaflet to re-measure the real container size; MapResizeSync re-runs it on
// mount and whenever the container's size actually changes (resize, or a
// dialog finishing its expand transition).
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

function MapSync({ point, onSelect }: { point: [number, number] | null; onSelect: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return;
    // Re-measure before animating: guards the same zero-size-container race
    // MapResizeSync guards, for the specific case where this effect's flyTo
    // call fires before that mount-time invalidateSize has run.
    map.invalidateSize({ pan: false });
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) {
      map.setView(point, Math.max(map.getZoom(), 13), { animate: false });
      return;
    }
    map.flyTo(point, Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [map, point]);
  useMapEvents({ click: (event) => onSelect(event.latlng.lat, event.latlng.lng) });
  return null;
}

// Home pin plus, whenever the home point is set, the same distance
// visualisation the proximity marking category (6.1) draws on its own
// picker map (school-map-picker-map.tsx): a dashed radius circle centered on
// home whose radius is the home-to-Aloysius-College distance, a connecting
// line, and the school's own pin. Rendered unconditionally (not just from
// MapSync) so the read-only preview instances show it too, not only the
// interactive dialog/inline map.
function HomeMarkers({ point }: { point: [number, number] | null }) {
  if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null;
  const school = findSchoolById(HOME_SCHOOL_ID);
  const schoolPoint: [number, number] | null = school && school.lat != null && school.lng != null ? [school.lat, school.lng] : null;
  const radiusKm = schoolPoint ? haversineDistanceKm(point[0], point[1], schoolPoint[0], schoolPoint[1]) : null;
  return (
    <>
      {radiusKm !== null && schoolPoint && (
        <>
          <Circle
            center={point}
            radius={radiusKm * 1000}
            pathOptions={{ color: MAP_MARKER_COLORS.radius.stroke, fillColor: MAP_MARKER_COLORS.radius.fill, fillOpacity: 0.04, weight: 2, dashArray: "8 4" }}
          />
          <Polyline positions={[point, schoolPoint]} pathOptions={{ color: MAP_MARKER_COLORS.line.in, weight: 2, opacity: 0.6, dashArray: "4 4" }} />
          <Marker position={schoolPoint} icon={iconApplied} zIndexOffset={900}>
            <RlTooltip direction="top" offset={[0, -10]} opacity={1}>{school!.en}</RlTooltip>
          </Marker>
        </>
      )}
      <CircleMarker center={point} radius={10} pathOptions={{ color: "#087f5b", fillColor: "#13b77e", fillOpacity: 0.9, weight: 3 }} />
    </>
  );
}

export default function LocationStepMap({ point, readOnly, onSelect }: { point: [number, number] | null; readOnly: boolean; onSelect: (lat: number, lng: number) => void }) {
  const safeCenter: [number, number] = point && Number.isFinite(point[0]) && Number.isFinite(point[1]) ? point : DEFAULT_CENTER;
  return (
    <MapContainer center={safeCenter} zoom={point ? 13 : 7} scrollWheelZoom className="h-full w-full z-0">
      <MapResizeSync />
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {!readOnly && <MapSync point={point} onSelect={onSelect} />}
      <HomeMarkers point={point} />
    </MapContainer>
  );
}
