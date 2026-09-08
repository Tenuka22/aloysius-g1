import { useEffect, useMemo, useState, lazy } from "react";
import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ExternalLink, Globe, MapPin, MapPinned, Save, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@aloysius-admissions/ui/components/badge";
import { Button } from "@aloysius-admissions/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aloysius-admissions/ui/components/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@aloysius-admissions/ui/components/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@aloysius-admissions/ui/components/alert-dialog";
import { Input } from "@aloysius-admissions/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aloysius-admissions/ui/components/select";
import { client } from "@/utils/orpc";
import { getSchools, refreshSchoolCoordinateOverrides, schoolCoordinateOverride, schoolsWithCoordinates } from "@/lib/g1/school-coordinates";
import type { School } from "@/lib/g1/schools";
import { toast } from "sonner";
import { cn } from "@aloysius-admissions/ui/lib/utils";
const SchoolMap = lazy(() => import("@/components/g1/admin/schools-map"));

export const Route = createFileRoute("/_auth/g1/admin/schools")({
  loader: async () => {
    await refreshSchoolCoordinateOverrides();
  },
  component: AdminSchoolsPage,
});

const GALLE_CENTER: [number, number] = [6.055, 80.211];

type Filter = "missing" | "located" | "manual" | "all";

function prettySlug(value: string): string {
  return value.replace(/[-_]+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase()) || "Galle";
}

function searchLinks(school: School) {
  const place = `${school.en} ${prettySlug(school.dsId)} Galle, Sri Lanka`;
  const encoded = encodeURIComponent(place);
  return {
    maps: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    earth: `https://earth.google.com/web/search/${encoded}`,
    web: `https://www.google.com/search?q=${encodeURIComponent(`${school.en} ${prettySlug(school.dsId)} Galle school`)}`,
  };
}







type CoordinateDialogState = {
  school: School;
  lat: number;
  lng: number;
  note: string;
} | null;

function SetCoordinatesDialog({ state, onClose, onSaved }: { state: CoordinateDialogState; onClose: () => void; onSaved: () => void }) {
  const [lat, setLat] = useState<number>(GALLE_CENTER[0]);
  const [lng, setLng] = useState<number>(GALLE_CENTER[1]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!state) return;
    setLat(state.lat);
    setLng(state.lng);
    setNote(state.note);
  }, [state]);

  if (!state) return null;

  const links = searchLinks(state.school);

  const saveMutation = useMutation({
    mutationFn: () => client.admin.schools.save({
      id: state.school.id,
      name: state.school.en,
      latitude: lat,
      longitude: lng,
      note,
    }),
    onSuccess: () => {
      toast.success(`Saved coordinates for ${state.school.en}`);
      onSaved();
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save coordinates");
    },
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MapPinned size={19} /> Set coordinates - {state.school.en}</DialogTitle>
          <DialogDescription>
            Click on the map or type coordinates. Use the search links below to find the school on Google Maps / Earth first, then pin it here.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" render={<a href={links.maps} target="_blank" rel="noopener noreferrer" />} nativeButton={false}><MapPin size={15} /> Search Google Maps</Button>
              <Button type="button" variant="secondary" size="sm" render={<a href={links.earth} target="_blank" rel="noopener noreferrer" />} nativeButton={false}><Globe size={15} /> Search Google Earth</Button>
              <Button type="button" variant="ghost" size="sm" render={<a href={links.web} target="_blank" rel="noopener noreferrer" />} nativeButton={false}><ExternalLink size={15} /> Google</Button>
            </div>
            <div className="relative overflow-hidden rounded-xl border">
              <ClientOnly fallback={<div className="h-[360px] w-full" />}>
                <SchoolMap lat={lat} lng={lng} onPick={(nextLat, nextLng) => { setLat(nextLat); setLng(nextLng); }} />
              </ClientOnly>
            </div>
          </div>

          <div className="grid content-start gap-3">
            <div className="grid gap-1">
              <label htmlFor="school-lat" className="text-xs font-semibold text-muted-foreground">Latitude</label>
              <Input id="school-lat" type="number" step="any" value={Number.isFinite(lat) ? String(lat) : ""} onChange={(e) => setLat(Number(e.target.value))} className="font-mono" placeholder="6.030000" />
            </div>
            <div className="grid gap-1">
              <label htmlFor="school-lng" className="text-xs font-semibold text-muted-foreground">Longitude</label>
              <Input id="school-lng" type="number" step="any" value={Number.isFinite(lng) ? String(lng) : ""} onChange={(e) => setLng(Number(e.target.value))} className="font-mono" placeholder="80.220000" />
            </div>
            <div className="grid gap-1">
              <label htmlFor="school-note" className="text-xs font-semibold text-muted-foreground">Note (optional)</label>
              <Input id="school-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. from Google Earth satellite pin" />
            </div>
            <p className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
              Tip: open the Google Maps search link, right-click the exact school location and copy the coordinates, or read them from the maps URL (<code className="font-mono">…!3d6.03!4d80.21…</code>).
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}><Save size={16} /> {saveMutation.isPending ? "Saving…" : "Save coordinates"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminSchoolsPage() {
  const [filter, setFilter] = useState<Filter>("missing");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<CoordinateDialogState>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [, setTick] = useState(0);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const [seedMode, setSeedMode] = useState<"add" | "upsert">("add");

  const bump = () => setTick((tick) => tick + 1);

  const schools = getSchools();
  const located = schoolsWithCoordinates().length;

  const removeMutation = useMutation({
    mutationFn: (schoolId: string) => client.admin.schools.remove({ id: schoolId }),
    onSuccess: () => {
      toast.success("Manual coordinates removed");
      void refreshSchoolCoordinateOverrides().then(bump);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not remove coordinates");
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => client.admin.schools.clear(),
    onSuccess: () => {
      toast.success("All school coordinates cleared");
      void refreshSchoolCoordinateOverrides().then(bump);
      setClearDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not clear coordinates");
    },
  });

  const seedMutation = useMutation({
    mutationFn: (mode: "add" | "upsert") => client.admin.schools.seedFromScraper({ mode }),
    onSuccess: (result) => {
      const msg = `Seeded ${result.added} new schools` + (result.skipped ? `, skipped ${result.skipped} existing` : "") + (result.updated ? `, updated ${result.updated}` : "");
      toast.success(msg);
      void refreshSchoolCoordinateOverrides().then(bump);
      setSeedDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not seed schools");
    },
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return schools
      .map((school) => {
        const override = schoolCoordinateOverride(school.id);
        const hasCoords = school.lat !== null && school.lng !== null;
        const status = override ? "manual" : hasCoords ? "located" : "missing";
        return { school, override, status };
      })
      .filter(({ school, status }) => {
        if (filter === "missing" && status !== "missing") return false;
        if (filter === "located" && status !== "located") return false;
        if (filter === "manual" && status !== "manual") return false;
        if (q && !`${school.en} ${school.id} ${school.dsId}`.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [schools, filter, query]);

  useEffect(() => { setPage(0); }, [filter, query]);

  const totalPages = Math.ceil(rows.length / pageSize);
  const paginatedRows = rows.slice(page * pageSize, (page + 1) * pageSize);

  const openEditor = (school: School) => {
    const override = schoolCoordinateOverride(school.id);
    const lat = override?.lat ?? (school.lat ?? GALLE_CENTER[0]);
    const lng = override?.lng ?? (school.lng ?? GALLE_CENTER[1]);
    setEditing({ school, lat, lng, note: override?.note ?? "" });
  };

  const clearOverride = (school: School) => {
    if (!window.confirm(`Remove the manual coordinates for ${school.en}?`)) return;
    removeMutation.mutate(school.id);
  };

  const countBadge = (f: Filter) => {
    if (f === "missing") return schools.filter((s) => s.lat === null && !schoolCoordinateOverride(s.id)).length;
    if (f === "manual") return schools.filter((s) => schoolCoordinateOverride(s.id) !== undefined).length;
    if (f === "located") return located;
    return schools.length;
  };

  const tabs: Array<{ id: Filter; label: string }> = [
    { id: "missing", label: "Missing coordinates" },
    { id: "located", label: "Located" },
    { id: "manual", label: "Manual" },
    { id: "all", label: "All schools" },
  ];

  return (
    <main className="min-h-svh p-12.5 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
      <div className="flex items-end justify-between gap-8 mb-8">
        <div>
          <p className="text-primary font-bold tracking-widest uppercase text-xs">Workspace / Schools</p>
          <h1 className="font-heading text-[clamp(2rem,4vw,3.6rem)] mt-1 mb-3">Schools hub</h1>
          <p className="text-muted-foreground max-w-[70ch]">
            Every Galle government school needs coordinates for distance scoring and map views. Schools the scraper could not pin down are listed first - find them via Google Maps / Earth and set the pin manually. Manual coordinates are stored in the database and shared everywhere.
          </p>
        </div>
        <Button variant="secondary" render={<Link to="/g1/admin/admin_map" />}><MapPin size={17} /> Open map view</Button>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bulk actions</CardTitle>
          <CardDescription>Seed or reset school coordinates from the map scraper output.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="destructive" size="sm" onClick={() => setClearDialogOpen(true)}><Trash2 size={15} /> Clear all schools</Button>
          <Button variant="secondary" size="sm" onClick={() => { setSeedMode("add"); setSeedDialogOpen(true); }}><Globe size={15} /> Seed from scraper (add only)</Button>
          <Button variant="default" size="sm" onClick={() => { setSeedMode("upsert"); setSeedDialogOpen(true); }}><MapPinned size={15} /> Clear &amp; seed from scraper</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card><CardContent className="pt-6"><p className="text-muted-foreground text-xs">Total schools</p><strong className="text-[1.8rem]">{schools.length}</strong></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-muted-foreground text-xs">With coordinates</p><strong className="text-[1.8rem] text-emerald-600">{located}</strong></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-muted-foreground text-xs">Missing</p><strong className="text-[1.8rem] text-amber-600">{countBadge("missing")}</strong></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-muted-foreground text-xs">Manual overrides</p><strong className="text-[1.8rem] text-sky-600">{countBadge("manual")}</strong></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">School coordinates</CardTitle>
          <CardDescription>Select a school to pin it. Manual pins override scraped coordinates until removed.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1.5">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                      filter === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {tab.label} <span className="opacity-70">({countBadge(tab.id)})</span>
                  </button>
                ))}
              </div>
              {query && <span className="text-xs text-muted-foreground">{rows.length} result{rows.length !== 1 ? "s" : ""}</span>}
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search by name, id, or division…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 w-full max-w-xs"
              />
              <Select value={String(pageSize)} onValueChange={(v) => { if (v) { setPageSize(Number(v)); setPage(0); } }}>
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1">
            {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No schools match this view.</p>}
            {paginatedRows.map(({ school, override, status }) => {
              const links = searchLinks(school);
              return (
                <div key={school.id} className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{school.en}</span>{" "}
                    {status === "manual" && <Badge variant="secondary" className="align-middle text-[0.65rem] text-sky-600">Manual</Badge>}
                    {status === "located" && <Badge variant="outline" className="align-middle text-[0.65rem] text-emerald-600">Located</Badge>}
                    {status === "missing" && <Badge variant="destructive" className="align-middle text-[0.65rem]">Missing</Badge>}
                    <div className="text-xs text-muted-foreground">
                      <code className="font-mono">{school.id}</code> · {prettySlug(school.dsId)} · {school.genderType}/{school.schoolType}
                      {status === "located" && school.lat != null && <> · <code className="font-mono">{school.lat.toFixed(5)}, {school.lng?.toFixed(5)}</code></>}
                      {override?.note && <> · note: {override.note}</>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button type="button" variant="ghost" size="sm" render={<a href={links.maps} target="_blank" rel="noopener noreferrer" title="Search on Google Maps" />} nativeButton={false}><MapPin size={14} /> Maps</Button>
                    <Button type="button" variant="ghost" size="sm" render={<a href={links.earth} target="_blank" rel="noopener noreferrer" title="Search on Google Earth" />} nativeButton={false}><Globe size={14} /> Earth</Button>
                    {status === "manual" ? (
                      <>
                        <Button type="button" variant="secondary" size="sm" onClick={() => openEditor(school)}>Edit</Button>
                        <Button type="button" variant="ghost" size="icon" title="Remove manual coordinates" onClick={() => void clearOverride(school)} className="hover:text-destructive"><Trash2 size={15} /></Button>
                      </>
                    ) : (
                      <Button type="button" variant="secondary" size="sm" onClick={() => openEditor(school)}>
                        <MapPinned size={15} /> {status === "missing" ? "Set coordinates" : "Adjust"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages} · {rows.length} school{rows.length !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft size={14} /> Prev
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                  const pageNum = start + i;
                  if (pageNum >= totalPages) return null;
                  return (
                    <Button
                      key={pageNum}
                      type="button"
                      variant={pageNum === page ? "default" : "outline"}
                      size="sm"
                      className="min-w-[2rem] px-1"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum + 1}
                    </Button>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  Next <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <SetCoordinatesDialog
        state={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { void refreshSchoolCoordinateOverrides().then(bump); }}
      />

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all school coordinates?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove every manual coordinate override from the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => clearMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {clearMutation.isPending ? "Clearing…" : "Clear all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={seedDialogOpen} onOpenChange={setSeedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{seedMode === "upsert" ? "Clear & seed from scraper?" : "Seed from scraper?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {seedMode === "upsert"
                ? "This will clear all existing overrides and replace them with coordinates from the scraper JSON."
                : "This will add coordinates from the scraper JSON for schools that don't already have an override. Existing manual coordinates are preserved."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => seedMutation.mutate(seedMode)}>
              {seedMutation.isPending ? "Seeding…" : seedMode === "upsert" ? "Clear & seed" : "Seed (add only)"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
