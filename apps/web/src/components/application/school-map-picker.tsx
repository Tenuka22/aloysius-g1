import { useMemo, useState } from "react";
import { Checkbox } from "@aloysius-g1/ui/components/checkbox";
import { haversineDistanceKm, getAllSchoolsWithDistance, findSchoolById, isGenderCompatible } from "@/lib/school-utils";
import { HOME_SCHOOL_ID, MAP_MARKER_COLORS } from "@/lib/school-config";
import type { GenderType } from "@/lib/schools";
import { STATUS_SUCCESS, STATUS_WARNING } from "@/lib/color-classes";
import { lazy } from "react";
import { ClientOnly } from "@tanstack/react-router";

type SchoolMapPickerProps = {
  centerLat: number;
  centerLng: number;
  selectedIds: string[];
  highlightSchoolId?: string;
  marksPerSchool?: number;
  onToggle?: (schoolId: string) => void;
  /** When true, selection is computed automatically (objective radius + gender-compatibility rule) and cannot be manually toggled. */
  readOnly?: boolean;
};

const GENDER_LABELS: Record<GenderType, string> = {
  boys: "Boys",
  girls: "Girls",
  mixed: "Mixed",
};

const EXTRA_BEYOND_RADIUS_KM = 0.5;
const INITIAL_VISIBLE_COUNT = 6;

const SchoolMapPickerMapLazy = lazy(() => import("./school-map-picker-map"));



export function SchoolMapPicker({ centerLat, centerLng, selectedIds, highlightSchoolId, marksPerSchool, onToggle, readOnly }: SchoolMapPickerProps) {
  const highlightSchool = highlightSchoolId ? findSchoolById(highlightSchoolId) : undefined;
  const appliedGenderType = highlightSchool?.genderType;

  const radiusKm = useMemo(() => {
    if (!highlightSchool || highlightSchool.lat == null || highlightSchool.lng == null) return 10;
    return haversineDistanceKm(centerLat, centerLng, highlightSchool.lat, highlightSchool.lng);
  }, [centerLat, centerLng, highlightSchool]);

  const displayRadius = radiusKm + EXTRA_BEYOND_RADIUS_KM;

  const schools = useMemo(() => getAllSchoolsWithDistance(centerLat, centerLng), [centerLat, centerLng]);

  const withinRadius = useMemo(() => schools.filter((s) => s.distanceKm <= radiusKm), [schools, radiusKm]);
  const justOutside = useMemo(() => schools.filter((s) => s.distanceKm > radiusKm && s.distanceKm <= displayRadius), [schools, radiusKm, displayRadius]);
  const selectedSchools = useMemo(() => schools.filter((s) => selectedIds.includes(s.id)), [schools, selectedIds]);


  const ineligibleSelected = useMemo(
    () => (appliedGenderType ? selectedSchools.filter((s) => !isGenderCompatible(s.genderType, appliedGenderType)) : []),
    [selectedSchools, appliedGenderType],
  );

  const [showAllWithin, setShowAllWithin] = useState(false);
  const withinRadiusRest = useMemo(() => withinRadius.filter((s) => s.id !== highlightSchoolId), [withinRadius, highlightSchoolId]);
  const visibleWithinRest = showAllWithin ? withinRadiusRest : withinRadiusRest.slice(0, INITIAL_VISIBLE_COUNT);
  const hiddenWithinCount = withinRadiusRest.length - visibleWithinRest.length;
  // The applied-to school's own row always shows regardless of the collapse
  // state - it's context, not one more school in a "too many rows" list.
  const visibleWithinRadius = useMemo(() => {
    const highlighted = withinRadius.find((s) => s.id === highlightSchoolId);
    return highlighted ? [highlighted, ...visibleWithinRest] : visibleWithinRest;
  }, [withinRadius, highlightSchoolId, visibleWithinRest]);

  return (
    <div className="grid gap-4">
      <ClientOnly fallback={<div className="h-[500px] w-full rounded-lg border bg-muted max-md:h-[360px]" />}>
        <SchoolMapPickerMapLazy
          centerLat={centerLat}
          centerLng={centerLng}
          selectedIds={selectedIds}
          highlightSchoolId={highlightSchoolId}
          radiusKm={radiusKm}
          displayRadius={displayRadius}
          schools={schools}
          appliedGenderType={appliedGenderType}
          onToggle={onToggle}
          readOnly={readOnly}
        />
      </ClientOnly>

      <p className="text-sm text-muted-foreground" role="status">
        Radius: {radiusKm.toFixed(1)} km (home to {highlightSchool?.en ?? "applied school"}) · {withinRadius.length} within · {justOutside.length} near boundary
        {readOnly && <> · automatically calculated, cannot be edited</>}
      </p>

      {ineligibleSelected.length > 0 && (
        <p className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm font-medium text-violet-700" role="alert">
          {ineligibleSelected.length === 1
            ? `${ineligibleSelected[0]!.en} is gender-ineligible for the applied school and won't count toward marks.`
            : `${ineligibleSelected.length} selected schools are gender-ineligible for the applied school and won't count toward marks.`}
        </p>
      )}
      <a
        href={`https://earth.google.com/web/search/${centerLat},${centerLng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-600 hover:underline"
      >
        Open home location on Google Earth ({centerLat.toFixed(5)}, {centerLng.toFixed(5)})
      </a>

      <ul className="grid gap-1.5 max-h-[400px] overflow-y-auto md:grid-cols-2 md:content-start">
        {visibleWithinRadius.map((school) => {
          const rowId = `school-option-${school.id}`;
          const isHighlighted = school.id === highlightSchoolId;
          if (isHighlighted) {
            return (
              <li key={school.id}>
                <div className={`flex items-center gap-3 rounded-lg border ${STATUS_WARNING.border} ${STATUS_WARNING.bg} p-3 text-sm cursor-default`}>
                  <span className={`size-5 shrink-0 rounded border-2 border-amber-400 bg-amber-100 flex items-center justify-center`}>
                    <svg className={`size-3 ${STATUS_WARNING.text}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    {school.en} <span className="text-muted-foreground">({GENDER_LABELS[school.genderType]})</span>
                    <span className={`ml-1 ${STATUS_WARNING.text} text-xs font-semibold`}>Applied school</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{school.distanceKm.toFixed(1)} km</span>
                </div>
              </li>
            );
          }
          const compatible = appliedGenderType ? isGenderCompatible(school.genderType, appliedGenderType) : true;
          return (
            <li key={school.id}>
              <label htmlFor={rowId} className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${compatible ? "hover:bg-muted/50" : "border-violet-200 bg-violet-50/50 text-violet-700 cursor-not-allowed"}`}>
                <Checkbox id={rowId} className="size-5 shrink-0" checked={selectedIds.includes(school.id)} disabled={!compatible || readOnly} onCheckedChange={() => !readOnly && compatible && onToggle?.(school.id)} />
                <span className="min-w-0 flex-1">
                  {school.en} <span className="text-muted-foreground">({GENDER_LABELS[school.genderType]})</span>
                  {!compatible && <span className="ml-1 text-xs text-violet-500 font-medium">Ineligible</span>}
                </span>
                {marksPerSchool != null && (
                  <span className={`shrink-0 text-xs font-semibold ${STATUS_SUCCESS.textStrong} tabular-nums`}>{marksPerSchool} marks</span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{school.distanceKm.toFixed(1)} km</span>
              </label>
            </li>
          );
        })}

        {(hiddenWithinCount > 0 || showAllWithin) && (
          <li className="md:col-span-2">
            <button
              type="button"
              onClick={() => setShowAllWithin((v) => !v)}
              className="w-full rounded-lg border border-dashed p-2 text-xs font-medium text-muted-foreground hover:bg-muted/50"
            >
              {showAllWithin ? "Show fewer" : `Show all ${withinRadius.length} schools (${hiddenWithinCount} more)`}
            </button>
          </li>
        )}

        {justOutside.length > 0 && <li className="md:col-span-2 text-xs text-muted-foreground font-medium pt-2 border-t mt-1">Near boundary (within +{EXTRA_BEYOND_RADIUS_KM} km)</li>}
        {justOutside.map((school) => {
          const isHighlighted = school.id === highlightSchoolId;
          if (isHighlighted) {
            return (
              <li key={school.id} className="opacity-50">
                <div className={`flex items-center gap-3 rounded-lg border ${STATUS_WARNING.borderDash} ${STATUS_WARNING.bg} p-3 text-sm cursor-default`}>
                  <span className={`size-5 shrink-0 rounded border-2 border-amber-400 bg-amber-100 flex items-center justify-center`}>
                    <svg className={`size-3 ${STATUS_WARNING.text}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    {school.en} <span className="text-muted-foreground">({GENDER_LABELS[school.genderType]})</span>
                    <span className={`ml-1 ${STATUS_WARNING.text} text-xs font-semibold`}>Applied school</span>
                    <span className="ml-1 text-orange-500 text-xs font-semibold">Just outside</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{school.distanceKm.toFixed(1)} km</span>
                </div>
              </li>
            );
          }
          const compatible = appliedGenderType ? isGenderCompatible(school.genderType, appliedGenderType) : true;
          return (
            <li key={school.id} className={compatible ? "opacity-50" : ""}>
              <label htmlFor={`school-option-${school.id}`} className={`flex items-center gap-3 rounded-lg border border-dashed p-3 text-sm ${compatible ? "hover:bg-muted/50" : "border-violet-200 bg-violet-50/50 text-violet-700 cursor-not-allowed"}`}>
                <Checkbox id={`school-option-${school.id}`} className="size-5 shrink-0" checked={selectedIds.includes(school.id)} disabled={!compatible || readOnly} onCheckedChange={() => !readOnly && compatible && onToggle?.(school.id)} />
                <span className="min-w-0 flex-1">
                  {school.en} <span className="text-muted-foreground">({GENDER_LABELS[school.genderType]})</span>
                  {!compatible && <span className="ml-1 text-xs text-violet-500 font-medium">Ineligible</span>}
                  {compatible && <span className="ml-1 text-orange-500 text-xs font-semibold">Just outside</span>}
                </span>
                {marksPerSchool != null && (
                  <span className={`shrink-0 text-xs font-semibold ${STATUS_SUCCESS.textStrong} tabular-nums`}>{marksPerSchool} marks</span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{school.distanceKm.toFixed(1)} km</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
