import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Ban, Check, ClipboardCheck, CreditCard, Edit3, FileText, Flag, Hash, LockKeyhole, Mail, MapPin, MoreHorizontal, MousePointer2, Pencil, Phone, Save, Settings2, ShieldAlert, User, UserRound, X } from "lucide-react";
import { client, orpc } from "@/utils/orpc";
import { normalizeDraft, type ApplicationDraft, type InterviewEdit, type LocationDraft, type ScoringInputs } from "@/lib/g1/application-store";
import { scoreCategory } from "@/lib/g1/scoring";
import { CATEGORY_MAX_MARKS } from "@/lib/g1/marking-scheme";
import { findSchoolById, haversineDistanceKm } from "@/lib/g1/school-utils";
import { HOME_SCHOOL_ID, getHomeSchoolDisplayName } from "@/lib/g1/school-config";
import { FIELD_ICON_COLORS } from "@/lib/color-classes";
import { toast } from "sonner";
import { Badge } from "@aloysius-admissions/ui/components/badge";
import { Button } from "@aloysius-admissions/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aloysius-admissions/ui/components/card";
import { Input } from "@aloysius-admissions/ui/components/input";
import { Textarea } from "@aloysius-admissions/ui/components/textarea";
import { Checkbox } from "@aloysius-admissions/ui/components/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aloysius-admissions/ui/components/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@aloysius-admissions/ui/components/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@aloysius-admissions/ui/components/dialog";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@aloysius-admissions/ui/components/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aloysius-admissions/ui/components/tabs";
import { DISTRICTS, DIVISIONAL_SECRETARIATS, ELECTORAL_CONSTITUENCIES, GN_DIVISIONS } from "@/lib/g1/divisions";
import { type AdmissionStatus, type AdmissionDetail, type FlagEntry, CATEGORY_LABELS } from "@/components/g1/admin/admissions-view";
import { Category61Fields, Category62Fields, Category63Fields, Category64Fields, Category65Fields, Category66Fields } from "@/components/g1/application/category-step";
const AdmissionsCategoryMap = lazy(() => import("@/components/g1/admin/admissions-category-map"));
import type { LocationEvidence } from "@/components/g1/admin/admissions-category-map";

const SCHOOL_COORDS_FALLBACK = { lat: 6.0456, lng: 80.2086 };

function getSchoolCoords(): { lat: number; lng: number } {
  const school = findSchoolById(HOME_SCHOOL_ID);
  if (school?.lat != null && school?.lng != null) return { lat: school.lat, lng: school.lng };
  return SCHOOL_COORDS_FALLBACK;
}

const SCHOOL_COORDS: { lat: number; lng: number } = {
  get lat() {
    return getSchoolCoords().lat;
  },
  get lng() {
    return getSchoolCoords().lng;
  },
};

const LOCATION_COLORS = [
  { border: "#065f46", fill: "#13b77e" },
  { border: "#1e40af", fill: "#3b82f6" },
  { border: "#9333ea", fill: "#a855f7" },
  { border: "#c2410c", fill: "#f97316" },
  { border: "#be123c", fill: "#fb7185" },
  { border: "#0e7490", fill: "#06b6d4" },
  { border: "#4338ca", fill: "#818cf8" },
  { border: "#a16207", fill: "#eab308" },
];

const CATEGORY_META: Record<string, { description: string; maxMarks: number }> = {
  "6.1": { description: "Residence documents, electoral registration, and home-to-school proximity.", maxMarks: CATEGORY_MAX_MARKS },
  "6.2": { description: "The parent's education, achievements, association service, and school contributions.", maxMarks: CATEGORY_MAX_MARKS },
  "6.3": { description: "Sibling study history, achievements, residence evidence, and proximity.", maxMarks: CATEGORY_MAX_MARKS },
  "6.4": { description: "Teaching service period, difficult station service, leave, and service distances.", maxMarks: CATEGORY_MAX_MARKS },
  "6.5": { description: "Transfer distance, service history, recency, leave, and school proximity.", maxMarks: CATEGORY_MAX_MARKS },
  "6.6": { description: "Continuous foreign employment, purpose, and home-to-school proximity.", maxMarks: CATEGORY_MAX_MARKS },
};

export const Route = createFileRoute("/_auth/g1/admin/admissions/$id/$categoryId")({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.prefetchQuery(context.orpc.admin.admissions.get.queryOptions({ input: { id: params.id } })),
    ]);
  },
  component: AdmissionWorkspacePage,
});

function StatusBadge({ status, banned }: { status: AdmissionStatus; banned: boolean }) {
  if (banned) return <Badge variant="destructive">Banned</Badge>;
  if (status === "verified") return <Badge variant="default">Verified</Badge>;
  if (status === "fake") return <Badge variant="destructive">Potentially fake</Badge>;
  return <Badge variant="secondary">Pending review</Badge>;
}

function formatFieldName(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase());
}

function formatFieldValue(key: string, value: unknown): string {
  if (Array.isArray(value)) {
    if (key === "schoolsWithinRadius") {
      const MAX_DISPLAY = 3;
      const names = value.flatMap((schoolId) => typeof schoolId === "string" && findSchoolById(schoolId) ? [findSchoolById(schoolId)!.en] : []);
      if (names.length === 0) return "None selected";
      if (names.length <= MAX_DISPLAY) return names.join(", ");
      return `${names.slice(0, MAX_DISPLAY).join(", ")} +${names.length - MAX_DISPLAY} more`;
    }
    return value.length > 0 ? value.map(String).join(", ") : "None";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "Not provided";
  return String(value);
}

type FieldType = "text" | "name" | "date" | "phone" | "email" | "nic" | "boolean" | "address" | "select" | "number" | "document";

const FIELD_STYLES: Record<FieldType, { icon: React.ReactNode; colorClass: string }> = {
  text:     { icon: <FileText size={13} />,     colorClass: "text-foreground" },
  name:     { icon: <User size={13} />,         colorClass: FIELD_ICON_COLORS.name },
  date:     { icon: <ClipboardCheck size={13} />, colorClass: FIELD_ICON_COLORS.date },
  phone:    { icon: <Phone size={13} />,        colorClass: FIELD_ICON_COLORS.phone },
  email:    { icon: <Mail size={13} />,         colorClass: FIELD_ICON_COLORS.email },
  nic:      { icon: <CreditCard size={13} />,   colorClass: FIELD_ICON_COLORS.nic },
  boolean:  { icon: <Hash size={13} />,         colorClass: "text-foreground" },
  address:  { icon: <MapPin size={13} />,       colorClass: FIELD_ICON_COLORS.address },
  select:   { icon: <Hash size={13} />,         colorClass: "text-foreground" },
  number:   { icon: <Hash size={13} />,         colorClass: FIELD_ICON_COLORS.number },
  document: { icon: <CreditCard size={13} />,   colorClass: FIELD_ICON_COLORS.document },
};

function getFieldType(key: string): FieldType {
  if (key.includes("Name") || key.includes("name")) return "name";
  if (key.includes("Date") || key.includes("Start") || key.includes("End")) return "date";
  if (key.includes("phone") || key.includes("Phone")) return "phone";
  if (key.includes("email") || key.includes("Email")) return "email";
  if (key.includes("nic") || key.includes("NIC")) return "nic";
  if (key.includes("address") || key.includes("Address") || key.includes("gnDivision") || key.includes("dsDivision") || key.includes("district") || key.includes("electoral")) return "address";
  if (key.includes("mainDocument") || key.includes("additionalDocs") || key.includes("schoolsWithinRadius")) return "document";
  if (key.includes("Count") || key.includes("Km") || key.includes("km") || key.includes("Years")) return "number";
  return "text";
}

function DataRow({ label, value, fieldKey, onEdit, previousValue, flagged, onFlag }: { label: string; value: unknown; fieldKey?: string; onEdit?: () => void; previousValue?: string; flagged?: boolean; onFlag?: () => void }) {
  const isEmpty = value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  const type = fieldKey ? getFieldType(fieldKey) : "text";
  const style = FIELD_STYLES[type] ?? FIELD_STYLES.text;
  const displayValue = isEmpty ? "Not provided" : String(value ?? "Not provided");
  const hasEdit = previousValue !== undefined && previousValue !== displayValue;
  return (
    <div className={`group relative rounded-xl border p-3 transition-colors ${
      flagged
        ? "border-red-200 bg-red-50/50 ring-1 ring-red-200/60"
        : "border-border/40 hover:border-border hover:bg-muted/20"
    }`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="flex min-w-0 items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="opacity-50 shrink-0">{style.icon}</span>
          <span className="truncate">{label}</span>
          {flagged && (
            <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[0.58rem] font-bold text-red-600 uppercase tracking-wide leading-none">
              Flagged
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onFlag && (
            <button
              type="button"
              onClick={onFlag}
              title={flagged ? "Remove flag" : "Flag as suspicious"}
              className={`rounded-lg p-1.5 transition-colors ${
                flagged ? "bg-red-100 text-red-600 hover:bg-red-200" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Flag size={13} />
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              title={`Edit ${label}`}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Pencil size={13} />
            </button>
          )}
        </span>
      </div>
      <p className={`text-[0.9rem] font-semibold leading-snug ${
        isEmpty ? "text-muted-foreground/50 italic font-normal text-sm" : style.colorClass
      }`}>
        {displayValue}
      </p>
      {hasEdit && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200/60 px-2 py-1 text-xs">
          <span className="line-through text-muted-foreground/70">{previousValue || "(empty)"}</span>
          <ArrowRight size={10} className="shrink-0 text-muted-foreground" />
          <span className="font-semibold text-amber-700">{displayValue}</span>
        </div>
      )}
  </div>
  );
}

type FieldEditOption = { value: string; label: string };

const FIELD_OPTIONS: Record<string, FieldEditOption[]> = {
  gender: [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }],
  religion: [{ value: "Buddhist", label: "Buddhist" }, { value: "Catholic", label: "Catholic" }, { value: "Christian", label: "Christian" }, { value: "Islam", label: "Islam" }, { value: "Hindu", label: "Hindu" }],
  educationMedium: [{ value: "Sinhala", label: "Sinhala" }, { value: "Tamil", label: "Tamil" }],
  relationship: [{ value: "Mother", label: "Mother" }, { value: "Father", label: "Father" }, { value: "Guardian", label: "Guardian" }],
};

function getFieldOptions(fieldKey?: string): FieldEditOption[] | null {
  if (!fieldKey) return null;
  if (FIELD_OPTIONS[fieldKey]) return FIELD_OPTIONS[fieldKey];
  if (fieldKey === "district") return DISTRICTS.map((d) => ({ value: d.en, label: d.en }));
  if (fieldKey === "dsDivision") return DIVISIONAL_SECRETARIATS.map((d) => ({ value: d.en, label: d.en }));
  if (fieldKey === "gnDivision") return GN_DIVISIONS.map((d) => ({ value: d.en, label: d.en }));
  if (fieldKey === "electoralDistrict") return ELECTORAL_CONSTITUENCIES.map((c) => ({ value: c.en, label: c.en }));
  return null;
}

function FieldEditDialog({ open, onOpenChange, label, fieldKey, currentValue, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; label: string; fieldKey?: string; currentValue: string; onSave: (prev: string, next: string) => void }) {
  const [editValue, setEditValue] = useState(currentValue);
  useEffect(() => { if (open) setEditValue(currentValue); }, [open, currentValue]);
  const type = fieldKey ? getFieldType(fieldKey) : "text";
  const style = FIELD_STYLES[type] ?? FIELD_STYLES.text;
  const options = getFieldOptions(fieldKey);
  const hasChanged = editValue !== currentValue;

  const normalize = (v: string) => v.trim().toLocaleLowerCase();
  const filterOptions = (opts: FieldEditOption[], search: string) => {
    const q = normalize(search);
    return opts.filter((o) => !q || normalize(o.label).includes(q)).slice(0, 12);
  };
  const isSelectField = Boolean(options);
  const isDatalistField = Boolean(options) && !FIELD_OPTIONS[fieldKey!];
  const selectedOption = options?.find((o) => o.value === editValue || normalize(o.value) === normalize(editValue));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><span className={style.colorClass}>{style.icon}</span> Edit {label}</DialogTitle>
          <DialogDescription>Previous value will be preserved as an interview edit record.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {currentValue && (
            <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Previous value</span>
              <p className="mt-1 text-sm">{currentValue}</p>
            </div>
          )}
          <div className="grid gap-2">
            <label className="text-sm font-semibold">New value</label>
            {isSelectField && !isDatalistField ? (
              <Select value={selectedOption?.value ?? editValue} onValueChange={(v) => setEditValue(v ?? "")}>
                <SelectTrigger className="w-full text-sm"><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger>
                <SelectContent>
                  {options!.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : isDatalistField ? (
              <>
                <Input
                  list={`edit-datalist-${fieldKey}`}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}`}
                  className="text-sm"
                />
                <datalist id={`edit-datalist-${fieldKey}`}>
                  {filterOptions(options!, editValue).map((o) => <option key={o.value} value={o.value} />)}
                </datalist>
              </>
            ) : type === "address" ? (
              <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={3} className="text-sm" />
            ) : (
              <Input type={type === "date" ? "date" : type === "email" ? "email" : type === "phone" ? "tel" : "text"} value={editValue} onChange={(e) => setEditValue(e.target.value)} className="text-sm" />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!hasChanged} onClick={() => { onSave(currentValue, editValue); onOpenChange(false); }}><Save size={15} /> Save change</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditableDataRow({ label, value, fieldKey, onChange, readOnly }: { label: string; value: string; fieldKey?: string; onChange?: (v: string) => void; readOnly?: boolean }) {
  const type = fieldKey ? getFieldType(fieldKey) : "text";
  const style = FIELD_STYLES[type] ?? FIELD_STYLES.text;
  const isEmpty = !value;
  if (readOnly || !onChange) {
    return (
      <div className="grid gap-1 border-b border-border/70 py-3 last:border-b-0">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground flex items-center gap-1.5">
          <span className="opacity-50">{style.icon}</span>{label}
        </span>
        <strong className={isEmpty ? "text-muted-foreground italic font-normal text-sm leading-relaxed" : `${style.colorClass} text-sm leading-relaxed`}>{isEmpty ? "Not provided" : value}</strong>
      </div>
    );
  }
  return (
    <div className="grid gap-1 border-b border-border/70 py-3 last:border-b-0">
      <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground flex items-center gap-1.5">
        <span className="opacity-50">{style.icon}</span>{label}
      </label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
    </div>
  );
}

function ApplicantLocationReview({ draft, flaggedLocations, onToggleLocationFlag, onSaveAdminLocation }: { draft: ApplicationDraft; flaggedLocations: Set<string>; onToggleLocationFlag: (id: string) => void; onSaveAdminLocation: (lat: number, lng: number) => void }) {
  const [editMode, setEditMode] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ lat: number; lng: number } | null>(null);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [manualError, setManualError] = useState(false);

  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;
  const onMapClickRef = useRef<(lat: number, lng: number) => void>(() => {});
  onMapClickRef.current = (lat, lng) => { if (editModeRef.current) setPendingPin({ lat, lng }); };

  // ─── Build a stable flat list of all evidence points ───────────────────────
  // Each point gets a stable string ID - using UUID from DB when available, else a deterministic prefix+index.
  const allPoints = useMemo(() => {
    const pts: LocationEvidence[] = [];

    const addPoint = (stableId: string, label: string, entry: LocationDraft | null | undefined, group: LocationEvidence["group"]) => {
      if (!entry || entry.latitude == null || entry.longitude == null) return;
      pts.push({
        id: entry.id ?? stableId,
        label,
        address: entry.address || entry.label || "Location without address",
        latitude: entry.latitude,
        longitude: entry.longitude,
        source: entry.source || "unknown",
        group,
      });
    };

    // Primary applicant-submitted locations. location and selectedLocation are always set to
    // the same value (see LocationStepCard onChange), so skip location if coords match.
    addPoint("applicant-selected", "Selected application location", draft.selectedLocation, "selected");
    const selLat = draft.selectedLocation?.latitude, selLng = draft.selectedLocation?.longitude;
    const locLat = draft.location?.latitude, locLng = draft.location?.longitude;
    if (locLat != null && locLng != null && (locLat !== selLat || locLng !== selLng))
      addPoint("applicant-detected", "Application location", draft.location, "selected");

    // Browser-provided default locations
    draft.defaultLocations.forEach((entry, i) => addPoint(`browser-${i}`, `Browser location ${i + 1}`, entry, "true"));

    // User location history - admin entries get group "admin", user pins get "selected"
    draft.userLocationHistory.forEach((entry, i) => {
      const isAdmin = entry.source === "admin";
      addPoint(entry.id ?? `user-history-${i}`, isAdmin ? "Admin-adjusted location" : `Previously selected pin ${i + 1}`, entry, isAdmin ? "admin" : "selected");
    });

    // Device GPS history
    draft.deviceLocationHistory.forEach((entry, i) => addPoint(entry.id ?? `device-${i}`, `Device GPS fix ${i + 1}`, entry, "true"));

    // Deduplicate: skip any point whose (lat, lng) already appeared earlier in the list.
    const seen = new Set<string>();
    return pts.filter((p) => {
      const key = `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [draft]);

  // ─── Derive logical groups ──────────────────────────────────────────────────
  const adminPin = useMemo(() => allPoints.find(p => p.group === "admin") ?? null, [allPoints]);
  const userSelectedPins = useMemo(() => allPoints.filter(p => p.group === "selected"), [allPoints]);
  const truePins = useMemo(() => allPoints.filter(p => p.group === "true"), [allPoints]);

  // The "effective" home location: admin override replaces the last user-selected pin
  const effectivePin = useMemo(() => adminPin ?? (userSelectedPins.length > 0 ? userSelectedPins[0] : null), [adminPin, userSelectedPins]);

  // What appears in the "User selected locations" list - admin override replaces the last user pin
  const displayedSelectedPins = useMemo(() => {
    if (adminPin && userSelectedPins.length > 0) {
      // Replace the last user pin with the admin pin in display
      return [...userSelectedPins.slice(0, -1), adminPin];
    }
    if (adminPin) return [adminPin];
    return userSelectedPins;
  }, [adminPin, userSelectedPins]);

  // ─── Visibility (which pins are checked & shown on map) ─────────────────────
  const initialVisibleIds = useMemo(() => {
    const ids = new Set<string>();
    if (effectivePin) ids.add(effectivePin.id);
    const lastTrue = truePins[truePins.length - 1];
    if (lastTrue) ids.add(lastTrue.id);
    return ids;
  }, []); // only on mount - user controls checkboxes after that

  const [visibleIds, setVisibleIds] = useState<Set<string>>(initialVisibleIds);

  // When the admin saves a location the effectivePin id changes - ensure the new pin is visible
  const prevEffectiveId = useRef<string | null>(effectivePin?.id ?? null);
  useEffect(() => {
    const cur = effectivePin?.id ?? null;
    if (cur && cur !== prevEffectiveId.current) {
      setVisibleIds(prev => {
        const next = new Set(prev);
        // Remove the old effective pin so it doesn't ghost-linger
        if (prevEffectiveId.current) next.delete(prevEffectiveId.current);
        next.add(cur);
        return next;
      });
    }
    prevEffectiveId.current = cur;
  }, [effectivePin?.id]);

  const toggleVisible = (id: string, checked: boolean) => setVisibleIds(prev => {
    const next = new Set(prev);
    checked ? next.add(id) : next.delete(id);
    return next;
  });

  const visiblePoints = useMemo(() => allPoints.filter(p => visibleIds.has(p.id)), [allPoints, visibleIds]);

  // ─── Map edit state ─────────────────────────────────────────────────────────
  const editPosition: [number, number] = pendingPin
    ? [pendingPin.lat, pendingPin.lng]
    : effectivePin
      ? [effectivePin.latitude, effectivePin.longitude]
      : [SCHOOL_COORDS.lat, SCHOOL_COORDS.lng];

  const homeToSchoolKm = effectivePin
    ? haversineDistanceKm(effectivePin.latitude, effectivePin.longitude, SCHOOL_COORDS.lat, SCHOOL_COORDS.lng)
    : null;

  const handleDone = () => {
    if (pendingPin) {
      onSaveAdminLocation(pendingPin.lat, pendingPin.lng);
      setPendingPin(null);
    }
    setEditMode(false);
  };

  const handleCancelEdit = () => {
    setPendingPin(null);
    setEditMode(false);
  };

  // ─── Render helpers ─────────────────────────────────────────────────────────
  const renderPin = (point: LocationEvidence, isLastInGroup: boolean) => {
    const globalIdx = allPoints.findIndex(p => p.id === point.id);
    const isEffective = effectivePin?.id === point.id;
    const isAdmin = point.group === "admin";
    const isFlagged = flaggedLocations.has(point.id);
    const isChecked = visibleIds.has(point.id);
    const color = LOCATION_COLORS[globalIdx % LOCATION_COLORS.length];
    const dist = haversineDistanceKm(point.latitude, point.longitude, SCHOOL_COORDS.lat, SCHOOL_COORDS.lng);

    return (
      <li
        key={point.id}
        className={[
          "rounded-lg border p-3 transition-colors",
          isFlagged ? "border-red-300 bg-red-50/50" : "",
          isAdmin ? "border-amber-300 bg-amber-50/50" : "",
          isEffective && !isFlagged && !isAdmin ? "ring-2 ring-primary/30 border-primary/30" : "",
        ].join(" ")}
      >
        <label htmlFor={`loc-${point.id}`} className="flex items-start gap-3 cursor-pointer">
          <Checkbox
            id={`loc-${point.id}`}
            checked={isChecked}
            onCheckedChange={checked => toggleVisible(point.id, checked === true)}
          />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color.fill }} />
              {point.label}
              {isEffective && <Badge variant="default" className="text-[0.6rem] px-1.5 py-0">Active</Badge>}
              {isAdmin && <Badge variant="outline" className="text-[0.6rem] px-1.5 py-0 border-amber-500 text-amber-600">Admin</Badge>}
              {isFlagged && <Badge variant="destructive" className="text-[0.6rem] px-1.5 py-0">Flagged</Badge>}
              <Badge variant="outline" className="text-[0.6rem] px-1.5 py-0 ml-auto">{dist.toFixed(2)} km</Badge>
            </span>
            <span className="block truncate text-xs text-muted-foreground mt-0.5">{point.address}</span>
            <span className="mt-0.5 block font-mono text-[0.65rem] text-muted-foreground/70">{point.source} · {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</span>
            <a
              href={`https://earth.google.com/web/search/${point.latitude},${point.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-block text-[0.65rem] text-blue-600 hover:underline"
            >
              Open in Google Earth ↗
            </a>
          </span>
          <button
            type="button"
            onClick={() => onToggleLocationFlag(point.id)}
            className={`shrink-0 rounded-md p-1 transition-colors ${isFlagged ? "bg-red-100 text-red-600 hover:bg-red-200" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            title={isFlagged ? "Remove flag" : "Flag as suspicious"}
          >
            <Flag size={12} />
          </button>
        </label>
      </li>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Location evidence</CardTitle>
            <CardDescription>
              Each circle is centred on {getHomeSchoolDisplayName()} with radius equal to the distance from each home to the school.
              {homeToSchoolKm != null && (
                <span className="ml-2 font-semibold text-primary">{homeToSchoolKm.toFixed(2)} km from school</span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {editMode ? (
              <>
                <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                  <X size={14} /> Cancel
                </Button>
                <Button size="sm" variant="default" onClick={handleDone} disabled={!pendingPin}>
                  <Check size={14} /> Save location
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setManualEntryOpen(!manualEntryOpen)}>
                  <Settings2 size={14} /> Manual entry
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                  <Pencil size={14} /> {adminPin ? "Replace admin location" : "Set admin location"}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        {manualEntryOpen && !editMode && (
          <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Manual coordinate entry</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <label htmlFor="adm-manual-lat" className="text-xs font-semibold">Latitude</label>
                <Input
                  id="adm-manual-lat"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={manualLat}
                  onChange={(e) => { setManualError(false); setManualLat(e.target.value); }}
                  placeholder="6.9271"
                />
              </div>
              <div className="grid gap-1">
                <label htmlFor="adm-manual-lng" className="text-xs font-semibold">Longitude</label>
                <Input
                  id="adm-manual-lng"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={manualLng}
                  onChange={(e) => { setManualError(false); setManualLng(e.target.value); }}
                  placeholder="79.8612"
                />
              </div>
            </div>
            {manualError && (
              <p className="text-xs text-destructive mt-1">Please enter valid latitude and longitude values.</p>
            )}
            <Button
              size="sm"
              className="w-full mt-2"
              onClick={() => {
                const lat = parseFloat(manualLat);
                const lng = parseFloat(manualLng);
                if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                  onSaveAdminLocation(lat, lng);
                  setManualLat("");
                  setManualLng("");
                  setManualEntryOpen(false);
                } else {
                  setManualError(true);
                }
              }}
            >
              <Save size={14} /> Apply coordinates
            </Button>
          </div>
        )}
        {allPoints.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            No coordinates were captured for this application.
          </div>
        ) : (
          <>
            {/* Map */}
            <div className="relative overflow-hidden rounded-xl border" aria-label="Applicant location evidence map">
              <ClientOnly fallback={<div className="z-0 h-[420px] w-full max-md:h-[320px] bg-muted" />}>
                <AdmissionsCategoryMap
                  visiblePoints={visiblePoints}
                  allPoints={allPoints}
                  editMode={editMode}
                  onMapClickRef={onMapClickRef}
                  pendingPin={pendingPin}
                  effectivePin={effectivePin}
                  editPosition={editPosition}
                />
              </ClientOnly>

              {editMode && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold shadow-lg pointer-events-none">
                  <>{pendingPin ? <><MapPin size={13} className="inline mr-1" /> New location set — click Save location above</> : <><MousePointer2 size={13} className="inline mr-1" /> Click anywhere on the map to pin the admin location</>}</>
                </div>
              )}
            </div>

            {/* Location lists — tabbed */}
            <Tabs defaultValue="selected">
              <TabsList className="w-full">
                <TabsTrigger value="selected" className="flex-1 gap-1.5">
                  Saved locations
                  {adminPin && <Badge variant="outline" className="border-amber-400 text-amber-600 text-[0.6rem] px-1 py-0">Admin override</Badge>}
                  {displayedSelectedPins.length > 0 && (
                    <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.65rem] font-semibold text-primary">{displayedSelectedPins.length}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="device" className="flex-1 gap-1.5">
                  Device &amp; browser
                  {truePins.length > 0 && (
                    <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.65rem] font-semibold text-primary">{truePins.length}</span>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="selected" className="mt-3">
                {displayedSelectedPins.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No user-selected locations recorded.</p>
                ) : (
                  <ul className="grid gap-2 max-h-[360px] overflow-y-auto pr-1">
                    {displayedSelectedPins.map((p, i) => renderPin(p, i === displayedSelectedPins.length - 1))}
                  </ul>
                )}
              </TabsContent>
              <TabsContent value="device" className="mt-3">
                {truePins.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No device or browser locations captured.</p>
                ) : (
                  <ul className="grid gap-2 max-h-[360px] overflow-y-auto pr-1">
                    {truePins.map((p, i) => renderPin(p, i === truePins.length - 1))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>

            {/* School row */}
            <div className="rounded-lg border border-dashed border-amber-400 bg-amber-50/50 p-3 flex items-center gap-3">
              <span className="inline-block size-2.5 rounded-full bg-amber-500" />
              <span className="text-sm font-semibold">{getHomeSchoolDisplayName()}</span>
              <Badge variant="outline" className="text-[0.6rem] px-1.5 py-0">School</Badge>
              <span className="ml-auto text-xs text-muted-foreground">{SCHOOL_COORDS.lat.toFixed(5)}, {SCHOOL_COORDS.lng.toFixed(5)}</span>
            </div>

            {/* Flagged locations summary */}
            {flaggedLocations.size > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/30 p-3">
                <p className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2">
                  <Flag size={14} /> Flagged locations ({flaggedLocations.size})
                </p>
                <div className="grid gap-1">
                  {Array.from(flaggedLocations).map(locId => {
                    const loc = allPoints.find(p => p.id === locId);
                    return loc ? (
                      <div key={locId} className="flex items-center justify-between py-1">
                        <span className="text-xs">{loc.label}</span>
                        <Button size="sm" variant="ghost" onClick={() => onToggleLocationFlag(locId)} className="text-red-600 hover:text-red-700 h-6 px-2">
                          <X size={12} /> Remove
                        </Button>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BanDialog({ open, onOpenChange, onConfirm, applicantName, reason, onReasonChange, pending }: { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void; applicantName: string; reason: string; onReasonChange: (value: string) => void; pending: boolean }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-destructive/12 text-destructive"><Ban size={20} /></div>
          <AlertDialogTitle>Ban this applicant?</AlertDialogTitle>
          <AlertDialogDescription>
            This marks <strong>{applicantName}</strong> as banned in the admissions workspace. Record a reason so the decision is auditable.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <label htmlFor="ban-reason" className="text-sm font-semibold">Reason for ban</label>
          <Textarea id="ban-reason" value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Describe the verified reason…" rows={3} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending || !reason.trim()} onClick={onConfirm}>{pending ? "Banning…" : "Ban applicant"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


/** Replay saved interview edits over the applicant's pristine scoring inputs.
 *  The DB copy of `scoringInputs` is NEVER mutated by admin edits - every admin
 *  change is stored only as an interviewEdit record, and this function reconstructs
 *  the current values from those records on load.
 *
 *  `rawNewValue` holds the JSON-serialized value, so arrays and objects replay
 *  exactly. Older records without it fall back to coercing the display string. */
function applyInterviewEditsToScoringInputs(
  original: ScoringInputs,
  categoryType: string,
  interviewEdits: InterviewEdit[],
): ScoringInputs {
  const prefix = `category.${categoryType}.scoringInputs.`;
  const result: Record<string, unknown> = { ...original };
  // Array-typed keys that a legacy (no rawNewValue) edit record can never safely
  // coerce from a display string. Checked by name, not by Array.isArray(cur), because
  // an unset field's original value is undefined and would otherwise pass through.
  const ARRAY_KEYS: Record<string, true> = {
    additionalDocs: true, electoralMotherYears: true, electoralFatherYears: true,
    schoolsWithinRadius: true, sportsEntries: true, leadershipRoles: true,
    studentSocietiesEntries: true, otherActivities: true, siblingSportsEntries: true,
    siblingExamAchievements: true, otherContributionEntries: true,
  };
  // chronological order - later edits win
  const latest: Record<string, InterviewEdit> = {};
  for (const edit of interviewEdits) {
    if (!edit.field.startsWith(prefix)) continue;
    latest[edit.field.slice(prefix.length)] = edit;
  }
  for (const [key, edit] of Object.entries(latest)) {
    if (edit.rawNewValue !== undefined) {
      try {
        result[key] = JSON.parse(edit.rawNewValue) as unknown;
        continue;
      } catch {
        // Corrupt JSON - fall through to string coercion below.
      }
    }
    // Legacy records (no rawNewValue): coerce the display string by current type.
    const cur = result[key];
    const strVal = edit.newValue;
    if (Array.isArray(cur) || ARRAY_KEYS[key]) continue; // cannot reconstruct an array from a display string
    if (typeof cur === "boolean") { result[key] = strVal === "Yes" || strVal === "true"; continue; }
    if (typeof cur === "number") { const n = parseFloat(strVal); if (!isNaN(n)) result[key] = n; continue; }
    result[key] = strVal;
  }
  return result as ScoringInputs;
}
function CategoryScoringCard({ applicationId, category, draft, flaggedInputs, onToggleInputFlag, homeLocation, onSaveInterviewEdits, onFirstEdit }: { applicationId: string; category: ApplicationDraft["categories"][0]; draft: ApplicationDraft; flaggedInputs: Set<string>; onToggleInputFlag: (key: string) => void; homeLocation: { lat: number; lng: number } | null; onSaveInterviewEdits: (edits: InterviewEdit[]) => void; onFirstEdit?: () => void }) {
  const [inputsEditable, setInputsEditable] = useState(false);
  // Replay saved interview edits so the fields show the latest admin-entered values on load.
  const [editedInputs, setEditedInputs] = useState<ScoringInputs>(() =>
    applyInterviewEditsToScoringInputs({ ...category.scoringInputs }, category.categoryType, draft.interviewEdits),
  );
  const originalInputsRef = useRef<ScoringInputs>({ ...category.scoringInputs });

  useEffect(() => {
    setEditedInputs(applyInterviewEditsToScoringInputs({ ...category.scoringInputs }, category.categoryType, draft.interviewEdits));
    originalInputsRef.current = { ...category.scoringInputs };
  }, [category.id]);

  const editedCategory = useMemo(() => ({ ...category, scoringInputs: editedInputs }), [category, editedInputs]);
  const editedAutoScore = useMemo(() => scoreCategory(editedCategory), [editedCategory]);

  const inputChanges = useMemo(() => {
    const changes: Array<{ key: string; label: string; oldValue: string; newValue: string }> = [];
    const orig = originalInputsRef.current;
    for (const [key, newVal] of Object.entries(editedInputs)) {
      const oldVal = (orig as Record<string, unknown>)[key];
      const oldStr = formatFieldValue(key, oldVal);
      const newStr = formatFieldValue(key, newVal);
      if (oldStr !== newStr) {
        changes.push({ key, label: formatFieldName(key), oldValue: oldStr, newValue: newStr });
      }
    }
    return changes;
  }, [editedInputs]);

  const handleInputPatch = (patch: Partial<ScoringInputs>) => {
    const prev = editedInputs;
    const next = { ...prev, ...patch };
    const edits: InterviewEdit[] = [];

    for (const [key, newVal] of Object.entries(patch)) {
      const oldVal = (prev as Record<string, unknown>)[key];
      // Display strings for the audit trail / diff UI.
      let oldStr: string;
      let newStr: string;
      if (key === "schoolsWithinRadius" && Array.isArray(oldVal) && Array.isArray(newVal)) {
        const oldSet = new Set(oldVal.map(String));
        const newSet = new Set((newVal as unknown[]).map(String));
        const added = [...newSet].filter((sid) => !oldSet.has(sid)).map((sid) => findSchoolById(sid)?.en ?? sid);
        const removed = [...oldSet].filter((sid) => !newSet.has(sid)).map((sid) => findSchoolById(sid)?.en ?? sid);
        const parts: string[] = [];
        if (added.length > 0) parts.push(`+${added.join(", ")}`);
        if (removed.length > 0) parts.push(`-${removed.join(", ")}`);
        oldStr = `${oldVal.length} school${oldVal.length === 1 ? "" : "s"}`;
        newStr = parts.length > 0 ? parts.join(" | ") : `${(newVal as unknown[]).length} school${(newVal as unknown[]).length === 1 ? "" : "s"}`;
      } else {
        oldStr = formatFieldValue(key, oldVal);
        newStr = formatFieldValue(key, newVal);
      }
      // Compare on the raw value so array reordering / equal displays don't drop a real change.
      const rawOld = JSON.stringify(oldVal ?? null);
      const rawNew = JSON.stringify(newVal ?? null);
      if (rawOld === rawNew) continue;
      edits.push({
        field: `category.${category.categoryType}.scoringInputs.${key}`,
        label: formatFieldName(key),
        previousValue: oldStr,
        newValue: newStr,
        editedAt: new Date().toISOString(),
        rawPreviousValue: rawOld,
        rawNewValue: rawNew,
      });
    }

    console.log("[scoring] patch:", Object.keys(patch), "-> edits recorded:", edits.length, edits);
    setEditedInputs(next);
    if (edits.length > 0) {
      onSaveInterviewEdits([...draft.interviewEdits, ...edits]);
    }
  };
  const hasInputChanges = inputChanges.length > 0;

  const currentSessionChanges = useMemo(() =>
    Object.fromEntries(inputChanges.map(c => [c.key, { previousValue: c.oldValue, newValue: c.newValue }])),
    [inputChanges],
  );

  const renderFields = () => {
    const flagProps = { flaggedInputs, onToggleInputFlag };
    const locProps = homeLocation ? { centerLat: homeLocation.lat, centerLng: homeLocation.lng } : {};
    switch (category.categoryType) {
      case "6.1": return <Category61Fields forceSelectable category={editedCategory} onChange={handleInputPatch} {...locProps} {...flagProps} interviewChanges={currentSessionChanges} />;
      case "6.2": return <Category62Fields category={editedCategory} onChange={handleInputPatch} {...flagProps} interviewChanges={currentSessionChanges} />;
      case "6.3": return <Category63Fields forceSelectable category={editedCategory} onChange={handleInputPatch} {...locProps} {...flagProps} interviewChanges={currentSessionChanges} />;
      case "6.4": return <Category64Fields category={editedCategory} onChange={handleInputPatch} {...flagProps} interviewChanges={currentSessionChanges} />;
      case "6.5": return <Category65Fields forceSelectable category={editedCategory} onChange={handleInputPatch} {...locProps} {...flagProps} interviewChanges={currentSessionChanges} />;
      case "6.6": return <Category66Fields forceSelectable category={editedCategory} onChange={handleInputPatch} {...locProps} {...flagProps} interviewChanges={currentSessionChanges} />;
      default: return (
        <div className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
          {Object.entries(editedInputs).map(([key, value]) => (
            <DataRow key={key} label={formatFieldName(key)} value={formatFieldValue(key, value)} fieldKey={key} flagged={flaggedInputs.has(key)} onFlag={() => onToggleInputFlag(key)} />
          ))}
        </div>
      );
    }
  };

  return (
    <Card>
      <CardHeader className="border-b bg-muted/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid min-w-0 gap-1">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Marking category</span>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {CATEGORY_LABELS[category.categoryType]}
              {hasInputChanges && <Badge variant="secondary">Inputs modified</Badge>}
            </CardTitle>
            <CardDescription>{CATEGORY_META[category.categoryType]?.description}</CardDescription>
          </div>
          <div className="grid shrink-0 gap-0.5 rounded-lg border bg-background px-3 py-2 text-right">
            <span className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">Indicative score</span>
            <strong className="font-mono text-lg tabular-nums">
              {editedAutoScore.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}<span className="text-sm font-normal text-muted-foreground"> / 100</span>
            </strong>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              Scoring inputs
              {hasInputChanges && <Badge variant="secondary" className="text-[0.6rem]">{inputChanges.length} changed</Badge>}
            </h4>
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setInputsEditable((v) => !v)}>{inputsEditable ? "View only" : "Edit inputs"}</button>
          </div>
          {hasInputChanges && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5 mb-2"><Pencil size={11} /> {inputChanges.length} field{inputChanges.length === 1 ? "" : "s"} changed</p>
              <div className="grid gap-1.5">
                {inputChanges.map((change) => (
                  <div key={change.key} className="flex items-start justify-between gap-3 rounded-md bg-white/70 border border-amber-100 px-2.5 py-1.5">
                    <div className="min-w-0 flex-1">
                      <span className="text-[0.68rem] font-bold uppercase tracking-wide text-amber-800 block mb-0.5">{change.label}</span>
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="line-through text-muted-foreground/70">{change.oldValue || "(empty)"}</span>
                        <ArrowRight size={10} className="shrink-0 text-muted-foreground" />
                        <span className="font-semibold text-amber-800">{change.newValue || "(empty)"}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => onToggleInputFlag(change.key)} title={flaggedInputs.has(change.key) ? "Remove flag" : "Flag"} className={`shrink-0 mt-0.5 rounded-md p-1 transition-colors ${flaggedInputs.has(change.key) ? "bg-red-100 text-red-600 hover:bg-red-200" : "text-amber-400 hover:bg-amber-100 hover:text-amber-700"}`}>
                      <Flag size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {renderFields()}

          <div className="mt-2 pt-2 border-t">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Flag inputs</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(editedInputs).filter(key => !["schoolsWithinRadius"].includes(key)).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onToggleInputFlag(key)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold transition-colors ${
                    flaggedInputs.has(key)
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  <Flag size={9} /> {formatFieldName(key)}
                </button>
              ))}
            </div>
          </div>

          {flaggedInputs.size > 0 && (
            <div className="mt-2 pt-2 border-t">
              <p className="text-xs font-semibold text-red-600 flex items-center gap-1 mb-1"><Flag size={10} /> Flagged inputs ({flaggedInputs.size})</p>
              <div className="flex flex-wrap gap-1">
                {Array.from(flaggedInputs).map((inputKey) => (
                  <button key={inputKey} type="button" onClick={() => onToggleInputFlag(inputKey)} className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[0.65rem] text-red-700 hover:bg-red-200 transition-colors">
                    {formatFieldName(inputKey)} <X size={10} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-2 border-t pt-5">
          <p className="text-sm font-medium">Example marks - {CATEGORY_LABELS[category.categoryType]}</p>
          <div className="grid gap-1">
            {editedAutoScore.breakdown.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-mono tabular-nums">
                  {row.marks.toLocaleString(undefined, { maximumFractionDigits: 2 })} / {row.max}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const STEPS = [
  { label: "Applicant data", icon: User },
  { label: "Location evidence", icon: MapPin },
  { label: "Category entry", icon: FileText },
  { label: "Decision & flagging", icon: Flag },
] as const;

function AdmissionWorkspacePage() {
  const { id, categoryId } = Route.useParams();
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);

  const detail = useQuery({
    ...orpc.admin.admissions.get.queryOptions({ input: { id } }),
  });

  const data = detail.data as AdmissionDetail | undefined;

  const [status, setStatus] = useState<AdmissionStatus>("pending");
  const [notes, setNotes] = useState("");
  const [banned, setBanned] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banDialogOpen, setBanDialogOpen] = useState(false);

  // Tracks whether we've auto-promoted this session to under_interview.
  const hasAutoPromotedRef = useRef(false);

  const [editFieldOpen, setEditFieldOpen] = useState(false);
  const [editFieldConfig, setEditFieldConfig] = useState<{ label: string; fieldKey?: string; section: string; path: string; currentValue: string } | null>(null);

  const [flaggedFields, setFlaggedFields] = useState<Set<string>>(new Set());
  const [flaggedInputs, setFlaggedInputs] = useState<Set<string>>(new Set());
  const [flaggedLocations, setFlaggedLocations] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (data?.flags) {
      setFlaggedFields(new Set(data.flags.filter((f) => f.type === "field").map((f) => f.key)));
      setFlaggedInputs(new Set(data.flags.filter((f) => f.type === "input").map((f) => f.key)));
      setFlaggedLocations(new Set(data.flags.filter((f) => f.type === "location").map((f) => f.key)));
    }
  }, [data?.flags]);

  const toggleFieldFlag = (fieldKey: string) => {
    setFlaggedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldKey)) next.delete(fieldKey);
      else next.add(fieldKey);
      return next;
    });
  };

  const toggleInputFlag = (inputKey: string) => {
    setFlaggedInputs((prev) => {
      const next = new Set(prev);
      if (next.has(inputKey)) next.delete(inputKey);
      else next.add(inputKey);
      return next;
    });
  };

  const toggleLocationFlag = (locationId: string) => {
    setFlaggedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(locationId)) next.delete(locationId);
      else next.add(locationId);
      return next;
    });
  };

  const buildFlags = () => [
    ...Array.from(flaggedFields).map((key) => ({ type: "field" as const, key, label: key.replace(/\./g, " ").replace(/([A-Z])/g, " $1").trim() })),
    ...Array.from(flaggedInputs).map((key) => ({ type: "input" as const, key, label: key.replace(/([A-Z])/g, " $1").trim() })),
    ...Array.from(flaggedLocations).map((key) => ({ type: "location" as const, key, label: `Location ${key}` })),
  ];
  useEffect(() => {
    if (data) {
      setStatus(data.admissionStatus);
      setNotes(data.interviewNotes);
      setBanned(data.isBanned);
      setBanReason(data.banReason ?? "");
      savedFlagsRef.current = JSON.stringify(data.flags ?? []);
    }
  }, [data]);

  // Unified auto-save: debounce notes/status changes; flags save immediately on change.
  const savedFlagsRef = useRef<string>("[]");
  const autoSaveTimerRef = useRef<number | undefined>(undefined);
  const [reviewSaveState, setReviewSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const doSaveReview = (isBanned: boolean) => {
    const flags = [
      ...Array.from(flaggedFields).map((key) => ({ type: "field" as const, key, label: key.replace(/\./g, " ").replace(/([A-Z])/g, " $1").trim() })),
      ...Array.from(flaggedInputs).map((key) => ({ type: "input" as const, key, label: key.replace(/([A-Z])/g, " $1").trim() })),
      ...Array.from(flaggedLocations).map((key) => ({ type: "location" as const, key, label: `Location ${key}` })),
    ];
    reviewMutation.mutate({ admissionStatus: status, interviewNotes: notes.trim(), isBanned, banReason: isBanned ? banReason.trim() : undefined, flags });
  };

  // Auto-save notes/status with 1.5 s debounce
  useEffect(() => {
    if (!data) return;
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => doSaveReview(banned), 1500);
    setReviewSaveState("idle");
    return () => { if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current); };
  }, [notes, status]);

  // Auto-save flags immediately on change
  useEffect(() => {
    if (!data) return;
    const currentFlags = JSON.stringify(buildFlags());
    if (currentFlags === savedFlagsRef.current) return;
    savedFlagsRef.current = currentFlags;
    autoPromoteToInterview();
    doSaveReview(banned);
  }, [flaggedFields, flaggedInputs, flaggedLocations]);

  const reviewMutation = useMutation({
    mutationFn: (input: { admissionStatus: AdmissionStatus; interviewNotes: string; isBanned: boolean; banReason?: string; flags: Array<{ type: string; key: string; label: string }> }) =>
      client.admin.admissions.updateReview({ id, ...input }),
    onSuccess: async () => {
      setReviewSaveState("saved");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.admin.admissions.list.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.admin.admissions.get.queryOptions({ input: { id } }).queryKey }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save review"),
  });

  // saveReview: explicit save for ban/unban actions
  const saveReview = (isBanned: boolean = banned) => {
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    doSaveReview(isBanned);
  };

  const draftInput = data?.data as Partial<ApplicationDraft> | undefined;
  const draft = normalizeDraft(draftInput);

  const effectiveHomeLocation = useMemo(() => {
    const history = draft.userLocationHistory ?? [];
    const adminEntry = history.find((e) => e.source === "admin");
    const userEntries = history.filter((e) => e.source !== "admin");
    // History is prepended (newest first); [0] is the most recent entry.
    const pin =
      adminEntry ??
      (userEntries.length > 0 ? userEntries[0] : null) ??
      (draft.selectedLocation?.latitude != null ? draft.selectedLocation : null) ??
      (draft.location?.latitude != null ? draft.location : null);
    if (!pin || pin.latitude == null || pin.longitude == null) return null;
    return { lat: pin.latitude, lng: pin.longitude };
  }, [draft.userLocationHistory, draft.selectedLocation, draft.location]);

  const autoInterviewMutation = useMutation({
    mutationFn: () => client.admin.admissions.setInterviewStatus({ id, status: "under_interview" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.admin.admissions.get.queryOptions({ input: { id } }).queryKey });
      queryClient.invalidateQueries({ queryKey: orpc.admin.admissions.list.key() });
    },
  });

  const autoPromoteToInterview = () => {
    if (hasAutoPromotedRef.current) return;
    if (!data || data.admissionStatus !== "pending") return;
    hasAutoPromotedRef.current = true;
    autoInterviewMutation.mutate();
  };

  const interviewEditsMutation = useMutation({
    mutationFn: (patch: { interviewEdits: InterviewEdit[] }) =>
      client.admin.admissions.saveInterviewEdits({ id, interviewEdits: patch.interviewEdits }),
    onSuccess: (result) => {
      const queryKey = orpc.admin.admissions.get.queryOptions({ input: { id } }).queryKey;
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return { ...old, data: { ...old.data, interviewEdits: result.interviewEdits } };
      });
      toast.success("Field updated and recorded as interview edit");
      autoPromoteToInterview();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save edit"),
  });

  const adminLocationMutation = useMutation({
    mutationFn: (input: { lat: number; lng: number; label?: string; mapQuery?: string }) =>
      client.admin.admissions.saveAdminLocation({ id, ...input }),
    onSuccess: (result) => {
      const queryKey = orpc.admin.admissions.get.queryOptions({ input: { id } }).queryKey;
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return { ...old, data: { ...old.data, userLocationHistory: result.userLocationHistory } };
      });
      toast.success("Admin location saved");
      autoPromoteToInterview();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save admin location"),
  });

  const handleFieldSave = (prev: string, next: string) => {
    if (!editFieldConfig || !data) return;
    const edit: InterviewEdit = {
      field: `${editFieldConfig.section}.${editFieldConfig.path}`,
      label: editFieldConfig.label,
      previousValue: prev,
      newValue: next,
      editedAt: new Date().toISOString(),
    };
    interviewEditsMutation.mutate({ interviewEdits: [...draft.interviewEdits, edit] });
  };

  const handleSaveAdminLocation = (lat: number, lng: number) => {
    if (!data) return;
    adminLocationMutation.mutate({ lat, lng, label: "Admin adjusted location" });
  };

  if (detail.isLoading) {
    return (
      <main className="min-h-svh p-6 md:p-10 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
        <Link to="/g1/admin/admissions/$id" params={{ id }} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Back to categories</Link>"
        <Card><CardContent className="flex items-center gap-3 p-8 text-sm text-muted-foreground"><ClipboardCheck className="text-primary" size={18} /> Loading applicant record…</CardContent></Card>
      </main>
    );
  }

  if (detail.error || !data) {
    return (
      <main className="min-h-svh p-6 md:p-10 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
        <Link to="/g1/admin/admissions/$id" params={{ id }} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Back to categories</Link>"
        <Card className="border-destructive/25"><CardContent className="flex items-start gap-2 p-6 text-sm text-destructive"><ShieldAlert size={17} className="mt-0.5 shrink-0" /> Could not load applicant: {detail.error?.message ?? "Not found"}</CardContent></Card>
      </main>
    );
  }

  const activeCategory = draft.categories.find((cat) => cat.id === categoryId);

  const lastEditFor = (field: string) => {
    const edits = draft.interviewEdits.filter((e) => e.field === field);
    return edits.length > 0 ? edits[edits.length - 1] : null;
  };

  // Latest admin-corrected value for a field; falls back to original draft value.
  const fieldValue = (field: string, original: string) => lastEditFor(field)?.newValue ?? original;
  // Original draft value shown as strikethrough when an interview edit exists.
  const fieldPrev = (field: string, original: string) => (lastEditFor(field) ? original : undefined);

  const openFieldEditor = (config: { label: string; fieldKey: string; section: string; path: string; currentValue: string }) => {
    setEditFieldConfig(config);
    setEditFieldOpen(true);
  };

  return (
    <main className="min-h-svh p-6 md:p-10 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
      <Link to="/g1/admin/admissions/$id" params={{ id }} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Back to categories</Link>"

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 mb-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><UserRound size={19} /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-primary">Interview workspace</p>
            <h2 className="font-heading text-2xl">{data.applicantName}</h2>
            <p className="text-sm text-muted-foreground">
              Session {data.sessionCode} · Category {activeCategory?.categoryType ?? categoryId} · Submitted {data.submittedAt ? new Date(data.submittedAt).toLocaleString() : "Not submitted"}
            </p>
          </div>
        </div>
        <StatusBadge status={status} banned={banned} />
      </div>

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border bg-card p-1">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === activeStep;
          const isCompleted = idx < activeStep;
          return (
            <button
              key={step.label}
              type="button"
              onClick={() => setActiveStep(idx)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-primary text-primary-foreground" : isCompleted ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                isActive ? "bg-primary-foreground/20 text-primary-foreground" : isCompleted ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {isCompleted ? <Check size={12} /> : idx + 1}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="grid gap-5">
        {activeStep === 0 && (<>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Applicant and guardian</CardTitle><CardDescription>Base information to confirm during the interview. Click the pencil to edit, flag to mark as suspicious.</CardDescription></CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                <DataRow label="Full name" value={fieldValue("applicant.fullName", draft.applicant.fullName)} fieldKey="fullName" previousValue={fieldPrev("applicant.fullName", draft.applicant.fullName)} flagged={flaggedFields.has("applicant.fullName")} onFlag={() => toggleFieldFlag("applicant.fullName")} onEdit={() => openFieldEditor({ label: "Full name", fieldKey: "fullName", section: "applicant", path: "fullName", currentValue: fieldValue("applicant.fullName", draft.applicant.fullName) })} />
                <DataRow label="Sinhala name" value={fieldValue("applicant.sinhalaName", draft.applicant.sinhalaName)} fieldKey="sinhalaName" previousValue={fieldPrev("applicant.sinhalaName", draft.applicant.sinhalaName)} flagged={flaggedFields.has("applicant.sinhalaName")} onFlag={() => toggleFieldFlag("applicant.sinhalaName")} onEdit={() => openFieldEditor({ label: "Sinhala name", fieldKey: "sinhalaName", section: "applicant", path: "sinhalaName", currentValue: fieldValue("applicant.sinhalaName", draft.applicant.sinhalaName) })} />
                <DataRow label="Date of birth" value={fieldValue("applicant.dateOfBirth", draft.applicant.dateOfBirth)} fieldKey="dateOfBirth" previousValue={fieldPrev("applicant.dateOfBirth", draft.applicant.dateOfBirth)} flagged={flaggedFields.has("applicant.dateOfBirth")} onFlag={() => toggleFieldFlag("applicant.dateOfBirth")} onEdit={() => openFieldEditor({ label: "Date of birth", fieldKey: "dateOfBirth", section: "applicant", path: "dateOfBirth", currentValue: fieldValue("applicant.dateOfBirth", draft.applicant.dateOfBirth) })} />
                <DataRow label="Birth certificate" value={fieldValue("applicant.birthCertificateNumber", draft.applicant.birthCertificateNumber)} fieldKey="birthCertificateNumber" previousValue={fieldPrev("applicant.birthCertificateNumber", draft.applicant.birthCertificateNumber)} flagged={flaggedFields.has("applicant.birthCertificateNumber")} onFlag={() => toggleFieldFlag("applicant.birthCertificateNumber")} onEdit={() => openFieldEditor({ label: "Birth certificate", fieldKey: "birthCertificateNumber", section: "applicant", path: "birthCertificateNumber", currentValue: fieldValue("applicant.birthCertificateNumber", draft.applicant.birthCertificateNumber) })} />
                <DataRow label="Gender" value={fieldValue("applicant.gender", draft.applicant.gender)} fieldKey="gender" previousValue={fieldPrev("applicant.gender", draft.applicant.gender)} flagged={flaggedFields.has("applicant.gender")} onFlag={() => toggleFieldFlag("applicant.gender")} onEdit={() => openFieldEditor({ label: "Gender", fieldKey: "gender", section: "applicant", path: "gender", currentValue: fieldValue("applicant.gender", draft.applicant.gender) })} />
                <DataRow label="Religion" value={fieldValue("applicant.religion", draft.applicant.religion)} fieldKey="religion" previousValue={fieldPrev("applicant.religion", draft.applicant.religion)} flagged={flaggedFields.has("applicant.religion")} onFlag={() => toggleFieldFlag("applicant.religion")} onEdit={() => openFieldEditor({ label: "Religion", fieldKey: "religion", section: "applicant", path: "religion", currentValue: fieldValue("applicant.religion", draft.applicant.religion) })} />
                <DataRow label="Education medium" value={fieldValue("applicant.educationMedium", draft.applicant.educationMedium)} fieldKey="educationMedium" previousValue={fieldPrev("applicant.educationMedium", draft.applicant.educationMedium)} flagged={flaggedFields.has("applicant.educationMedium")} onFlag={() => toggleFieldFlag("applicant.educationMedium")} onEdit={() => openFieldEditor({ label: "Education medium", fieldKey: "educationMedium", section: "applicant", path: "educationMedium", currentValue: fieldValue("applicant.educationMedium", draft.applicant.educationMedium) })} />
                <DataRow label="Guardian" value={fieldValue("guardian.fullName", draft.guardian.fullName)} fieldKey="guardianFullName" previousValue={fieldPrev("guardian.fullName", draft.guardian.fullName)} flagged={flaggedFields.has("guardian.fullName")} onFlag={() => toggleFieldFlag("guardian.fullName")} onEdit={() => openFieldEditor({ label: "Guardian name", fieldKey: "guardianFullName", section: "guardian", path: "fullName", currentValue: fieldValue("guardian.fullName", draft.guardian.fullName) })} />
                <DataRow label="Guardian Sinhala name" value={fieldValue("guardian.sinhalaName", draft.guardian.sinhalaName)} fieldKey="guardianSinhalaName" previousValue={fieldPrev("guardian.sinhalaName", draft.guardian.sinhalaName)} flagged={flaggedFields.has("guardian.sinhalaName")} onFlag={() => toggleFieldFlag("guardian.sinhalaName")} onEdit={() => openFieldEditor({ label: "Guardian Sinhala name", fieldKey: "guardianSinhalaName", section: "guardian", path: "sinhalaName", currentValue: fieldValue("guardian.sinhalaName", draft.guardian.sinhalaName) })} />
                <DataRow label="Relationship" value={fieldValue("guardian.relationship", draft.guardian.relationship)} fieldKey="relationship" previousValue={fieldPrev("guardian.relationship", draft.guardian.relationship)} flagged={flaggedFields.has("guardian.relationship")} onFlag={() => toggleFieldFlag("guardian.relationship")} onEdit={() => openFieldEditor({ label: "Relationship", fieldKey: "relationship", section: "guardian", path: "relationship", currentValue: fieldValue("guardian.relationship", draft.guardian.relationship) })} />
                <DataRow label="Guardian NIC" value={fieldValue("guardian.nic", draft.guardian.nic)} fieldKey="nic" previousValue={fieldPrev("guardian.nic", draft.guardian.nic)} flagged={flaggedFields.has("guardian.nic")} onFlag={() => toggleFieldFlag("guardian.nic")} onEdit={() => openFieldEditor({ label: "Guardian NIC", fieldKey: "nic", section: "guardian", path: "nic", currentValue: fieldValue("guardian.nic", draft.guardian.nic) })} />
                <DataRow label="Phone" value={fieldValue("guardian.phone", draft.guardian.phone)} fieldKey="phone" previousValue={fieldPrev("guardian.phone", draft.guardian.phone)} flagged={flaggedFields.has("guardian.phone")} onFlag={() => toggleFieldFlag("guardian.phone")} onEdit={() => openFieldEditor({ label: "Phone", fieldKey: "phone", section: "guardian", path: "phone", currentValue: fieldValue("guardian.phone", draft.guardian.phone) })} />
                <DataRow label="WhatsApp" value={fieldValue("guardian.whatsappPhone", draft.guardian.whatsappPhone)} fieldKey="whatsappPhone" previousValue={fieldPrev("guardian.whatsappPhone", draft.guardian.whatsappPhone)} flagged={flaggedFields.has("guardian.whatsappPhone")} onFlag={() => toggleFieldFlag("guardian.whatsappPhone")} onEdit={() => openFieldEditor({ label: "WhatsApp", fieldKey: "whatsappPhone", section: "guardian", path: "whatsappPhone", currentValue: fieldValue("guardian.whatsappPhone", draft.guardian.whatsappPhone) })} />
                <DataRow label="Email" value={fieldValue("guardian.email", draft.guardian.email)} fieldKey="email" previousValue={fieldPrev("guardian.email", draft.guardian.email)} flagged={flaggedFields.has("guardian.email")} onFlag={() => toggleFieldFlag("guardian.email")} onEdit={() => openFieldEditor({ label: "Email", fieldKey: "email", section: "guardian", path: "email", currentValue: fieldValue("guardian.email", draft.guardian.email) })} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Residence and location</CardTitle><CardDescription>Use the submitted address and map point as interview references. Flag suspicious entries.</CardDescription></CardHeader>
              <CardContent className="grid gap-2">
                <DataRow label="Permanent address (English)" value={fieldValue("residence.permanentAddressEn", draft.residence.permanentAddressEn)} fieldKey="permanentAddressEn" previousValue={fieldPrev("residence.permanentAddressEn", draft.residence.permanentAddressEn)} flagged={flaggedFields.has("residence.permanentAddressEn")} onFlag={() => toggleFieldFlag("residence.permanentAddressEn")} onEdit={() => openFieldEditor({ label: "Permanent address (English)", fieldKey: "permanentAddressEn", section: "residence", path: "permanentAddressEn", currentValue: fieldValue("residence.permanentAddressEn", draft.residence.permanentAddressEn) })} />
                <DataRow label="Permanent address (Sinhala)" value={fieldValue("residence.permanentAddressSi", draft.residence.permanentAddressSi)} fieldKey="permanentAddressSi" previousValue={fieldPrev("residence.permanentAddressSi", draft.residence.permanentAddressSi)} flagged={flaggedFields.has("residence.permanentAddressSi")} onFlag={() => toggleFieldFlag("residence.permanentAddressSi")} onEdit={() => openFieldEditor({ label: "Permanent address (Sinhala)", fieldKey: "permanentAddressSi", section: "residence", path: "permanentAddressSi", currentValue: fieldValue("residence.permanentAddressSi", draft.residence.permanentAddressSi) })} />
                <DataRow label="Current address (English)" value={fieldValue("residence.currentAddressEn", draft.residence.currentAddressEn)} fieldKey="currentAddressEn" previousValue={fieldPrev("residence.currentAddressEn", draft.residence.currentAddressEn)} flagged={flaggedFields.has("residence.currentAddressEn")} onFlag={() => toggleFieldFlag("residence.currentAddressEn")} onEdit={() => openFieldEditor({ label: "Current address (English)", fieldKey: "currentAddressEn", section: "residence", path: "currentAddressEn", currentValue: fieldValue("residence.currentAddressEn", draft.residence.currentAddressEn) })} />
                <DataRow label="Current address (Sinhala)" value={fieldValue("residence.currentAddressSi", draft.residence.currentAddressSi)} fieldKey="currentAddressSi" previousValue={fieldPrev("residence.currentAddressSi", draft.residence.currentAddressSi)} flagged={flaggedFields.has("residence.currentAddressSi")} onFlag={() => toggleFieldFlag("residence.currentAddressSi")} onEdit={() => openFieldEditor({ label: "Current address (Sinhala)", fieldKey: "currentAddressSi", section: "residence", path: "currentAddressSi", currentValue: fieldValue("residence.currentAddressSi", draft.residence.currentAddressSi) })} />
                <DataRow label="District" value={fieldValue("residence.district", draft.residence.district)} fieldKey="district" previousValue={fieldPrev("residence.district", draft.residence.district)} flagged={flaggedFields.has("residence.district")} onFlag={() => toggleFieldFlag("residence.district")} onEdit={() => openFieldEditor({ label: "District", fieldKey: "district", section: "residence", path: "district", currentValue: fieldValue("residence.district", draft.residence.district) })} />
                <DataRow label="DS division" value={fieldValue("residence.dsDivision", draft.residence.dsDivision)} fieldKey="dsDivision" previousValue={fieldPrev("residence.dsDivision", draft.residence.dsDivision)} flagged={flaggedFields.has("residence.dsDivision")} onFlag={() => toggleFieldFlag("residence.dsDivision")} onEdit={() => openFieldEditor({ label: "DS division", fieldKey: "dsDivision", section: "residence", path: "dsDivision", currentValue: fieldValue("residence.dsDivision", draft.residence.dsDivision) })} />
                <DataRow label="GN division" value={fieldValue("residence.gnDivision", draft.residence.gnDivision)} fieldKey="gnDivision" previousValue={fieldPrev("residence.gnDivision", draft.residence.gnDivision)} flagged={flaggedFields.has("residence.gnDivision")} onFlag={() => toggleFieldFlag("residence.gnDivision")} onEdit={() => openFieldEditor({ label: "GN division", fieldKey: "gnDivision", section: "residence", path: "gnDivision", currentValue: fieldValue("residence.gnDivision", draft.residence.gnDivision) })} />
                <DataRow label="Electoral district" value={fieldValue("residence.electoralDistrict", draft.residence.electoralDistrict)} fieldKey="electoralDistrict" previousValue={fieldPrev("residence.electoralDistrict", draft.residence.electoralDistrict)} flagged={flaggedFields.has("residence.electoralDistrict")} onFlag={() => toggleFieldFlag("residence.electoralDistrict")} onEdit={() => openFieldEditor({ label: "Electoral district", fieldKey: "electoralDistrict", section: "residence", path: "electoralDistrict", currentValue: fieldValue("residence.electoralDistrict", draft.residence.electoralDistrict) })} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Declaration</CardTitle><CardDescription>Confirm the applicant's declaration status.</CardDescription></CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                <DataRow label="Information confirmed" value={fieldValue("declaration.confirmed", String(draft.declaration.confirmed))} fieldKey="confirmed" previousValue={fieldPrev("declaration.confirmed", String(draft.declaration.confirmed))} flagged={flaggedFields.has("declaration.confirmed")} onFlag={() => toggleFieldFlag("declaration.confirmed")} onEdit={() => openFieldEditor({ label: "Information confirmed", fieldKey: "confirmed", section: "declaration", path: "confirmed", currentValue: fieldValue("declaration.confirmed", String(draft.declaration.confirmed)) })} />
                <DataRow label="Consent given" value={fieldValue("declaration.consent", String(draft.declaration.consent))} fieldKey="consent" previousValue={fieldPrev("declaration.consent", String(draft.declaration.consent))} flagged={flaggedFields.has("declaration.consent")} onFlag={() => toggleFieldFlag("declaration.consent")} onEdit={() => openFieldEditor({ label: "Consent given", fieldKey: "consent", section: "declaration", path: "consent", currentValue: fieldValue("declaration.consent", String(draft.declaration.consent)) })} />
              </CardContent>
            </Card>
          </div>
          {(flaggedFields.size > 0) && (
            <Card className="border-red-200 bg-red-50/30">
              <CardHeader><CardTitle className="text-red-700 flex items-center gap-2"><Flag size={16} /> Flagged fields ({flaggedFields.size})</CardTitle><CardDescription>Fields marked as suspicious during review.</CardDescription></CardHeader>
              <CardContent className="grid gap-2">
                {Array.from(flaggedFields).map((fieldKey) => {
                  const parts = fieldKey.split(".");
                  const section = parts[0] as keyof typeof draft;
                  const prop = parts.slice(1).join(".");
                  const sectionData = draft[section] as Record<string, unknown> | undefined;
                  const rawVal = sectionData ? (sectionData as Record<string,unknown>)[prop] : undefined;
                  const currentVal = fieldValue(fieldKey, String(rawVal ?? ""));
                  const humanLabel = prop.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
                  return (
                    <div key={fieldKey} className="flex items-center justify-between gap-3 rounded-lg border border-red-200/60 bg-white px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[0.68rem] font-bold uppercase tracking-wide text-red-500 mb-0.5">{humanLabel}</p>
                        <p className="text-sm font-semibold text-foreground truncate">{currentVal || <span className="italic text-muted-foreground font-normal">Not provided</span>}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => toggleFieldFlag(fieldKey)} className="shrink-0 text-red-600 hover:text-red-700"><X size={14} /> Remove flag</Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
          {draft.interviewEdits.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle>Interview edit history</CardTitle>
                    <CardDescription>Previous and new values for fields edited during this interview.</CardDescription>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">{draft.interviewEdits.length} edits</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-72 overflow-y-auto grid gap-2">
                  {[...draft.interviewEdits].reverse().map((edit, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-lg border p-3">
                      <Pencil size={14} className="mt-0.5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-semibold">{edit.label}</span>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          {edit.field.includes("schoolsWithinRadius") ? (
                            <>
                              <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{edit.previousValue}</span>
                              <ArrowRight size={10} className="shrink-0 text-muted-foreground" />
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary whitespace-pre-wrap">{edit.newValue}</span>
                            </>
                          ) : (
                            <>
                              <span className="rounded bg-muted px-1.5 py-0.5 line-through text-muted-foreground">{edit.previousValue || "(empty)"}</span>
                              <ArrowRight size={10} className="shrink-0 text-muted-foreground" />
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">{edit.newValue || "(empty)"}</span>
                            </>
                          )}
                        </div>
                        <span className="mt-1 block text-[0.65rem] text-muted-foreground">{new Date(edit.editedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>)}

        {editFieldConfig && (
          <FieldEditDialog open={editFieldOpen} onOpenChange={setEditFieldOpen} label={editFieldConfig.label} fieldKey={editFieldConfig.fieldKey} currentValue={editFieldConfig.currentValue} onSave={handleFieldSave} />
        )}

        {activeStep === 1 && (
          <ApplicantLocationReview draft={draft} flaggedLocations={flaggedLocations} onToggleLocationFlag={toggleLocationFlag} onSaveAdminLocation={handleSaveAdminLocation} />
        )}

        {activeStep === 2 && (
          activeCategory ? (
            <CategoryScoringCard
              category={activeCategory}
              flaggedInputs={flaggedInputs}
              onToggleInputFlag={toggleInputFlag}
              homeLocation={effectiveHomeLocation}
              applicationId={id}
              draft={draft}
              onSaveInterviewEdits={(edits) => interviewEditsMutation.mutate({ interviewEdits: edits })}
              onFirstEdit={autoPromoteToInterview}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Category <code className="rounded bg-muted px-1.5 py-0.5">{categoryId}</code> not found in this application.
              </CardContent>
            </Card>
          )
        )}

        {activeStep === 3 && (
          <Card className="border-primary/20">
            <CardHeader><CardTitle>Interview decision & flagging</CardTitle><CardDescription>Record the review outcome and flag or ban the applicant if needed.</CardDescription></CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-2 sm:max-w-sm">
                <label htmlFor="admission-status" className="text-sm font-semibold">Review status</label>
                <Select value={status} onValueChange={(value) => { setStatus((value ?? "pending") as AdmissionStatus); }}>
                  <SelectTrigger id="admission-status" className="w-full"><SelectValue>{{"pending":"Pending review","under_interview":"Under interview","verified":"Verified","fake":"Potentially fake"}[status] ?? status}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending review</SelectItem>
                    <SelectItem value="under_interview">Under interview</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="fake">Potentially fake</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(flaggedFields.size > 0 || flaggedInputs.size > 0 || flaggedLocations.size > 0) && (
                <div className="grid gap-3 rounded-xl border border-red-200 bg-red-50/30 p-4">
                  <h4 className="text-sm font-semibold text-red-700 flex items-center gap-2"><Flag size={14} /> Flagged items ({flaggedFields.size + flaggedInputs.size + flaggedLocations.size})</h4>
                  <div className="grid gap-2">
                    {flaggedFields.size > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Applicant / Guardian fields</p>
                        <div className="flex flex-wrap gap-1">
                          {Array.from(flaggedFields).map((key) => (
                            <button key={key} type="button" onClick={() => toggleFieldFlag(key)} className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[0.7rem] text-red-700 hover:bg-red-200 transition-colors">
                              {key.startsWith("applicant.") ? key.replace("applicant.", "") : key.startsWith("guardian.") ? key.replace("guardian.", "") : key.replace("residence.", "").replace(/([A-Z])/g, " $1").trim()} <X size={10} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {flaggedInputs.size > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Category scoring inputs</p>
                        <div className="flex flex-wrap gap-1">
                          {Array.from(flaggedInputs).map((key) => (
                            <button key={key} type="button" onClick={() => toggleInputFlag(key)} className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[0.7rem] text-red-700 hover:bg-red-200 transition-colors">
                              {key.replace(/([A-Z])/g, " $1").trim()} <X size={10} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {flaggedLocations.size > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Locations</p>
                        <div className="flex flex-wrap gap-1">
                          {Array.from(flaggedLocations).map((key) => (
                            <button key={key} type="button" onClick={() => toggleLocationFlag(key)} className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[0.7rem] text-red-700 hover:bg-red-200 transition-colors">
                              Location <X size={10} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Click to remove flags. Flags are saved with your review.</p>
                </div>
              )}

              {draft.interviewEdits.length > 0 && (
                <div className="grid gap-3 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
                  <h4 className="text-sm font-semibold text-blue-700 flex items-center gap-2"><Pencil size={14} /> Interview notes ({draft.interviewEdits.length})</h4>
                  <p className="text-xs text-muted-foreground">Field edits made during this interview session. These are observations only and do not change the applicant's original data.</p>
                  <div className="grid gap-1 max-h-[200px] overflow-y-auto">
                    {[...draft.interviewEdits].reverse().map((edit, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs py-1 border-b border-blue-200/50 last:border-b-0">
                        <span className="font-medium">{edit.label}:</span>
                        {edit.field.includes("schoolsWithinRadius") ? (
                          <>
                            <span className="text-muted-foreground">{edit.previousValue}</span>
                            <span className="text-blue-600 whitespace-pre-wrap">{edit.newValue}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-muted-foreground line-through">{edit.previousValue || "(empty)"}</span>
                            <span className="text-blue-600">{edit.newValue || "(empty)"}</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <label htmlFor="interview-notes" className="text-sm font-semibold">Interview notes</label>
                <Textarea id="interview-notes" value={notes} onChange={(event) => { setNotes(event.target.value); }} placeholder="Record what was checked and any follow-up needed…" rows={5} maxLength={5000} />
                <span className="text-xs text-muted-foreground">{notes.length.toLocaleString()} / 5,000 characters</span>
              </div>
              {banned && <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive"><Ban size={16} className="mt-0.5 shrink-0" /><span><strong>Applicant banned.</strong> {banReason || "No reason recorded."}</span></div>}
              {reviewMutation.error && <p className="text-sm text-destructive" role="alert">{reviewMutation.error instanceof Error ? reviewMutation.error.message : "Could not save review"}</p>}
              <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {reviewMutation.isPending ? <><span className="size-1.5 rounded-full bg-amber-400 animate-pulse inline-block" /> Saving…</> : reviewSaveState === "saved" ? <><Check size={12} className="text-emerald-600" /> Saved</> : <><span className="size-1.5 rounded-full bg-amber-500 inline-block" /> Unsaved</>}
                </span>
                {banned ? (
                  <Button variant="secondary" disabled={reviewMutation.isPending} onClick={() => { setBanned(false); saveReview(false); }}><X size={17} /> Remove ban</Button>
                ) : (
                  <Button variant="destructive" disabled={reviewMutation.isPending} onClick={() => setBanDialogOpen(true)}><Ban size={17} /> Ban applicant</Button>
                )}
                <Button variant="outline" render={<Link to="/g1/admin/applications/$id" params={{ id: data.id }} search={{ mode: "edit" }} />} nativeButton={false}><Edit3 size={17} /> Edit application</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="outline" disabled={activeStep === 0} onClick={() => setActiveStep((s) => Math.max(0, s - 1))}><ArrowLeft size={15} /> Previous</Button>
          <span className="text-sm text-muted-foreground">Step {activeStep + 1} of {STEPS.length}</span>
          <Button variant="outline" disabled={activeStep === STEPS.length - 1} onClick={() => setActiveStep((s) => Math.min(STEPS.length - 1, s + 1))}>Next <ArrowRight size={15} /></Button>
        </div>

        <BanDialog open={banDialogOpen} onOpenChange={setBanDialogOpen} applicantName={data.applicantName} reason={banReason} onReasonChange={setBanReason} pending={reviewMutation.isPending} onConfirm={() => { setBanned(true); setBanDialogOpen(false); saveReview(true); }} />
      </div>
    </main>
  );
}
