import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { LocateFixed, TriangleAlert } from "lucide-react";
import { Button } from "@aloysius-g1/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aloysius-g1/ui/components/dialog";
import { Field, FieldLabel, FieldDescription } from "@aloysius-g1/ui/components/field";
import { Input } from "@aloysius-g1/ui/components/input";
import "leaflet/dist/leaflet.css";

type LocationValue = { label: string; address: string; latitude: number | null; longitude: number | null; source: "manual" | "device" | "map" | "" };
const DEFAULT_CENTER: [number, number] = [7.8731, 80.7718];

function MapSync({ point, onSelect }: { point: [number, number] | null; onSelect: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => { if (point) map.flyTo(point, Math.max(map.getZoom(), 13), { duration: 0.6 }); }, [map, point]);
  useMapEvents({ click: (event) => onSelect(event.latlng.lat, event.latlng.lng) });
  return point ? <CircleMarker center={point} radius={10} pathOptions={{ color: "#087f5b", fillColor: "#13b77e", fillOpacity: 0.9, weight: 3 }} /> : null;
}

export function LocationStep({ value, defaultValue, onChange, onAvailabilityChange, readOnly = false }: { value: LocationValue; defaultValue: LocationValue; onChange: (value: LocationValue, defaultValue?: LocationValue) => void; onAvailabilityChange?: (canProceed: boolean) => void; readOnly?: boolean }) {
  const [query, setQuery] = useState(value.address || value.label);
  const [status, setStatus] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);
  const point = useMemo<[number, number] | null>(() => value.latitude !== null && value.longitude !== null ? [value.latitude, value.longitude] : null, [value.latitude, value.longitude]);

  const reverseGeocode = async (latitude: number, longitude: number, source: LocationValue["source"], isDefault = false) => {
    const devicePoint = { label: "Your location", address: value.address, latitude, longitude, source };

    if (isDefault) {
      onChange(value.latitude !== null ? value : devicePoint, devicePoint);
    } else {
      const selected = { ...value, latitude, longitude, source, label: "Selected location", address: value.address };
      onChange(selected, undefined);
    }

    setStatus("Finding the nearest address...");
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, { headers: { Accept: "application/json" } });
      const result = await response.json();
      const address = result.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      setQuery(address);
      const resolvedDevicePoint = { ...devicePoint, label: result.name || "Your location", address };
      const resolvedSelected = { ...value, latitude, longitude, source, label: "Selected location", address };
      if (isDefault) {
        onChange(value.latitude !== null ? resolvedSelected : resolvedDevicePoint, resolvedDevicePoint);
      } else {
        onChange(resolvedSelected, undefined);
      }
      setStatus("Location selected");
    } catch {
      setStatus("The map point is saved. Address lookup is unavailable right now.");
    }
  };

  const useDeviceLocation = (isDefault = false) => {
    if (!navigator.geolocation) { setPermissionDenied(false); onAvailabilityChange?.(true); setStatus("This browser does not support geolocation. Choose a point on the map."); return; }
    setPermissionDenied(false);
    setStatus("Requesting your device location...");
    navigator.geolocation.getCurrentPosition(({ coords }) => { onAvailabilityChange?.(true); void reverseGeocode(coords.latitude, coords.longitude, "device", isDefault); }, () => { setPermissionDenied(true); onAvailabilityChange?.(false); setStatus("Please allow location access in your browser to continue."); }, { enableHighAccuracy: true, timeout: 10000 });
  };

  useEffect(() => { if (readOnly) { onAvailabilityChange?.(true); return; } if (!navigator.geolocation) { onAvailabilityChange?.(true); setStatus("This browser does not support geolocation. Choose a point on the map."); } else { useDeviceLocation(true); } }, []);
  useEffect(() => { if (permissionDenied) setLocationPromptOpen(true); }, [permissionDenied]);

  return <div className="grid grid-cols-[minmax(260px,.8fr)_minmax(0,1.4fr)] gap-6 max-md:grid-cols-1"><div className="grid content-start gap-4"><Field><FieldLabel htmlFor="location-search">Where does the applicant live?</FieldLabel><FieldDescription>Choose the applicant&apos;s home location. This is used to help determine the nearest school.</FieldDescription><Input id="location-search" value={query} onChange={(event) => { setQuery(event.target.value); onChange({ ...value, address: event.target.value, source: "manual" }); }} placeholder="Enter an address or landmark" /></Field>{!readOnly && <Button type="button" variant="secondary" className="w-full" onClick={() => useDeviceLocation(false)}><LocateFixed size={17} /> Use my current device location</Button>}{status && <p className={permissionDenied ? "flex items-center gap-1 text-sm text-destructive" : "text-sm text-primary"} role="status">{status}</p>}{value.latitude === null && !permissionDenied && <p className="text-sm text-muted-foreground"><TriangleAlert size={16} /> Select a point on the map or use your device location to continue.</p>}</div><div className="min-h-[360px] border rounded-xl overflow-hidden relative max-md:min-h-[300px]" aria-label="OpenStreetMap location picker"><MapContainer center={point ?? DEFAULT_CENTER} zoom={point ? 13 : 7} scrollWheelZoom className="h-full min-h-[360px] z-0 max-md:min-h-[300px]"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{!readOnly && <MapSync point={point} onSelect={(lat, lng) => { if (!permissionDenied) void reverseGeocode(lat, lng, "map"); }} />}</MapContainer><div className="absolute z-500 left-4 bottom-4 bg-card border rounded-lg p-2 text-xs shadow-[0_4px_12px_#0002]">Click the map to place the location pin</div></div><Dialog open={locationPromptOpen} onOpenChange={setLocationPromptOpen}><DialogContent><DialogHeader><DialogTitle>Allow location access</DialogTitle><DialogDescription>Browser location permission is required to continue. Enable location access for this site in your browser settings, then try again.</DialogDescription></DialogHeader><Button type="button" onClick={() => { setLocationPromptOpen(false); useDeviceLocation(true); }}><LocateFixed size={17} /> Try again</Button></DialogContent></Dialog></div>;
}
