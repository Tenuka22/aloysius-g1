import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [7.8731, 80.7718];

function MapSync({ point, onSelect }: { point: [number, number] | null; onSelect: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => { if (point) map.flyTo(point, Math.max(map.getZoom(), 13), { duration: 0.6 }); }, [map, point]);
  useMapEvents({ click: (event) => onSelect(event.latlng.lat, event.latlng.lng) });
  return point ? <CircleMarker center={point} radius={10} pathOptions={{ color: "#087f5b", fillColor: "#13b77e", fillOpacity: 0.9, weight: 3 }} /> : null;
}

export default function LocationStepMap({ point, readOnly, onSelect }: { point: [number, number] | null; readOnly: boolean; onSelect: (lat: number, lng: number) => void }) {
  return (
    <MapContainer center={point ?? DEFAULT_CENTER} zoom={point ? 13 : 7} scrollWheelZoom className="h-full min-h-[360px] z-0 max-md:min-h-[300px]">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {!readOnly && <MapSync point={point} onSelect={onSelect} />}
    </MapContainer>
  );
}
