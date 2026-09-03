import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { LocateFixed, MapPin, TriangleAlert } from "lucide-react";
import { Button } from "@aloysius-g1/ui/components/button";
import { Field, FieldLabel, FieldDescription } from "@aloysius-g1/ui/components/field";
import { Input } from "@aloysius-g1/ui/components/input";
import "leaflet/dist/leaflet.css";
import { STATUS_WARNING } from "@/lib/color-classes";

type LocationValue = { label: string; address: string; latitude: number | null; longitude: number | null; source: "manual" | "device" | "map" | "network" | "admin" | "" };
type LocationError = { title: string; message: string };
const DEFAULT_CENTER: [number, number] = [7.8731, 80.7718];
const formatCoords = (entry: LocationValue) => `${entry.latitude?.toFixed(5) ?? "?"}, ${entry.longitude?.toFixed(5) ?? "?"}`;

function getLocationError(error: GeolocationPositionError): LocationError {
  if (error.code === 1) return { title: "Location permission is blocked", message: "Allow location access for this site in your browser settings, then try again. You can also enter an address or use the map." };
  if (error.code === 2) return { title: "Could not find a location fix", message: "Your device location is enabled, but the browser could not get a fix yet. Try again, or use the map." };
  if (error.code === 3) return { title: "Location request timed out", message: "The browser took too long to find your location. Try again, or use the map." };
  return { title: "Device location unavailable", message: "Location access is optional. Enter an address or click the map to choose a location." };
}

function MapSync({ point, onSelect }: { point: [number, number] | null; onSelect: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => { if (point) map.flyTo(point, Math.max(map.getZoom(), 13), { duration: 0.6 }); }, [map, point]);
  useMapEvents({ click: (event) => onSelect(event.latlng.lat, event.latlng.lng) });
  return point ? <CircleMarker center={point} radius={10} pathOptions={{ color: "#087f5b", fillColor: "#13b77e", fillOpacity: 0.9, weight: 3 }} /> : null;
}

export function LocationStep({ value, defaultValue, onChange, onAvailabilityChange, readOnly = false, autoRequestLocation = true, deviceLocationHistory = [], userLocationHistory = [] }: { value: LocationValue; defaultValue: LocationValue; onChange: (value: LocationValue, defaultValue?: LocationValue) => void; onAvailabilityChange?: (canProceed: boolean) => void; readOnly?: boolean; autoRequestLocation?: boolean; deviceLocationHistory?: LocationValue[]; userLocationHistory?: LocationValue[] }) {
  const [query, setQuery] = useState(value.address || value.label);
  const [status, setStatus] = useState("");
  const [locationError, setLocationError] = useState<LocationError | null>(null);
  const [deviceAccuracy, setDeviceAccuracy] = useState<number | null>(null);
  const activeLocationRequest = useRef<(() => void) | null>(null);
  const point = useMemo<[number, number] | null>(() => value.latitude !== null && value.longitude !== null ? [value.latitude, value.longitude] : null, [value.latitude, value.longitude]);

  const reverseGeocode = async (latitude: number, longitude: number, source: LocationValue["source"], isDefault = false, accuracy?: number, fallbackAddress = value.address) => {
    setLocationError(null);
    if (source === "device") setDeviceAccuracy(typeof accuracy === "number" && Number.isFinite(accuracy) ? accuracy : null);
    else setDeviceAccuracy(null);
    const devicePoint = { label: source === "network" ? "Approximate network location" : "Your location", address: fallbackAddress, latitude, longitude, source };

    if (isDefault) {
      onChange(value.latitude !== null ? value : devicePoint, devicePoint);
    } else {
      const selected = { ...value, latitude, longitude, source, label: "Selected location", address: value.address };
      onChange(selected, undefined);
    }

    setStatus("Finding the nearest address...");
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, { headers: { Accept: "application/json" } });
      const result: unknown = await response.json();
      const details = typeof result === "object" && result !== null ? result as Record<string, unknown> : {};
      const address = typeof details.display_name === "string" && details.display_name.trim() !== "" ? details.display_name : fallbackAddress || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      setQuery(address);
      const resultName = typeof details.name === "string" && details.name.trim() !== "" ? details.name : devicePoint.label;
      const resolvedDevicePoint = { ...devicePoint, label: resultName, address };
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

  const useNetworkLocation = async () => {
    activeLocationRequest.current?.();
    const controller = new AbortController();
    let cancelled = false;
    const cleanup = () => {
      cancelled = true;
      controller.abort();
      if (activeLocationRequest.current === cleanup) activeLocationRequest.current = null;
    };
    activeLocationRequest.current = cleanup;
    setLocationError(null);
    setStatus("Finding an approximate location from your network…");
    onAvailabilityChange?.(true);
    try {
      const response = await fetch("https://ipapi.co/json/", { headers: { Accept: "application/json" }, signal: controller.signal });
      if (!response.ok) throw new Error("Network location request failed");
      const payload: unknown = await response.json();
      if (cancelled || typeof payload !== "object" || payload === null) return;
      const data = payload as Record<string, unknown>;
      const latitudeValue = data.latitude;
      const longitudeValue = data.longitude;
      const latitude = typeof latitudeValue === "number" ? latitudeValue : typeof latitudeValue === "string" ? Number(latitudeValue) : Number.NaN;
      const longitude = typeof longitudeValue === "number" ? longitudeValue : typeof longitudeValue === "string" ? Number(longitudeValue) : Number.NaN;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new Error("Network location did not include coordinates");
      const approximateAddress = [data.city, data.region, data.country_name, data.postal].filter((part): part is string => typeof part === "string" && part.trim() !== "").join(", ");
      cleanup();
      setStatus("Finding the address…");
      await reverseGeocode(latitude, longitude, "network", false, undefined, approximateAddress);
    } catch (error) {
      if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
      cleanup();
      setLocationError({ title: "Approximate location unavailable", message: "We could not find your location from your internet connection. Try GPS again or choose a point on the map." });
      setStatus("");
    }
  };

  const useDeviceLocation = (isDefault = false) => {
    activeLocationRequest.current?.();
    if (!navigator.geolocation) { onAvailabilityChange?.(true); setLocationError({ title: "Device location unavailable", message: "This browser does not support GPS location. You can use an approximate network location or choose a point on the map." }); setStatus(""); return; }
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      onAvailabilityChange?.(true);
      setLocationError({ title: "Secure connection required", message: "Browser location only works on HTTPS or localhost. Open the secure site, or use the map to choose a location." });
      return;
    }

    setLocationError(null);
    setStatus("Finding your current location…");

    let closed = false;
    let watchId: number | null = null;
    let fallbackTimer: number | null = null;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      if (activeLocationRequest.current === cleanup) activeLocationRequest.current = null;
    };
    const onSuccess = ({ coords }: GeolocationPosition) => {
      if (closed) return;
      cleanup();
      onAvailabilityChange?.(true);
      if (Number.isFinite(coords.accuracy)) setDeviceAccuracy(coords.accuracy);
      void reverseGeocode(coords.latitude, coords.longitude, "device", isDefault, coords.accuracy);
    };
    const onFailure = (error: GeolocationPositionError) => {
      if (closed) return;
      cleanup();
      onAvailabilityChange?.(true);
      setLocationError(getLocationError(error));
      setStatus("");
    };
    const useCachedLocation = () => {
      if (closed) return;
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      setStatus("Trying another location method…");
      navigator.geolocation.getCurrentPosition(onSuccess, onFailure, { enableHighAccuracy: false, timeout: 20000, maximumAge: 600000 });
    };

    activeLocationRequest.current = cleanup;
    try {
      watchId = navigator.geolocation.watchPosition(onSuccess, (error) => {
        if (closed) return;
        if (error.code === 1) {
          onFailure(error);
          return;
        }
        setStatus("Finding your current location…");
      }, { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 });
      if (closed) {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      } else {
        fallbackTimer = window.setTimeout(useCachedLocation, 30000);
      }
    } catch {
      navigator.geolocation.getCurrentPosition(onSuccess, onFailure, { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 });
    }
  };

  useEffect(() => {
    if (readOnly) {
      onAvailabilityChange?.(true);
      return;
    }
    if (!autoRequestLocation) {
      onAvailabilityChange?.(true);
      return;
    }
    if (value.latitude !== null && value.longitude !== null) {
      onAvailabilityChange?.(true);
      return;
    }
    useDeviceLocation(true);
  }, []);
  useEffect(() => () => activeLocationRequest.current?.(), []);
  const latestLocation = userLocationHistory[0] ?? deviceLocationHistory[0] ?? null;
  return <div className="grid grid-cols-[minmax(260px,.8fr)_minmax(0,1.4fr)] gap-6 max-md:grid-cols-1"><div className="grid content-start gap-4"><Field><FieldLabel htmlFor="location-search">Where does the applicant live?</FieldLabel><FieldDescription>Choose the applicant&apos;s home location. This is used to help determine the nearest school.</FieldDescription><Input id="location-search" value={query} onChange={(event) => { setLocationError(null); setDeviceAccuracy(null); setQuery(event.target.value); onChange({ ...value, address: event.target.value, source: "manual" }); }} placeholder="Enter an address or landmark" className="break-words" /></Field>{!readOnly && <Button type="button" variant="secondary" className="w-full" onClick={() => useDeviceLocation(false)}><LocateFixed size={17} /> Use my current device location</Button>}{locationError && !readOnly && <div className={`grid gap-3 rounded-lg border ${STATUS_WARNING.borderStrong} ${STATUS_WARNING.bgIcon} p-3`} role="alert"><div className="flex items-start gap-2 text-sm"><TriangleAlert size={17} className={`mt-0.5 shrink-0 ${STATUS_WARNING.text}`} /><div><p className={`font-semibold ${STATUS_WARNING.textVeryStrong} dark:text-amber-200`}>{locationError.title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{locationError.message}</p></div></div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => useDeviceLocation(true)}>Try again</Button><Button type="button" size="sm" variant="outline" onClick={() => void useNetworkLocation()}>Use approximate network location</Button></div></div>}{status && !locationError && <p className="text-sm text-primary" role="status">{status}</p>}{point && <div className="grid gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3" data-testid="location-resolution" aria-live="polite"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-primary">{value.source === "network" ? "Approximate location found" : "Location captured"}</p>{deviceAccuracy !== null && <span className="text-xs text-muted-foreground">Location accuracy ±{Math.round(deviceAccuracy)} m</span>}</div><div className="grid gap-2 text-xs"><div className="flex items-baseline justify-between gap-3"><span className="text-muted-foreground">Coordinates</span><code className="font-medium tabular-nums text-foreground">{formatCoords(value)}</code></div><div className="grid gap-1"><span className="text-muted-foreground">Address</span><strong className="break-words font-medium text-foreground">{value.address || (status === "Finding the nearest address..." ? "Resolving address…" : "Address not resolved yet")}</strong></div>{value.source === "network" && <p className="text-[0.72rem] leading-relaxed text-muted-foreground">This is an approximate city-level estimate from your internet connection, not a device location. Adjust the pin if needed.</p>}</div></div>}{value.latitude === null && !locationError && <p className="text-sm text-muted-foreground"><TriangleAlert size={16} /> Select a point on the map or use your device location to continue.</p>}{(userLocationHistory.length > 0 || deviceLocationHistory.length > 0) && <div className="grid gap-2 rounded-lg border p-3"><p className="text-[0.78rem] font-semibold text-muted-foreground">Latest saved location</p><button type="button" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50" disabled={readOnly} onClick={() => { setLocationError(null); setDeviceAccuracy(null); setQuery(latestLocation?.address || latestLocation?.label || ""); if (latestLocation) onChange(latestLocation, latestLocation.source === "device" ? latestLocation : undefined); }}>{latestLocation?.source === "device" ? <LocateFixed size={14} className="shrink-0 text-blue-500" /> : <MapPin size={14} className="shrink-0 text-primary" />}<span className="min-w-0 flex-1 break-words">{latestLocation?.address || latestLocation?.label || "Unnamed location"}</span>{latestLocation && <code className="shrink-0 font-medium tabular-nums text-foreground">{formatCoords(latestLocation)}</code>}</button></div>}</div><div className="min-h-[360px] border rounded-xl overflow-hidden relative max-md:min-h-[300px]" aria-label="OpenStreetMap location picker"><MapContainer center={point ?? DEFAULT_CENTER} zoom={point ? 13 : 7} scrollWheelZoom className="h-full min-h-[360px] z-0 max-md:min-h-[300px]"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{!readOnly && <MapSync point={point} onSelect={(lat, lng) => { void reverseGeocode(lat, lng, "map"); }} />}</MapContainer><div className="absolute z-500 left-4 bottom-4 bg-card border rounded-lg p-2 text-xs shadow-[0_4px_12px_#0002]">Click the map to place the location pin</div></div></div>;
}
