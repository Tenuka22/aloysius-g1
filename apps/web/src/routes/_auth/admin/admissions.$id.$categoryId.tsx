import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Calculator, Check, ClipboardCheck, CreditCard, Edit3, FileText, Flag, Hash, LockKeyhole, Mail, MapPin, Pencil, Phone, RotateCcw, Save, ShieldAlert, User, UserRound, X } from "lucide-react";
import { client, orpc } from "@/utils/orpc";
import { normalizeDraft, type ApplicationDraft, type InterviewEdit, type LocationDraft, type ScoringInputs } from "@/lib/application-store";
import { scoreCategory } from "@/lib/scoring";
import { CATEGORY_MAX_MARKS } from "@/lib/marking-scheme";
import { findSchoolById, haversineDistanceKm } from "@/lib/school-utils";
import { HOME_SCHOOL_ID, getHomeSchoolDisplayName } from "@/lib/school-config";
import { FIELD_ICON_COLORS } from "@/lib/color-classes";
import { toast } from "sonner";
import { Badge } from "@aloysius-g1/ui/components/badge";
import { Button } from "@aloysius-g1/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aloysius-g1/ui/components/card";
import { Input } from "@aloysius-g1/ui/components/input";
import { Textarea } from "@aloysius-g1/ui/components/textarea";
import { Checkbox } from "@aloysius-g1/ui/components/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aloysius-g1/ui/components/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@aloysius-g1/ui/components/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@aloysius-g1/ui/components/dialog";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@aloysius-g1/ui/components/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aloysius-g1/ui/components/tabs";
import { DISTRICTS, DIVISIONAL_SECRETARIATS, ELECTORAL_CONSTITUENCIES, GN_DIVISIONS } from "@/lib/divisions";
import { type AdmissionStatus, type AdmissionDetail, type FlagEntry, CATEGORY_LABELS } from "./admissions";
import { Category61Fields, Category62Fields, Category63Fields, Category64Fields, Category65Fields, Category66Fields } from "@/components/application/category-step";
const AdmissionsCategoryMap = lazy(() => import("./-admissions-category-map"));
import type { LocationEvidence } from "./-admissions-category-map";

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
  "6.4": { description: "Government service period, difficult service, leave, and service distances.", maxMarks: CATEGORY_MAX_MARKS },
  "6.5": { description: "Transfer distance, service history, recency, leave, and school proximity.", maxMarks: CATEGORY_MAX_MARKS },
  "6.6": { description: "Continuous foreign employment, purpose, and home-to-school proximity.", maxMarks: CATEGORY_MAX_MARKS },
};

export const Route = createFileRoute("/_auth/admin/admissions/$id/$categoryId")({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.prefetchQuery(context.orpc.admin.admissions.get.queryOptions({ input: { id: params.id } })),
      context.queryClient.prefetchQuery(context.orpc.admin.admissions.getMarks.queryOptions({ input: { applicationId: params.id } })),
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
      const names = value.flatMap((schoolId) => typeof schoolId === "string" && findSchoolById(schoolId) ? [findSchoolById(schoolId)!.en] : []);
      return names.length > 0 ? names.join(", ") : "None selected";
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
  const displayValue = isEmpty ? "Not provided" : String(value === null || value === undefined ? "Not provided" : value);
  const hasEdit = previousValue !== undefined && previousValue !== displayValue;
  const valueEl = (
    <strong className={isEmpty ? "text-muted-foreground italic font-normal text-sm leading-relaxed" : `${style.colorClass} text-sm leading-relaxed`}>{displayValue}</strong>
  );
  return (
    <div className={`grid gap-1 border-b border-border/70 py-3 last:border-b-0 ${flagged ? "bg-red-50/50 -mx-2 px-2 rounded" : ""}`}>
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground flex items-center gap-1.5">
        <span className="opacity-50">{style.icon}</span>
        {label}
        {flagged && <span className="text-red-500 font-bold text-[0.6rem] uppercase tracking-wider ml-1">Flagged</span>}
        <span className="ml-auto flex items-center gap-1">
          {onFlag && (
            <button type="button" onClick={onFlag} className={`rounded-md p-1 transition-colors ${flagged ? "bg-red-100 text-red-600 hover:bg-red-200" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`} title={flagged ? "Remove flag" : "Flag as suspicious"}>
              <Flag size={12} />
            </button>
          )}
          {onEdit && (
            <button type="button" onClick={onEdit} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title={`Edit ${label}`}>
              <Pencil size={12} />
            </button>
          )}
        </span>
      </span>
      {hasEdit ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={<span className="cursor-help">{valueEl}</span>} />
            <TooltipContent>Previous: {previousValue || "(empty)"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : valueEl}
    </div>
  );
}

type FieldEditOption = { value: string; label: string };

const FIELD_OPTIONS: Record<string, FieldEditOption[]> = {
  gender: [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }],
  religion: [{ value: "Buddhist", label: "Buddhist" }, { value: "Catholic", label: "Catholic" }, { value: "Christian", label: "Christian" }, { value: "Islam", label: "Islam" }],
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

  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;
  const onMapClickRef = useRef<(lat: number, lng: number) => void>(() => {});
  onMapClickRef.current = (lat, lng) => { if (editModeRef.current) setPendingPin({ lat, lng }); };

  // ─── Build a stable flat list of all evidence points ───────────────────────
  // Each point gets a stable string ID — using UUID from DB when available, else a deterministic prefix+index.
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

    // Primary applicant-submitted locations
    addPoint("applicant-selected", "Selected application location", draft.selectedLocation, "selected");
    addPoint("applicant-detected", "Application location (auto-detected)", draft.location, "selected");

    // Browser-provided default locations
    draft.defaultLocations.forEach((entry, i) => addPoint(`browser-${i}`, `Browser location ${i + 1}`, entry, "true"));

    // User location history — admin entries get group "admin", user pins get "selected"
    draft.userLocationHistory.forEach((entry, i) => {
      const isAdmin = entry.source === "admin";
      addPoint(entry.id ?? `user-history-${i}`, isAdmin ? "Admin-adjusted location" : `Previously selected pin ${i + 1}`, entry, isAdmin ? "admin" : "selected");
    });

    // Device GPS history
    draft.deviceLocationHistory.forEach((entry, i) => addPoint(entry.id ?? `device-${i}`, `Device GPS fix ${i + 1}`, entry, "true"));

    return pts;
  }, [draft]);

  // ─── Derive logical groups ──────────────────────────────────────────────────
  const adminPin = useMemo(() => allPoints.find(p => p.group === "admin") ?? null, [allPoints]);
  const userSelectedPins = useMemo(() => allPoints.filter(p => p.group === "selected"), [allPoints]);
  const truePins = useMemo(() => allPoints.filter(p => p.group === "true"), [allPoints]);

  // The "effective" home location: admin override replaces the last user-selected pin
  const effectivePin = useMemo(() => adminPin ?? (userSelectedPins.length > 0 ? userSelectedPins[userSelectedPins.length - 1] : null), [adminPin, userSelectedPins]);

  // What appears in the "User selected locations" list — admin override replaces the last user pin
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
  }, []); // only on mount — user controls checkboxes after that

  const [visibleIds, setVisibleIds] = useState<Set<string>>(initialVisibleIds);

  // When the admin saves a location the effectivePin id changes — ensure the new pin is visible
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
              <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                <Pencil size={14} /> {adminPin ? "Replace admin location" : "Set admin location"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
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
                  {pendingPin ? "📍 New location set — click Save location above" : "🖱 Click anywhere on the map to pin the admin location"}
                </div>
              )}
            </div>

            {/* Location lists */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* User selected + admin override */}
              <div className="grid gap-2">
                <h3 className="text-sm font-semibold">
                  User selected locations
                  {adminPin && <Badge variant="outline" className="ml-2 border-amber-500 text-amber-600 text-[0.6rem]">Admin override active</Badge>}
                </h3>
                {displayedSelectedPins.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No user-selected locations.</p>
                ) : (
                  <ul className="grid max-h-[280px] gap-2 overflow-y-auto pr-1">
                    {displayedSelectedPins.map((p, i) => renderPin(p, i === displayedSelectedPins.length - 1))}
                  </ul>
                )}
              </div>

              {/* Device/browser true locations */}
              <div className="grid gap-2">
                <h3 className="text-sm font-semibold">Device &amp; browser locations</h3>
                {truePins.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No device/browser locations captured.</p>
                ) : (
                  <ul className="grid max-h-[280px] gap-2 overflow-y-auto pr-1">
                    {truePins.map((p, i) => renderPin(p, i === truePins.length - 1))}
                  </ul>
                )}
              </div>
            </div>

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

type EditableBreakdown = { label: string; marks: number; max: number };
type EditableCategory = { categoryType: string; breakdown: EditableBreakdown[]; total: number };

function CategoryScoringCard({ applicationId, category, autoScore, draft, flaggedInputs, onToggleInputFlag, homeLocation, onSaveInterviewEdits }: { applicationId: string; category: ApplicationDraft["categories"][0]; autoScore: ReturnType<typeof scoreCategory> | null; draft: ApplicationDraft; flaggedInputs: Set<string>; onToggleInputFlag: (key: string) => void; homeLocation: { lat: number; lng: number } | null; onSaveInterviewEdits: (edits: InterviewEdit[]) => void }) {
  const queryClient = useQueryClient();

  const existingMarks = useQuery({
    ...orpc.admin.admissions.getMarks.queryOptions({ input: { applicationId } }),
  });

  const savedMark = useMemo(() => {
    if (!existingMarks.data) return null;
    const found = existingMarks.data.find((m) => m.categoryType === category.categoryType);
    if (!found) return null;
    return {
      ...found,
      breakdown: (found.breakdown as Array<{ label: string; marks: number; max: number }>),
    };
  }, [existingMarks.data, category.categoryType]);

  const [breakdown, setBreakdown] = useState<EditableBreakdown[]>([]);
  const [inputsEditable, setInputsEditable] = useState(false);
  const [editedInputs, setEditedInputs] = useState<ScoringInputs>(() => ({ ...category.scoringInputs }));
  const originalInputsRef = useRef<ScoringInputs>({ ...category.scoringInputs });

  useEffect(() => {
    setEditedInputs({ ...category.scoringInputs });
    originalInputsRef.current = { ...category.scoringInputs };
  }, [category.id]);

  const editedCategory = useMemo(() => ({ ...category, scoringInputs: editedInputs }), [category, editedInputs]);
  const editedAutoScore = useMemo(() => scoreCategory(editedCategory), [editedCategory]);

  useEffect(() => {
    if (!autoScore) return;
    if (savedMark) {
      setBreakdown(savedMark.breakdown.map((r) => ({ label: r.label, marks: r.marks, max: r.max })));
    } else {
      setBreakdown(editedAutoScore.breakdown.map((r) => ({ ...r })));
    }
  }, [autoScore, savedMark, editedAutoScore]);

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
    setEditedInputs((prev) => {
      const next = { ...prev, ...patch };
      const edits: InterviewEdit[] = [];
      for (const [key, newVal] of Object.entries(patch)) {
        const oldVal = (prev as Record<string, unknown>)[key];
        const oldStr = formatFieldValue(key, oldVal);
        const newStr = formatFieldValue(key, newVal);
        if (oldStr !== newStr) {
          edits.push({
            field: `category.${category.categoryType}.scoringInputs.${key}`,
            label: formatFieldName(key),
            previousValue: oldStr,
            newValue: newStr,
            editedAt: new Date().toISOString(),
          });
        }
      }
      if (edits.length > 0) {
        onSaveInterviewEdits([...draft.interviewEdits, ...edits]);
      }
      saveScoringInputsMutation.mutate(next);
      return next;
    });
  };

  const saveMarksMutation = useMutation({
    mutationFn: () =>
      client.admin.admissions.saveMarks({
        applicationId,
        categoryType: category.categoryType,
        breakdown: breakdown.map((r) => ({ label: r.label, marks: r.marks, max: r.max })),
        total: breakdown.reduce((s, r) => s + r.marks, 0),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orpc.admin.admissions.getMarks.key() });
      toast.success("Marks saved");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save marks"),
  });

  const saveScoringInputsMutation = useMutation({
    mutationFn: (scoringInputs: ScoringInputs) =>
      client.admin.admissions.saveScoringInputs({ id: applicationId, categoryId: category.id, scoringInputs }),
    onSuccess: () => {
      const queryKey = orpc.admin.admissions.get.queryOptions({ input: { id: applicationId } }).queryKey;
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save scoring inputs"),
  });

  const updateMarks = (idx: number, val: string) => {
    setBreakdown((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], marks: Math.max(0, val === "" ? 0 : Number(val)) };
      return next;
    });
  };

  const total = breakdown.reduce((s, r) => s + r.marks, 0);
  const hasExceeded = breakdown.some((r) => r.marks > r.max);
  const hasMarkChanges = autoScore ? breakdown.some((r, i) => r.marks !== autoScore.breakdown[i]?.marks) || total !== autoScore.total : false;
  const hasInputChanges = inputChanges.length > 0;

  const renderFields = () => {
    const flagProps = { flaggedInputs, onToggleInputFlag };
    const locProps = homeLocation ? { centerLat: homeLocation.lat, centerLng: homeLocation.lng } : {};
    switch (category.categoryType) {
      case "6.1": return <Category61Fields category={editedCategory} onChange={handleInputPatch} {...locProps} {...flagProps} />;
      case "6.2": return <Category62Fields category={editedCategory} onChange={handleInputPatch} {...flagProps} />;
      case "6.3": return <Category63Fields category={editedCategory} onChange={handleInputPatch} {...locProps} {...flagProps} />;
      case "6.4": return <Category64Fields category={editedCategory} onChange={handleInputPatch} {...flagProps} />;
      case "6.5": return <Category65Fields category={editedCategory} onChange={handleInputPatch} {...locProps} {...flagProps} />;
      case "6.6": return <Category66Fields category={editedCategory} onChange={handleInputPatch} {...locProps} {...flagProps} />;
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
          {renderFields()}

          {hasInputChanges && (
            <div className="mt-2 pt-2 border-t">
              <p className="text-xs font-semibold text-amber-600 flex items-center gap-1 mb-1"><Pencil size={10} /> Modified inputs ({inputChanges.length})</p>
              <div className="grid gap-1">
                {inputChanges.map((change) => (
                  <div key={change.key} className="flex items-center justify-between gap-2 rounded-md bg-amber-50 px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <span className="text-[0.7rem] font-semibold text-amber-700">{change.label}</span>
                      <div className="flex items-center gap-1.5 text-[0.65rem]">
                        <span className="text-muted-foreground line-through truncate">{change.oldValue || "(empty)"}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium text-amber-700 truncate">{change.newValue || "(empty)"}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleInputFlag(change.key)}
                      className={`shrink-0 rounded-md p-1 transition-colors ${flaggedInputs.has(change.key) ? "bg-red-100 text-red-600 hover:bg-red-200" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                      title={flaggedInputs.has(change.key) ? "Remove flag" : "Flag as suspicious"}
                    >
                      <Flag size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-2 pt-2 border-t">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1"><Flag size={10} /> Flag inputs</p>
            <div className="flex flex-wrap gap-1">
              {Object.keys(editedInputs).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onToggleInputFlag(key)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.65rem] transition-colors ${
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

        <div className="grid gap-3 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Mark allocation</h4>
            <div className="flex items-center gap-2">
              {hasInputChanges && <Badge variant="secondary">Inputs changed</Badge>}
              {hasMarkChanges && <Badge variant="secondary">Marks modified</Badge>}
              {hasExceeded && <Badge variant="destructive">Exceeds max</Badge>}
              <Badge variant={hasMarkChanges ? "default" : "outline"}>Admin: {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Badge>
            </div>
          </div>
          {breakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground">No breakdown rows for this category.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-4">Label</th>
                    <th className="pb-2 pr-4 text-right">Auto</th>
                    <th className="pb-2 pr-4 text-right">Admin</th>
                    <th className="pb-2 text-right">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((row, idx) => {
                    const autoMarks = editedAutoScore.breakdown[idx]?.marks ?? autoScore?.breakdown[idx]?.marks ?? 0;
                    const exceeds = row.marks > row.max;
                    const matches = row.marks === autoMarks;
                    let bg = "";
                    if (exceeds) bg = "bg-red-50";
                    else if (!matches) bg = "bg-amber-50";
                    else bg = "bg-emerald-50";
                    return (
                      <tr key={idx} className="border-b border-border/50 last:border-b-0">
                        <td className="py-2 pr-4 font-medium">{row.label}</td>
                        <td className="py-2 pr-4 text-right text-muted-foreground">{autoMarks}</td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <Input
                              type="number"
                              min={0}
                              max={row.max}
                              step={0.5}
                              value={row.marks}
                              onChange={(e) => updateMarks(idx, e.target.value)}
                              className={`h-8 w-20 text-right ${bg}`}
                            />
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger render={<button type="button" className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" />}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                                </TooltipTrigger>
                                <TooltipContent>Pre-filled: {autoMarks} / {row.max}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </td>
                        <td className="py-2 text-right text-muted-foreground">{row.max}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center gap-3 border-t pt-3">
            <Button size="sm" disabled={saveMarksMutation.isPending || hasExceeded} onClick={() => saveMarksMutation.mutate()}><Save size={15} /> {saveMarksMutation.isPending ? "Saving…" : "Save marks"}</Button>
            <Button size="sm" variant="outline" onClick={() => setBreakdown(editedAutoScore.breakdown.map((r) => ({ ...r })) )}><RotateCcw size={15} /> Reset</Button>
          </div>
        </div>

        <div className="grid gap-2 border-t pt-5">
          <p className="text-sm font-medium">Example marks – {CATEGORY_LABELS[category.categoryType]}</p>
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
          <div className="flex items-baseline justify-between gap-3 border-t pt-2 text-base font-semibold">
            <span>Indicative total</span>
            <span className="font-mono tabular-nums">{editedAutoScore.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} / 100</span>
          </div>
          <p className="text-xs text-muted-foreground">
            This is a baseline estimate calculated from the answers. The interview panel checks original documents and may adjust these marks at the interview.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function MarkAllocationEditor({ applicationId, categories }: { applicationId: string; categories: ApplicationDraft["categories"] }) {
  const queryClient = useQueryClient();

  const existingMarks = useQuery({
    ...orpc.admin.admissions.getMarks.queryOptions({ input: { applicationId } }),
  });

  const autoScores = useMemo(
    () => categories.map((cat) => scoreCategory(cat)),
    [categories],
  );

  const [editorState, setEditorState] = useState<EditableCategory[]>([]);

  const marksMap = useMemo(() => {
    const map = new Map<string, EditableCategory>();
    if (existingMarks.data) {
      for (const mark of existingMarks.data) {
        map.set(mark.categoryType, {
          categoryType: mark.categoryType,
          breakdown: mark.breakdown as EditableBreakdown[],
          total: mark.total,
        });
      }
    }
    return map;
  }, [existingMarks.data]);

  useEffect(() => {
    setEditorState(
      autoScores.map((auto) => {
        const saved = marksMap.get(auto.categoryType);
        if (saved) return { ...saved };
        return {
          categoryType: auto.categoryType,
          breakdown: auto.breakdown.map((row) => ({ ...row })),
          total: auto.total,
        };
      }),
    );
  }, [marksMap, autoScores]);

  const saveMutation = useMutation({
    mutationFn: (cat: EditableCategory) =>
      client.admin.admissions.saveMarks({
        applicationId,
        categoryType: cat.categoryType,
        breakdown: cat.breakdown.map((r) => ({ label: r.label, marks: r.marks, max: r.max })),
        total: cat.total,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orpc.admin.admissions.getMarks.key() });
      toast.success("Marks saved");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save marks"),
  });

  const updateRow = (categoryType: string, rowIndex: number, value: string) => {
    setEditorState((prev) =>
      prev.map((cat) => {
        if (cat.categoryType !== categoryType) return cat;
        const newBreakdown = [...cat.breakdown];
        const numValue = value === "" ? 0 : Number(value);
        newBreakdown[rowIndex] = { ...newBreakdown[rowIndex], marks: Math.max(0, numValue) };
        const total = newBreakdown.reduce((sum, row) => sum + row.marks, 0);
        return { ...cat, breakdown: newBreakdown, total };
      }),
    );
  };

  const resetCategory = (categoryType: string) => {
    const auto = autoScores.find((s) => s.categoryType === categoryType);
    if (!auto) return;
    setEditorState((prev) =>
      prev.map((cat) => {
        if (cat.categoryType !== categoryType) return cat;
        return {
          categoryType: auto.categoryType,
          breakdown: auto.breakdown.map((row) => ({ ...row })),
          total: auto.total,
        };
      }),
    );
  };

  if (categories.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator size={18} className="text-primary" /> Mark allocation
        </CardTitle>
        <CardDescription>Override the auto-calculated marks per category. Admin-entered marks are saved independently.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {existingMarks.isLoading && (
          <p className="text-sm text-muted-foreground">Loading saved marks…</p>
        )}
        {autoScores.map((auto) => {
          const editor = editorState.find((e) => e.categoryType === auto.categoryType);
          if (!editor) return null;
          const label = CATEGORY_LABELS[auto.categoryType] ?? auto.categoryType;
          const hasChanges = editor.breakdown.some((row, i) => row.marks !== auto.breakdown[i]?.marks) || editor.total !== auto.total;
          const hasExceeded = editor.breakdown.some((row) => row.marks > row.max);

          return (
            <section key={auto.categoryType} className="grid gap-3 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{label}</h3>
                  <p className="text-xs text-muted-foreground">
                    Auto: <Badge variant="outline">{auto.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Badge>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hasChanges && <Badge variant="secondary">Modified</Badge>}
                  {hasExceeded && <Badge variant="destructive">Exceeds max</Badge>}
                  <Badge variant={hasChanges ? "default" : "outline"}>
                    Admin total: {editor.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </Badge>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 pr-4">Label</th>
                      <th className="pb-2 pr-4 text-right">Auto</th>
                      <th className="pb-2 pr-4 text-right">Admin</th>
                      <th className="pb-2 text-right">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editor.breakdown.map((row, rowIndex) => {
                      const autoRow = auto.breakdown[rowIndex];
                      const autoMarks = autoRow?.marks ?? 0;
                      const exceedsMax = row.marks > row.max;
                      const matchesAuto = row.marks === autoMarks;
                      let bgClass = "";
                      if (exceedsMax) bgClass = "bg-red-50";
                      else if (!matchesAuto) bgClass = "bg-amber-50";
                      else bgClass = "bg-emerald-50";

                      return (
                        <tr key={rowIndex} className="border-b border-border/50 last:border-b-0">
                          <td className="py-2 pr-4 font-medium">{row.label}</td>
                          <td className="py-2 pr-4 text-right text-muted-foreground">{autoMarks}</td>
                          <td className="py-2 pr-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <Input
                                type="number"
                                min={0}
                                max={row.max}
                                step={0.5}
                                value={row.marks}
                                onChange={(e) => updateRow(editor.categoryType, rowIndex, e.target.value)}
                                className={`h-8 w-20 text-right ${bgClass}`}
                              />
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger render={<button type="button" className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" />}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                                  </TooltipTrigger>
                                  <TooltipContent>Pre-filled: {autoMarks} / {row.max}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </td>
                          <td className="py-2 text-right text-muted-foreground">{row.max}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-3 border-t pt-3">
                <Button
                  size="sm"
                  disabled={saveMutation.isPending || hasExceeded}
                  onClick={() => saveMutation.mutate(editor)}
                >
                  <Save size={15} /> {saveMutation.isPending ? "Saving…" : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resetCategory(editor.categoryType)}
                >
                  <RotateCcw size={15} /> Reset
                </Button>
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}

const STEPS = [
  { label: "Applicant data", icon: User },
  { label: "Location evidence", icon: MapPin },
  { label: "Category scoring", icon: Calculator },
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
  const [reviewSaved, setReviewSaved] = useState(false);

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

  const savedFlagsRef = useRef<string>("[]");

  useEffect(() => {
    if (data) {
      setStatus(data.admissionStatus);
      setNotes(data.interviewNotes);
      setBanned(data.isBanned);
      setBanReason(data.banReason ?? "");
      savedFlagsRef.current = JSON.stringify(data.flags ?? []);
      const hasExistingReview = data.interviewNotes?.trim() || data.flags?.length || data.admissionStatus !== "pending";
      setReviewSaved(hasExistingReview);
    }
  }, [data]);

  const isManualSaveRef = useRef(false);

  useEffect(() => {
    if (!data) return;
    const currentFlags = JSON.stringify(buildFlags());
    if (currentFlags === savedFlagsRef.current) return;
    savedFlagsRef.current = currentFlags;
    isManualSaveRef.current = false;
    reviewMutation.mutate({
      admissionStatus: status,
      interviewNotes: notes.trim(),
      isBanned: banned,
      banReason: banned ? banReason.trim() : undefined,
      flags: buildFlags(),
    });
  }, [flaggedFields, flaggedInputs, flaggedLocations]);

  const reviewMutation = useMutation({
    mutationFn: (input: { admissionStatus: AdmissionStatus; interviewNotes: string; isBanned: boolean; banReason?: string; flags: Array<{ type: string; key: string; label: string }> }) =>
      client.admin.admissions.updateReview({ id, ...input }),
    onSuccess: async () => {
      if (isManualSaveRef.current) {
        setReviewSaved(true);
        isManualSaveRef.current = false;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.admin.admissions.list.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.admin.admissions.get.queryOptions({ input: { id } }).queryKey }),
      ]);
      toast.success("Admissions review saved");
    },
    onError: (error) => {
      isManualSaveRef.current = false;
      toast.error(error instanceof Error ? error.message : "Could not save admissions review");
    },
  });

  const saveReview = (isBanned: boolean = banned) => {
    isManualSaveRef.current = true;
    setReviewSaved(false);
    const flags = [
      ...Array.from(flaggedFields).map((key) => ({ type: "field", key, label: key.replace(/\./g, " ").replace(/([A-Z])/g, " $1").trim() })),
      ...Array.from(flaggedInputs).map((key) => ({ type: "input", key, label: key.replace(/([A-Z])/g, " $1").trim() })),
      ...Array.from(flaggedLocations).map((key) => ({ type: "location", key, label: `Location ${key}` })),
    ];

    reviewMutation.mutate({
      admissionStatus: status,
      interviewNotes: notes.trim(),
      isBanned,
      banReason: isBanned ? banReason.trim() : undefined,
      flags,
    });
  };

  const draftInput = data?.data as Partial<ApplicationDraft> | undefined;
  const draft = normalizeDraft(draftInput);

  const effectiveHomeLocation = useMemo(() => {
    const history = draft.userLocationHistory ?? [];
    const adminEntry = history.find((e) => e.source === "admin");
    const userEntries = history.filter((e) => e.source !== "admin");
    const pin = adminEntry ?? (userEntries.length > 0 ? userEntries[userEntries.length - 1] : null);
    if (!pin || pin.latitude == null || pin.longitude == null) return null;
    return { lat: pin.latitude, lng: pin.longitude };
  }, [draft.userLocationHistory]);

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
        <Link to="/admin/admissions/$id" params={{ id }} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">← Back to categories</Link>
        <Card><CardContent className="flex items-center gap-3 p-8 text-sm text-muted-foreground"><ClipboardCheck className="text-primary" size={18} /> Loading applicant record…</CardContent></Card>
      </main>
    );
  }

  if (detail.error || !data) {
    return (
      <main className="min-h-svh p-6 md:p-10 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
        <Link to="/admin/admissions/$id" params={{ id }} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">← Back to categories</Link>
        <Card className="border-destructive/25"><CardContent className="flex items-start gap-2 p-6 text-sm text-destructive"><ShieldAlert size={17} className="mt-0.5 shrink-0" /> Could not load applicant: {detail.error?.message ?? "Not found"}</CardContent></Card>
      </main>
    );
  }

  const activeCategory = draft.categories.find((cat) => cat.id === categoryId);
  const activeAutoScore = activeCategory ? scoreCategory(activeCategory) : null;

  const lastEditFor = (field: string) => {
    const edits = draft.interviewEdits.filter((e) => e.field === field);
    return edits.length > 0 ? edits[edits.length - 1] : null;
  };

  const openFieldEditor = (config: { label: string; fieldKey: string; section: string; path: string; currentValue: string }) => {
    setEditFieldConfig(config);
    setEditFieldOpen(true);
  };

  return (
    <main className="min-h-svh p-6 md:p-10 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
      <Link to="/admin/admissions/$id" params={{ id }} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">← Back to categories</Link>

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
              <CardContent className="grid gap-1 sm:grid-cols-2">
                <DataRow label="Full name" value={draft.applicant.fullName} fieldKey="fullName" previousValue={lastEditFor("applicant.fullName")?.previousValue} flagged={flaggedFields.has("applicant.fullName")} onFlag={() => toggleFieldFlag("applicant.fullName")} onEdit={() => openFieldEditor({ label: "Full name", fieldKey: "fullName", section: "applicant", path: "fullName", currentValue: draft.applicant.fullName })} />
                <DataRow label="Sinhala name" value={draft.applicant.sinhalaName} fieldKey="sinhalaName" previousValue={lastEditFor("applicant.sinhalaName")?.previousValue} flagged={flaggedFields.has("applicant.sinhalaName")} onFlag={() => toggleFieldFlag("applicant.sinhalaName")} onEdit={() => openFieldEditor({ label: "Sinhala name", fieldKey: "sinhalaName", section: "applicant", path: "sinhalaName", currentValue: draft.applicant.sinhalaName })} />
                <DataRow label="Date of birth" value={draft.applicant.dateOfBirth} fieldKey="dateOfBirth" previousValue={lastEditFor("applicant.dateOfBirth")?.previousValue} flagged={flaggedFields.has("applicant.dateOfBirth")} onFlag={() => toggleFieldFlag("applicant.dateOfBirth")} onEdit={() => openFieldEditor({ label: "Date of birth", fieldKey: "dateOfBirth", section: "applicant", path: "dateOfBirth", currentValue: draft.applicant.dateOfBirth })} />
                <DataRow label="Birth certificate" value={draft.applicant.birthCertificateNumber} fieldKey="birthCertificateNumber" previousValue={lastEditFor("applicant.birthCertificateNumber")?.previousValue} flagged={flaggedFields.has("applicant.birthCertificateNumber")} onFlag={() => toggleFieldFlag("applicant.birthCertificateNumber")} onEdit={() => openFieldEditor({ label: "Birth certificate", fieldKey: "birthCertificateNumber", section: "applicant", path: "birthCertificateNumber", currentValue: draft.applicant.birthCertificateNumber })} />
                <DataRow label="Gender" value={draft.applicant.gender} fieldKey="gender" previousValue={lastEditFor("applicant.gender")?.previousValue} flagged={flaggedFields.has("applicant.gender")} onFlag={() => toggleFieldFlag("applicant.gender")} onEdit={() => openFieldEditor({ label: "Gender", fieldKey: "gender", section: "applicant", path: "gender", currentValue: draft.applicant.gender })} />
                <DataRow label="Religion" value={draft.applicant.religion} fieldKey="religion" previousValue={lastEditFor("applicant.religion")?.previousValue} flagged={flaggedFields.has("applicant.religion")} onFlag={() => toggleFieldFlag("applicant.religion")} onEdit={() => openFieldEditor({ label: "Religion", fieldKey: "religion", section: "applicant", path: "religion", currentValue: draft.applicant.religion })} />
                <DataRow label="Guardian" value={draft.guardian.fullName} fieldKey="guardianFullName" previousValue={lastEditFor("guardian.fullName")?.previousValue} flagged={flaggedFields.has("guardian.fullName")} onFlag={() => toggleFieldFlag("guardian.fullName")} onEdit={() => openFieldEditor({ label: "Guardian name", fieldKey: "guardianFullName", section: "guardian", path: "fullName", currentValue: draft.guardian.fullName })} />
                <DataRow label="Relationship" value={draft.guardian.relationship} fieldKey="relationship" previousValue={lastEditFor("guardian.relationship")?.previousValue} flagged={flaggedFields.has("guardian.relationship")} onFlag={() => toggleFieldFlag("guardian.relationship")} onEdit={() => openFieldEditor({ label: "Relationship", fieldKey: "relationship", section: "guardian", path: "relationship", currentValue: draft.guardian.relationship })} />
                <DataRow label="Guardian NIC" value={draft.guardian.nic} fieldKey="nic" previousValue={lastEditFor("guardian.nic")?.previousValue} flagged={flaggedFields.has("guardian.nic")} onFlag={() => toggleFieldFlag("guardian.nic")} onEdit={() => openFieldEditor({ label: "Guardian NIC", fieldKey: "nic", section: "guardian", path: "nic", currentValue: draft.guardian.nic })} />
                <DataRow label="Phone" value={draft.guardian.phone} fieldKey="phone" previousValue={lastEditFor("guardian.phone")?.previousValue} flagged={flaggedFields.has("guardian.phone")} onFlag={() => toggleFieldFlag("guardian.phone")} onEdit={() => openFieldEditor({ label: "Phone", fieldKey: "phone", section: "guardian", path: "phone", currentValue: draft.guardian.phone })} />
                <DataRow label="Email" value={draft.guardian.email} fieldKey="email" previousValue={lastEditFor("guardian.email")?.previousValue} flagged={flaggedFields.has("guardian.email")} onFlag={() => toggleFieldFlag("guardian.email")} onEdit={() => openFieldEditor({ label: "Email", fieldKey: "email", section: "guardian", path: "email", currentValue: draft.guardian.email })} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Residence and location</CardTitle><CardDescription>Use the submitted address and map point as interview references. Flag suspicious entries.</CardDescription></CardHeader>
              <CardContent className="grid gap-1">
                <DataRow label="Permanent address" value={draft.residence.permanentAddress} fieldKey="permanentAddress" previousValue={lastEditFor("residence.permanentAddress")?.previousValue} flagged={flaggedFields.has("residence.permanentAddress")} onFlag={() => toggleFieldFlag("residence.permanentAddress")} onEdit={() => openFieldEditor({ label: "Permanent address", fieldKey: "permanentAddress", section: "residence", path: "permanentAddress", currentValue: draft.residence.permanentAddress })} />
                <DataRow label="Current address" value={draft.residence.currentAddress} fieldKey="currentAddress" previousValue={lastEditFor("residence.currentAddress")?.previousValue} flagged={flaggedFields.has("residence.currentAddress")} onFlag={() => toggleFieldFlag("residence.currentAddress")} onEdit={() => openFieldEditor({ label: "Current address", fieldKey: "currentAddress", section: "residence", path: "currentAddress", currentValue: draft.residence.currentAddress })} />
                <DataRow label="District" value={draft.residence.district} fieldKey="district" previousValue={lastEditFor("residence.district")?.previousValue} flagged={flaggedFields.has("residence.district")} onFlag={() => toggleFieldFlag("residence.district")} onEdit={() => openFieldEditor({ label: "District", fieldKey: "district", section: "residence", path: "district", currentValue: draft.residence.district })} />
                <DataRow label="DS division" value={draft.residence.dsDivision} fieldKey="dsDivision" previousValue={lastEditFor("residence.dsDivision")?.previousValue} flagged={flaggedFields.has("residence.dsDivision")} onFlag={() => toggleFieldFlag("residence.dsDivision")} onEdit={() => openFieldEditor({ label: "DS division", fieldKey: "dsDivision", section: "residence", path: "dsDivision", currentValue: draft.residence.dsDivision })} />
                <DataRow label="GN division" value={draft.residence.gnDivision} fieldKey="gnDivision" previousValue={lastEditFor("residence.gnDivision")?.previousValue} flagged={flaggedFields.has("residence.gnDivision")} onFlag={() => toggleFieldFlag("residence.gnDivision")} onEdit={() => openFieldEditor({ label: "GN division", fieldKey: "gnDivision", section: "residence", path: "gnDivision", currentValue: draft.residence.gnDivision })} />
                <DataRow label="Electoral district" value={draft.residence.electoralDistrict} fieldKey="electoralDistrict" previousValue={lastEditFor("residence.electoralDistrict")?.previousValue} flagged={flaggedFields.has("residence.electoralDistrict")} onFlag={() => toggleFieldFlag("residence.electoralDistrict")} onEdit={() => openFieldEditor({ label: "Electoral district", fieldKey: "electoralDistrict", section: "residence", path: "electoralDistrict", currentValue: draft.residence.electoralDistrict })} />
              </CardContent>
            </Card>
          </div>
          {(flaggedFields.size > 0) && (
            <Card className="border-red-200 bg-red-50/30">
              <CardHeader><CardTitle className="text-red-700 flex items-center gap-2"><Flag size={16} /> Flagged fields ({flaggedFields.size})</CardTitle><CardDescription>Fields marked as suspicious during review.</CardDescription></CardHeader>
              <CardContent className="grid gap-1">
                {Array.from(flaggedFields).map((fieldKey) => {
                  const label = fieldKey.startsWith("applicant.") ? fieldKey.replace("applicant.", "") : fieldKey.startsWith("guardian.") ? fieldKey.replace("guardian.", "") : fieldKey.startsWith("residence.") ? fieldKey.replace("residence.", "") : fieldKey;
                  return (
                    <div key={fieldKey} className="flex items-center justify-between py-2 border-b border-red-200/50 last:border-b-0">
                      <span className="text-sm capitalize">{label.replace(/([A-Z])/g, " $1")}</span>
                      <Button size="sm" variant="ghost" onClick={() => toggleFieldFlag(fieldKey)} className="text-red-600 hover:text-red-700"><X size={14} /> Remove flag</Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
          {draft.interviewEdits.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Interview edit history</CardTitle><CardDescription>Previous and new values for fields edited during this interview.</CardDescription></CardHeader>
              <CardContent className="grid gap-2">
                {[...draft.interviewEdits].reverse().map((edit, idx) => (
                  <div key={idx} className="flex items-start gap-3 rounded-lg border p-3">
                    <Pencil size={14} className="mt-0.5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold">{edit.label}</span>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded bg-muted px-1.5 py-0.5 line-through text-muted-foreground">{edit.previousValue || "(empty)"}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">{edit.newValue || "(empty)"}</span>
                      </div>
                      <span className="mt-1 block text-[0.65rem] text-muted-foreground">{new Date(edit.editedAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
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

        {activeStep === 2 && activeCategory && (
          <CategoryScoringCard applicationId={data.id} category={activeCategory} autoScore={activeAutoScore} draft={draft} flaggedInputs={flaggedInputs} onToggleInputFlag={toggleInputFlag} homeLocation={effectiveHomeLocation} onSaveInterviewEdits={(edits) => interviewEditsMutation.mutate({ interviewEdits: edits })} />
        )}

        {activeStep === 2 && !activeCategory && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No category data found for this entry.</CardContent></Card>
        )}

        {activeStep === 3 && (
          <Card className="border-primary/20">
            <CardHeader><CardTitle>Interview decision & flagging</CardTitle><CardDescription>Record the review outcome and flag or ban the applicant if needed.</CardDescription></CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-2 sm:max-w-sm">
                <label htmlFor="admission-status" className="text-sm font-semibold">Review status</label>
                <Select value={status} onValueChange={(value) => setStatus((value ?? "pending") as AdmissionStatus)}>
                  <SelectTrigger id="admission-status" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending review</SelectItem>
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
                        <span className="text-muted-foreground line-through">{edit.previousValue || "(empty)"}</span>
                        <span className="text-blue-600">{edit.newValue || "(empty)"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <label htmlFor="interview-notes" className="text-sm font-semibold">Interview notes</label>
                <Textarea id="interview-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Record what was checked and any follow-up needed…" rows={5} maxLength={5000} />
                <span className="text-xs text-muted-foreground">{notes.length.toLocaleString()} / 5,000 characters</span>
              </div>
              {banned && <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive"><Ban size={16} className="mt-0.5 shrink-0" /><span><strong>Applicant banned.</strong> {banReason || "No reason recorded."}</span></div>}
              {reviewMutation.error && <p className="text-sm text-destructive" role="alert">{reviewMutation.error instanceof Error ? reviewMutation.error.message : "Could not save review"}</p>}
              <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                <Button disabled={reviewMutation.isPending} onClick={() => saveReview()}><Check size={17} /> {reviewMutation.isPending ? "Saving…" : reviewSaved ? "Update review" : "Save review"}</Button>
                {banned ? (
                  <Button variant="secondary" disabled={reviewMutation.isPending} onClick={() => { setBanned(false); saveReview(false); }}><X size={17} /> Remove ban</Button>
                ) : (
                  <Button variant="destructive" disabled={reviewMutation.isPending} onClick={() => setBanDialogOpen(true)}><Ban size={17} /> Ban applicant</Button>
                )}
                <Button variant="outline" render={<Link to="/admin/applications/$id" params={{ id: data.id }} search={{ mode: "edit" }} />}><Edit3 size={17} /> Edit application</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="outline" disabled={activeStep === 0} onClick={() => setActiveStep((s) => Math.max(0, s - 1))}>← Previous</Button>
          <span className="text-sm text-muted-foreground">Step {activeStep + 1} of {STEPS.length}</span>
          <Button variant="outline" disabled={activeStep === STEPS.length - 1} onClick={() => setActiveStep((s) => Math.min(STEPS.length - 1, s + 1))}>Next →</Button>
        </div>

        <BanDialog open={banDialogOpen} onOpenChange={setBanDialogOpen} applicantName={data.applicantName} reason={banReason} onReasonChange={setBanReason} pending={reviewMutation.isPending} onConfirm={() => { setBanned(true); setBanDialogOpen(false); saveReview(true); }} />
      </div>
    </main>
  );
}
