import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { LocateFixed, TriangleAlert } from "lucide-react";
import "leaflet/dist/leaflet.css";

type LocationValue = { label: string; address: string; latitude: number | null; longitude: number | null; source: "manual" | "device" | "map" | "" };

const DEFAULT_CENTER: [number, number] = [7.8731, 80.7718];

function MapSync({ point, onSelect }: { point: [number, number] | null; onSelect: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => { if (point) map.flyTo(point, Math.max(map.getZoom(), 13), { duration: 0.6 }); }, [map, point]);
  useMapEvents({ click: (event) => onSelect(event.latlng.lat, event.latlng.lng) });
  return point ? <CircleMarker center={point} radius={10} pathOptions={{ color: "#087f5b", fillColor: "#13b77e", fillOpacity: 0.9, weight: 3 }} /> : null;
}

export function LocationStep({ value, defaultValue, onChange, onAvailabilityChange }: { value: LocationValue; defaultValue: LocationValue; onChange: (value: LocationValue, defaultValue?: LocationValue) => void; onAvailabilityChange?: (canProceed: boolean) => void }) {
  const [query, setQuery] = useState(value.address || value.label);
  const [status, setStatus] = useState("");
  const [deviceLocationAvailable, setDeviceLocationAvailable] = useState(true);
  const point = useMemo<[number, number] | null>(() => value.latitude !== null && value.longitude !== null ? [value.latitude, value.longitude] : null, [value.latitude, value.longitude]);

  const reverseGeocode = async (latitude: number, longitude: number, source: LocationValue["source"], isDefault = false) => {
    const selected = { ...value, latitude, longitude, source, label: "Selected location", address: value.address };
    onChange(selected, isDefault ? selected : undefined);
    setStatus("Finding the nearest address…");
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, { headers: { Accept: "application/json" } });
      const result = await response.json();
      const address = result.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      setQuery(address);
      const selected = { ...value, latitude, longitude, source, label: result.name || "Selected location", address };
      onChange(selected, isDefault ? selected : undefined);
      setStatus("Location selected");
    } catch { setStatus("The map point is saved. Address lookup is unavailable right now."); }
  };

  const useDeviceLocation = (isDefault = false) => {
    if (!navigator.geolocation) { setDeviceLocationAvailable(false); onAvailabilityChange?.(true); setStatus("Device location is not available in this browser. You may enter an address or choose a point on the map."); return; }
    if (!navigator.geolocation) { setStatus("Location is not available in this browser. Enter an address or choose on the map."); return; }
    setStatus("Requesting your device location…");
    navigator.geolocation.getCurrentPosition(({ coords }) => { onAvailabilityChange?.(true); void reverseGeocode(coords.latitude, coords.longitude, "device", isDefault); }, () => { onAvailabilityChange?.(false); setStatus("Please allow location access in your browser to continue. If this device does not support location, use a different device."); }, { enableHighAccuracy: true, timeout: 10000 });
  };

  useEffect(() => { if (!navigator.geolocation) { setDeviceLocationAvailable(false); onAvailabilityChange?.(true); } else if (defaultValue.latitude === null && value.latitude === null) useDeviceLocation(true); else onAvailabilityChange?.(true); }, []);

  return <div className="location-layout">
    <div className="form-panel">
      <div className="field-group">
        <label htmlFor="location-search">Where does the applicant live?</label>
        <p className="field-help">Choose the applicant’s home location. This is used to help determine the nearest school.</p>
        <input id="location-search" value={query} onChange={(event) => { setQuery(event.target.value); onChange({ ...value, address: event.target.value, source: "manual" }); }} placeholder="Enter an address or landmark" />
      </div>
      <button type="button" className="secondary-button full-button" onClick={() => useDeviceLocation(false)}><LocateFixed size={17} /> Use my current device location</button>
      {defaultValue.latitude !== null && <p className="field-help">Default browser location saved. The selected location can be changed below.</p>}
      {deviceLocationAvailable && defaultValue.latitude === null && <p className="error-line"><TriangleAlert size={16} /> Browser location permission is required to continue.</p>}
      {status && <p className="status-line" role="status">{status}</p>}
      {value.latitude === null && <p className="error-line"><TriangleAlert size={16} /> Select a point on the map or use your device location to continue.</p>}
    </div>
    <div className="map-frame" aria-label="OpenStreetMap location picker">
      <MapContainer center={point ?? DEFAULT_CENTER} zoom={point ? 13 : 7} scrollWheelZoom className="application-map">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapSync point={point} onSelect={(lat, lng) => void reverseGeocode(lat, lng, "map")} />
      </MapContainer>
      <div className="map-caption">Click the map to place the location pin</div>
    </div>
  </div>;
}
