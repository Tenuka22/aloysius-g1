import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";
import { divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LocationDraft } from "@/lib/application-store";

const selectedLocationIcon = divIcon({ className: "bg-transparent border-0", html: "<span></span>", iconSize: [22, 22], iconAnchor: [11, 11] });

interface AdminApplicationEditorMapProps {
  browser?: LocationDraft;
  selected?: LocationDraft;
  history?: LocationDraft[];
  editable?: boolean;
  onSelectedChange?: (latitude: number, longitude: number) => void;
}

export default function AdminApplicationEditorMap({
  browser,
  selected,
  history = [],
  editable = false,
  onSelectedChange,
}: AdminApplicationEditorMapProps) {
  const browserPoint = browser?.latitude != null && browser?.longitude != null ? [browser.latitude, browser.longitude] as [number, number] : null;
  const selectedPoint = selected?.latitude != null && selected?.longitude != null ? [selected.latitude, selected.longitude] as [number, number] : null;
  const historyPoints = history
    .filter((entry) => entry.latitude != null && entry.longitude != null)
    .map((entry, index) => ({ coords: [entry.latitude!, entry.longitude!] as [number, number], label: entry.address || entry.label || `Previous pin ${index + 1}`, source: entry.source || "unknown" }));
  const allPoints = [...historyPoints.map((h) => h.coords), ...(browserPoint ? [browserPoint] : []), ...(selectedPoint ? [selectedPoint] : [])];
  const center = selectedPoint ?? browserPoint ?? (historyPoints.length > 0 ? historyPoints[0].coords : null) ?? [7.8731, 80.7718] as [number, number];

  return (
    <>
      <MapContainer center={center} zoom={allPoints.length > 0 ? 13 : 7} scrollWheelZoom style={{ height: "390px", width: "100%" }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {browserPoint && (
          <CircleMarker center={browserPoint} radius={8} pathOptions={{ color: "#1d4ed8", fillColor: "#60a5fa", fillOpacity: .9, weight: 2 }}>
            <Tooltip direction="top" permanent>Browser location</Tooltip>
          </CircleMarker>
        )}
        {historyPoints.map((entry, index) => {
          const isLast = index === historyPoints.length - 1;
          return (
            <CircleMarker key={`history-${index}`} center={entry.coords} radius={isLast ? 8 : 6} pathOptions={{ color: isLast ? "#d97706" : "#7c3aed", fillColor: isLast ? "#fbbf24" : "#a78bfa", fillOpacity: .9, weight: isLast ? 3 : 2 }}>
              <Tooltip direction="top">
                {entry.label}<br />
                <span className="font-mono text-[0.7rem]">{entry.coords[0].toFixed(5)}, {entry.coords[1].toFixed(5)}</span><br />
                Source: {entry.source}
                {isLast && <><br /><strong>Latest pin</strong></>}
              </Tooltip>
            </CircleMarker>
          );
        })}
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
    </>
  );
}
