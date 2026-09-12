import { useEffect, lazy, useMemo, useRef, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Suspense } from "react";
import { LocateFixed, MapPin, Settings2, TriangleAlert, X } from "lucide-react";
import { Button } from "@aloysius-admissions/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@aloysius-admissions/ui/components/dialog";
import { Field, FieldLabel, FieldDescription } from "@aloysius-admissions/ui/components/field";
import { Input } from "@aloysius-admissions/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@aloysius-admissions/ui/components/popover";
import { STATUS_WARNING } from "@/lib/color-classes";
import { useTranslation } from "@/lib/i18n";

type LocationValue = { label: string; address: string; latitude: number | null; longitude: number | null; source: "manual" | "device" | "map" | "network" | "admin" | "" };
type LocationError = { title: string; message: string };
// Stores a status *key*, translated only at render time. Storing the already
// translated string (as this used to) could freeze an untranslated fallback
// (the raw i18n key) into state if a geolocation callback fired before the
// translation bundle finished loading, and that stale text would never
// re-translate since useState doesn't re-run on locale/load changes.
type StatusKey = "" | "findingAddress" | "locationSelected" | "mapPointSaved" | "networkApproximate" | "findingAddressEllipsis" | "findingCurrent" | "tryingAnother";
const DEFAULT_CENTER: [number, number] = [7.8731, 80.7718];
const formatCoords = (entry: LocationValue) => `${entry.latitude?.toFixed(5) ?? "?"}, ${entry.longitude?.toFixed(5) ?? "?"}`;

function getLocationError(error: GeolocationPositionError, t: (key: string) => string): LocationError {
  if (error.code === 1) return { title: t("location.error.permissionBlocked.title"), message: t("location.error.permissionBlocked.message") };
  if (error.code === 2) return { title: t("location.error.noFix.title"), message: t("location.error.noFix.message") };
  if (error.code === 3) return { title: t("location.error.timeout.title"), message: t("location.error.timeout.message") };
  return { title: t("location.error.unavailable.title"), message: t("location.error.unavailable.message") };
}
const LocationStepMap = lazy(() => import("./location-step-map"));



export function LocationStep({ value, defaultValue, onChange, onAvailabilityChange, readOnly = false, autoRequestLocation = true, deviceLocationHistory = [], userLocationHistory = [], skipped = false, onClear }: { value: LocationValue; defaultValue: LocationValue; onChange: (value: LocationValue, defaultValue?: LocationValue) => void; onAvailabilityChange?: (canProceed: boolean) => void; readOnly?: boolean; autoRequestLocation?: boolean; deviceLocationHistory?: LocationValue[]; userLocationHistory?: LocationValue[]; skipped?: boolean; onClear?: () => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(value.address || value.label);
  const [status, setStatus] = useState<StatusKey>("");
  const [locationError, setLocationError] = useState<LocationError | null>(null);
  const [deviceAccuracy, setDeviceAccuracy] = useState<number | null>(null);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [manualError, setManualError] = useState(false);
  const activeLocationRequest = useRef<(() => void) | null>(null);
  const point = useMemo<[number, number] | null>(() => value.latitude != null && value.longitude != null && Number.isFinite(value.latitude) && Number.isFinite(value.longitude) ? [value.latitude, value.longitude] : null, [value.latitude, value.longitude]);

  const reverseGeocode = async (latitude: number, longitude: number, source: LocationValue["source"], isDefault = false, accuracy?: number, fallbackAddress = value.address) => {
    setLocationError(null);
    if (source === "device") setDeviceAccuracy(typeof accuracy === "number" && Number.isFinite(accuracy) ? accuracy : null);
    else setDeviceAccuracy(null);
    const devicePoint = { label: source === "network" ? t("location.networkLabel") : t("location.deviceLabel"), address: fallbackAddress, latitude, longitude, source };

    if (isDefault) {
      onChange(value.latitude !== null ? value : devicePoint, devicePoint);
    } else {
      const selected = { ...value, latitude, longitude, source, label: t("location.selectedLabel"), address: value.address };
      onChange(selected, undefined);
    }

    setStatus("findingAddress");
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, { headers: { Accept: "application/json" } });
      const result: unknown = await response.json();
      const details = typeof result === "object" && result !== null ? result as Record<string, unknown> : {};
      const address = typeof details.display_name === "string" && details.display_name.trim() !== "" ? details.display_name : fallbackAddress || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      setQuery(address);
      const resultName = typeof details.name === "string" && details.name.trim() !== "" ? details.name : devicePoint.label;
      const resolvedDevicePoint = { ...devicePoint, label: resultName, address };
      const resolvedSelected = { ...value, latitude, longitude, source, label: t("location.selectedLabel"), address };
      if (isDefault) {
        onChange(value.latitude !== null ? resolvedSelected : resolvedDevicePoint, resolvedDevicePoint);
      } else {
        onChange(resolvedSelected, undefined);
      }
      setStatus("locationSelected");
    } catch {
      setStatus("mapPointSaved");
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
    setStatus("networkApproximate");
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
      setStatus("findingAddressEllipsis");
      await reverseGeocode(latitude, longitude, "network", false, undefined, approximateAddress);
    } catch (error) {
      if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
      cleanup();
      setLocationError({ title: t("location.error.networkUnavailable.title"), message: t("location.error.networkUnavailable.message") });
      setStatus("");
    }
  };

  const useDeviceLocation = (isDefault = false) => {
    activeLocationRequest.current?.();
    if (!navigator.geolocation) { onAvailabilityChange?.(true); setLocationError({ title: t("location.error.noGeolocation.title"), message: t("location.error.noGeolocation.message") }); setStatus(""); return; }
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      onAvailabilityChange?.(true);
      setLocationError({ title: t("location.error.secureRequired.title"), message: t("location.error.secureRequired.message") });
      return;
    }

    setLocationError(null);
    setStatus("findingCurrent");

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
      setLocationError(getLocationError(error, t));
      setStatus("");
    };
    const useCachedLocation = () => {
      if (closed) return;
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      setStatus("tryingAnother");

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
        setStatus("findingCurrent");
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

  const applyManualCoordinates = () => {
    const latitude = Number(manualLat);
    const longitude = Number(manualLng);
    if (
      manualLat.trim() === "" ||
      manualLng.trim() === "" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      setManualError(true);
      return;
    }
    setManualError(false);
    setManualOpen(false);
    setManualLat("");
    setManualLng("");
    void reverseGeocode(latitude, longitude, "manual");
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
    if (value.latitude != null && value.longitude != null && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)) {
      onAvailabilityChange?.(true);
      return;
    }
    useDeviceLocation(true);
  }, []);
  useEffect(() => () => activeLocationRequest.current?.(), []);
  // All previously selected/captured points, newest first, deduplicated by coordinate
  // and excluding the currently selected point (shown separately above).
  const previousLocations = useMemo(() => {
    const seen = new Set<string>();
    const result: LocationValue[] = [];
    for (const entry of [...userLocationHistory, ...deviceLocationHistory]) {
      if (entry.latitude == null || entry.longitude == null) continue;
      if (value.latitude === entry.latitude && value.longitude === entry.longitude) continue;
      const key = `${entry.latitude},${entry.longitude}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(entry);
    }
    return result;
  }, [userLocationHistory, deviceLocationHistory, value.latitude, value.longitude]);

  return (
    <div className="grid grid-cols-[minmax(260px,.8fr)_minmax(0,1.4fr)] gap-6 max-lg:grid-cols-1">
      <div className="grid content-start gap-4">
        <Field>
          <FieldLabel htmlFor="location-search">{t("location.label")}</FieldLabel>
          <FieldDescription>{t("location.description")}</FieldDescription>
          <Input id="location-search" value={query} onChange={(event) => { setLocationError(null); setDeviceAccuracy(null); setQuery(event.target.value); onChange({ ...value, address: event.target.value, source: "manual" }); }} placeholder={t("location.placeholder")} />
        </Field>

        {!readOnly && (
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="h-auto min-h-10 flex-1 whitespace-normal text-center" onClick={() => useDeviceLocation(false)}>
              <LocateFixed size={17} className="shrink-0" /> {t("location.useDeviceLocation")}
            </Button>
            <Popover open={manualOpen} onOpenChange={setManualOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-auto min-h-10 shrink-0"
                    title={t("location.manualEntry.button")}
                    aria-label={t("location.manualEntry.button")}
                  />
                }
              >
                <Settings2 size={17} />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <PopoverHeader>
                  <PopoverTitle>{t("location.manualEntry.title")}</PopoverTitle>
                  <PopoverDescription>{t("location.manualEntry.description")}</PopoverDescription>
                </PopoverHeader>
                <div className="grid grid-cols-2 gap-2">
                  <Field>
                    <FieldLabel htmlFor="location-manual-latitude" className="text-xs">
                      {t("location.manualEntry.latitudeLabel")}
                    </FieldLabel>
                    <Input
                      id="location-manual-latitude"
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={manualLat}
                      onChange={(event) => { setManualError(false); setManualLat(event.target.value); }}
                      placeholder="6.9271"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="location-manual-longitude" className="text-xs">
                      {t("location.manualEntry.longitudeLabel")}
                    </FieldLabel>
                    <Input
                      id="location-manual-longitude"
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={manualLng}
                      onChange={(event) => { setManualError(false); setManualLng(event.target.value); }}
                      placeholder="79.8612"
                    />
                  </Field>
                </div>
                {manualError && (
                  <p className={`text-xs ${STATUS_WARNING.text}`}>{t("location.manualEntry.invalid")}</p>
                )}
                <Button type="button" size="sm" className="w-full" onClick={applyManualCoordinates}>
                  {t("location.manualEntry.apply")}
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {locationError && !readOnly && (
          <div className={`grid gap-3 rounded-lg border ${STATUS_WARNING.borderStrong} bg-transparent p-3`} role="alert">
            <div className="flex items-start gap-2 text-sm">
              <TriangleAlert size={17} className={`mt-0.5 shrink-0 ${STATUS_WARNING.text}`} />
              <div>
                <p className={`font-semibold ${STATUS_WARNING.textVeryStrong}`}>{locationError.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{locationError.message}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="default" className="h-auto whitespace-normal text-center" onClick={() => useDeviceLocation(true)}>{t("location.tryAgain")}</Button>
              <Button type="button" size="sm" variant="outline" className="h-auto whitespace-normal text-center" onClick={() => void useNetworkLocation()}>{t("location.useNetworkLocation")}</Button>
            </div>
          </div>
        )}

        {status && !locationError && <p className="text-sm text-primary" role="status">{t(`location.status.${status}`)}</p>}

        {point && (
          <div className="grid gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3" data-testid="location-resolution" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-primary">{value.source === "network" ? t("location.resolved.networkTitle") : t("location.resolved.capturedTitle")}</p>
              {deviceAccuracy !== null && <span className="text-xs text-muted-foreground">Accuracy ~{Math.round(deviceAccuracy)} m</span>}
            </div>
            <div className="grid gap-2 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <span className="text-muted-foreground">{t("location.resolved.coordinates")}</span>
                <code className="break-all font-medium tabular-nums text-foreground">{formatCoords(value)}</code>
              </div>
              <div className="grid gap-1">
                <span className="text-muted-foreground">{t("location.resolved.address")}</span>
                <strong className="break-words font-medium text-foreground">{value.address || (status === "findingAddress" ? t("location.resolved.resolvingAddress") : t("location.resolved.addressNotResolved"))}</strong>
              </div>
              {value.source === "network" && (
                <p className="text-[0.72rem] leading-relaxed text-muted-foreground">
                  {t("location.resolved.networkHint")}
                </p>
              )}
            </div>
            {!readOnly && onClear && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive hover:border-destructive/50"
                  onClick={() => {
                    setQuery("");
                    setStatus("");
                    setDeviceAccuracy(null);
                    setLocationError(null);
                    onClear();
                  }}
                >
                  <X size={14} className="shrink-0" /> {t("location.clearSelection")}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Once skipped, the step is passable, so telling the applicant a
            point is needed "to continue" would contradict the skip notice. */}
        {value.latitude === null && !locationError && !skipped && (
          <p className="text-sm text-muted-foreground flex flex-row gap-2 items-center"><TriangleAlert size={16} /> {t("location.noPointHint")}</p>
        )}

        {previousLocations.length > 0 && (
          <div className="hidden lg:grid gap-2 rounded-lg border p-3">
            <p className="text-[0.78rem] font-semibold text-muted-foreground">{t("location.latestSaved.title")}</p>
            <div className="grid gap-1 max-h-[16rem] overflow-y-auto">
              {previousLocations.map((entry, index) => (
                <button
                  key={`${entry.latitude}-${entry.longitude}-${index}`}
                  type="button"
                  className="grid gap-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
                  disabled={readOnly}
                  onClick={() => {
                    setLocationError(null);
                    setDeviceAccuracy(null);
                    setQuery(entry.address || entry.label || "");
                    onChange(entry, entry.source === "device" ? entry : undefined);
                  }}
                >
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {entry.source === "device" ? <LocateFixed size={12} className="text-blue-500" /> : <MapPin size={12} className="text-primary" />}
                    {entry.source === "device" ? t("location.latestSaved.deviceLocation") : t("location.latestSaved.mapSelection")}
                  </span>
                  <span className="break-words font-medium text-foreground leading-snug">{entry.address || entry.label || t("location.latestSaved.unnamed")}</span>
                  <code className="text-xs font-medium tabular-nums text-muted-foreground">{formatCoords(entry)}</code>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Small screens: preview map + open in dialog */}
      <div className="lg:hidden grid gap-2">
        <div className="h-[200px] border rounded-xl overflow-hidden relative opacity-80 pointer-events-none">
          <ClientOnly fallback={<div className="h-full bg-muted/50" />}>
            <Suspense fallback={<div className="h-full bg-muted/50" />}>
              <LocationStepMap point={point} readOnly onSelect={() => {}} />
            </Suspense>
          </ClientOnly>
        </div>
        <Button type="button" variant="secondary" className="w-full" onClick={() => setMapDialogOpen(true)}>
          <MapPin size={17} className="shrink-0" /> {t("location.openMap")}
        </Button>
      </div>

      <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
        <DialogContent fullScreen showCloseButton>
          <DialogHeader>
            <DialogTitle>{t("location.label")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 relative overflow-hidden rounded-lg border">
            <ClientOnly fallback={<div className="h-full min-h-[300px] bg-muted/50" />}>
              <Suspense fallback={<div className="h-full min-h-[300px] bg-muted/50" />}>
                <LocationStepMap point={point} readOnly={readOnly} onSelect={(lat, lng) => { void reverseGeocode(lat, lng, "map"); }} />
              </Suspense>
            </ClientOnly>
            <div className="absolute z-500 left-4 bottom-4 bg-card border rounded-lg p-2 text-xs shadow-[0_4px_12px_#0002]">
              {t("location.mapHint")}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Large screens: full inline map */}
      <div className="hidden lg:block min-h-[clamp(300px,50vw,400px)] border rounded-xl overflow-hidden relative" aria-label="OpenStreetMap location picker">
        <ClientOnly fallback={<div className="h-full min-h-[clamp(300px,50vw,400px)] bg-muted/50" />}>
          <Suspense fallback={<div className="h-full min-h-[clamp(300px,50vw,400px)] bg-muted/50" />}>
            <LocationStepMap point={point} readOnly={readOnly} onSelect={(lat, lng) => { void reverseGeocode(lat, lng, "map"); }} />
          </Suspense>
        </ClientOnly>
        <div className="absolute z-500 left-4 bottom-4 bg-card border rounded-lg p-2 text-xs shadow-[0_4px_12px_#0002]">
          {t("location.mapHint")}
        </div>
      </div>
    </div>
  );
}
