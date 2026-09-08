import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import { DivIcon } from "leaflet";
import "leaflet/dist/leaflet.css";

const GALLE_CENTER: [number, number] = [6.055, 80.211];

function SchoolPinIcon({ size = 30 }: { size?: number } = {}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
  return new DivIcon({
    className: "",
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
    html: `<div style="display:grid;place-items:center;width:${size}px;height:${size}px;background:#0e7490;border:2px solid #155e75;border-radius:50% 50% 50% 0;transform:rotate(-45deg) translateY(-4px);box-shadow:0 2px 8px rgba(0,0,0,.3)"><div style="transform:rotate(45deg) translateY(2px);display:grid;place-items:center">${svg}</div></div>`,
  });
}

const iconSchool = SchoolPinIcon();

function MapClickPicker({ onPick, position }: { onPick: (lat: number, lng: number) => void; position: [number, number] | null }) {
  useMapEvents({
    click: (event) => onPick(event.latlng.lat, event.latlng.lng),
  });
  return position ? <Marker position={position} icon={iconSchool} draggable eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onPick(p.lat, p.lng); } }} /> : null;
}

interface SchoolMapProps {
  lat: number;
  lng: number;
  onPick: (lat: number, lng: number) => void;
}

export default function SchoolMap({ lat, lng, onPick }: SchoolMapProps) {
  return (
    <MapContainer center={GALLE_CENTER} zoom={11} scrollWheelZoom className="h-[360px] w-full z-0">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapClickPicker position={[lat, lng]} onPick={onPick} />
    </MapContainer>
  );
}
