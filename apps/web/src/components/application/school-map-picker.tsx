import { useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer } from "react-leaflet";
import { Checkbox } from "@aloysius-g1/ui/components/checkbox";
import { Field, FieldLabel } from "@aloysius-g1/ui/components/field";
import { Slider } from "@aloysius-g1/ui/components/slider";
import { DEFAULT_RADIUS_KM, MAX_RADIUS_KM, getSchoolsWithinRadius } from "@/lib/school-utils";
import type { GenderType } from "@/lib/schools";
import "leaflet/dist/leaflet.css";

type SchoolMapPickerProps = {
  centerLat: number;
  centerLng: number;
  selectedIds: string[];
  onToggle: (schoolId: string) => void;
};

const GENDER_LABELS: Record<GenderType, string> = {
  boys: "Boys",
  girls: "Girls",
  mixed: "Mixed",
};

export function SchoolMapPicker({ centerLat, centerLng, selectedIds, onToggle }: SchoolMapPickerProps) {
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const schools = useMemo(
    () => getSchoolsWithinRadius(centerLat, centerLng, radiusKm),
    [centerLat, centerLng, radiusKm],
  );

  return (
    <div className="grid gap-4">
      <Field>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel htmlFor="school-search-radius">Search radius</FieldLabel>
          <span className="text-sm text-muted-foreground tabular-nums">{radiusKm} km</span>
        </div>
        <Slider
          id="school-search-radius"
          value={[radiusKm]}
          onValueChange={(value) => setRadiusKm((Array.isArray(value) ? value[0] : value) ?? DEFAULT_RADIUS_KM)}
          min={1}
          max={MAX_RADIUS_KM}
          step={1}
        />
      </Field>

      <div
        className="min-h-[320px] border rounded-xl overflow-hidden relative max-md:min-h-[280px]"
        aria-label="OpenStreetMap nearby schools"
      >
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={13}
          scrollWheelZoom
          className="h-full min-h-[320px] z-0 max-md:min-h-[280px]"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Circle
            center={[centerLat, centerLng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: "#087f5b", fillColor: "#13b77e", fillOpacity: 0.05, weight: 1, dashArray: "6 4" }}
          />
          <CircleMarker
            center={[centerLat, centerLng]}
            radius={6}
            pathOptions={{ color: "#087f5b", fillColor: "#087f5b", fillOpacity: 1, weight: 2 }}
          />
          {schools.map((school) => {
            const selected = selectedIds.includes(school.id);
            return (
              <CircleMarker
                key={school.id}
                center={[school.lat, school.lng]}
                radius={selected ? 9 : 6}
                eventHandlers={{ click: () => onToggle(school.id) }}
                pathOptions={
                  selected
                    ? { color: "#087f5b", fillColor: "#13b77e", fillOpacity: 0.9, weight: 3 }
                    : { color: "#64748b", fillColor: "#94a3b8", fillOpacity: 0.35, weight: 2 }
                }
              />
            );
          })}
        </MapContainer>
      </div>

      <p className="text-sm text-muted-foreground" role="status">
        {schools.length} schools found &middot; {selectedIds.length} selected
      </p>

      {schools.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          No schools were found within {radiusKm} km of the home location. Increase the search radius to see nearby
          schools.
        </p>
      ) : (
        <ul className="grid gap-2">
          {schools.map((school) => {
            const rowId = `school-option-${school.id}`;
            return (
              <li key={school.id}>
                <label
                  htmlFor={rowId}
                  className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50"
                >
                  <Checkbox
                    id={rowId}
                    className="size-5 shrink-0"
                    checked={selectedIds.includes(school.id)}
                    onCheckedChange={() => onToggle(school.id)}
                  />
                  <span className="min-w-0 flex-1">
                    {school.en}{" "}
                    <span className="text-muted-foreground">({GENDER_LABELS[school.genderType]})</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {school.distanceKm.toFixed(1)} km
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
