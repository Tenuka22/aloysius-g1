import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, Outlet, useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, ClipboardCheck, Database, FileWarning, KeyRound, LayoutDashboard, ListOrdered, MapPin, MapPinned, Minus, Plus, QrCode, ShieldCheck, Trash2, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { consumeEventIterator } from "@orpc/client";
import { cn } from "@aloysius-g1/ui/lib/utils";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@aloysius-g1/ui/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@aloysius-g1/ui/components/card";
import { Button } from "@aloysius-g1/ui/components/button";
import { Badge } from "@aloysius-g1/ui/components/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@aloysius-g1/ui/components/popover";
import { Calendar } from "@aloysius-g1/ui/components/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aloysius-g1/ui/components/select";
import { client, orpc } from "@/utils/orpc";
import { toast } from "sonner";
import { AccessKeyQrDialog } from "@/components/application/access-key-qr";
import { intakeYearOptions, intakeYearSearchSchema } from "@/lib/intake-year";

export const Route = createFileRoute("/_auth/admin")({
  validateSearch: intakeYearSearchSchema,
  loaderDeps: ({ search }) => ({ intakeYear: search.intakeYear }),
  loader: async ({ context, deps }) => {
    const { intakeYear } = deps;
    await Promise.all([
      context.queryClient.prefetchQuery(context.orpc.admin.overview.queryOptions({ input: { intakeYear } })),
      context.queryClient.prefetchQuery(context.orpc.admin.applications.queryOptions({ input: { page: 1, pageSize: 50, query: "", intakeYear } })),
      context.queryClient.prefetchQuery(context.orpc.admin.settings.get.queryOptions({ input: { intakeYear } })),
    ]);
  },
  component: AdminPage,
});

function YearStepper({ value, onChange }: { value: string; onChange: (y: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const num = Number(value) || new Date().getFullYear();

  const bump = useCallback((delta: number) => {
    onChange(String(num + delta));
  }, [num, onChange]);

  return (
    <div className="flex items-center gap-1 w-full">
      <Button variant="outline" size="icon" className="h-10.5 w-10.5 shrink-0" onClick={() => bump(-1)}>
        <Minus size={16} />
      </Button>
      <input
        ref={inputRef}
        type="number"
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9]/g, "");
          if (v.length <= 4) onChange(v);
        }}
        onBlur={() => { if (!inputRef.current?.value) onChange(String(num)); }}
        className="h-10.5 flex-1 min-w-0 rounded-lg border border-input bg-background px-3 text-center text-sm font-semibold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <Button variant="outline" size="icon" className="h-10.5 w-10.5 shrink-0" onClick={() => bump(1)}>
        <Plus size={16} />
      </Button>
    </div>
  );
}

function AdminPage() {
  const { session } = Route.useRouteContext();
  const location = useLocation();
  const navigate = useNavigate({ from: "/admin" });
  const queryClient = useQueryClient();
  const search = useSearch({ from: Route.id });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const intakeYear = search.intakeYear;

  const adminHref = useCallback((path: string) => `${path}?intakeYear=${encodeURIComponent(intakeYear)}`, [intakeYear]);

  const handleYearChange = useCallback((year: string) => {
    void navigate({ search: { intakeYear: year } });
  }, [navigate]);

  const overview = useQuery(orpc.admin.overview.queryOptions({ input: { intakeYear } }));
  const applications = useQuery(orpc.admin.applications.queryOptions({ input: { page: 1, pageSize: 50, query: "", intakeYear } }));
  const settings = useQuery(orpc.admin.settings.get.queryOptions({ input: { intakeYear } }));
  useEffect(() => {
    if (session.data?.user.role !== "admin") return;
    const controller = new AbortController();
    const cancel = consumeEventIterator(client.application.liveCount(undefined, { signal: controller.signal }), {
      onEvent: () => { void overview.refetch(); void applications.refetch(); },
      onError: () => undefined,
    });
    return () => { controller.abort(); cancel(); };
  }, [session.data?.user.role]);

  if (session.data?.user.role !== "admin") {
    return (
      <main className="grid place-items-center min-h-svh p-6">
        <Card className="w-full max-w-md gap-5 p-8">
          <div className="grid place-items-center w-13 h-13 rounded-xl text-primary bg-primary/10"><ShieldCheck size={28} /></div>
          <CardHeader className="p-0">
            <CardTitle className="font-heading text-[clamp(1.8rem,4vw,2.5rem)]">Admin access required</CardTitle>
            <CardDescription className="leading-relaxed">Your account is signed in, but it does not have permission to view the operations dashboard.</CardDescription>
          </CardHeader>
          <Button variant="default" className="w-fit" render={<Link to="/dashboard" />}><ArrowLeft size={17} /> Back to dashboard</Button>
        </Card>
      </main>
    );
  }

  const metrics = [
    ["Applications", overview.data?.total ?? "...", ShieldCheck],
    ["Drafts", overview.data?.drafts ?? "...", FileWarning],
    ["Submitted", overview.data?.submitted ?? "...", CheckCircle2],
    ["Incomplete", overview.data?.incomplete ?? "...", AlertTriangle],
    ["Invalid emails", overview.data?.invalidEmail ?? "...", AlertTriangle],
  ] as const;

  const sidebarNav = <>
    <SidebarHeader>
      <div className="flex items-center gap-2.5">
            <div className="grid place-items-center w-9 h-9 rounded-lg text-primary-foreground bg-primary"><ShieldCheck size={24} /></div>
        <div className="flex-1 min-w-0">
          <strong className="block">G1 Intake</strong>
          <span className="block text-muted-foreground text-xs mt-0.5">Admin console</span>
        </div>
      </div>
      <div className="px-1 pt-1">
        <label className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-1 block">Intake year</label>
        <Select value={intakeYear} onValueChange={handleYearChange}>
          <SelectTrigger className="h-8 text-xs w-full">
            <SelectValue placeholder="Select year" />
          </SelectTrigger>
          <SelectContent>
            {intakeYearOptions().map((y) => (
              <SelectItem key={y} value={y}>Grade 1 — {y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Intake year = current year + 1</p>
      </div>
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Workspace</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/admin")} isActive={location.pathname === "/admin"} onClick={() => setSidebarOpen(false)}><LayoutDashboard size={20} /> Overview</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/admin/applications")} isActive={location.pathname.startsWith("/admin/applications")} onClick={() => setSidebarOpen(false)}><BarChart3 size={20} /> Applications</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/admin/admissions")} isActive={location.pathname.startsWith("/admin/admissions")} onClick={() => setSidebarOpen(false)}><ClipboardCheck size={20} /> Admissions</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/admin/schools")} isActive={location.pathname === "/admin/schools"} onClick={() => setSidebarOpen(false)}><MapPinned size={20} /> Schools hub</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/admin/admin_map")} isActive={location.pathname === "/admin/admin_map"} onClick={() => setSidebarOpen(false)}><MapPin size={20} /> Map view</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/admin/mark-allocation")} isActive={location.pathname === "/admin/mark-allocation"} onClick={() => setSidebarOpen(false)}><ListOrdered size={20} /> Mark allocation</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/admin/data-extraction")} isActive={location.pathname === "/admin/data-extraction"} onClick={() => setSidebarOpen(false)}><Database size={20} /> Data extraction</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/admin/requests")} isActive={location.pathname === "/admin/requests"} onClick={() => setSidebarOpen(false)}><FileWarning size={20} /> Submission requests</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/admin/removal-requests")} isActive={location.pathname === "/admin/removal-requests"} onClick={() => setSidebarOpen(false)}><Trash2 size={20} /> Removal requests</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/admin/forgot-requests")} isActive={location.pathname === "/admin/forgot-requests"} onClick={() => setSidebarOpen(false)}><KeyRound size={20} /> Forgot key requests</SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <Link className="flex items-center gap-2.5 min-h-10 px-2.5 rounded-lg text-muted-foreground text-sm no-underline hover:text-foreground hover:bg-muted transition-colors" to="/dashboard">
        <ArrowLeft size={18} /> Back to dashboard
      </Link>
    </SidebarFooter>
  </>;

  return (
    <SidebarProvider>
      <Sidebar>{sidebarNav}</Sidebar>
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-xs md:hidden" onClick={() => setSidebarOpen(false)} />}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200 md:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          className="absolute top-3 right-3 p-1 rounded-md hover:bg-sidebar-accent text-sidebar-foreground z-50"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
        {sidebarNav}
      </div>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger onClick={() => setSidebarOpen(!sidebarOpen)} />
          <span className="text-sm font-medium">Admin console</span>
        </header>
        {location.pathname === "/admin" && (
          <main className="min-h-svh p-12.5 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
            <div className="flex items-end justify-between gap-8 mb-8">
              <div>
                <p className="text-primary font-bold tracking-widest uppercase text-xs">Operations</p>
                <h1 className="font-heading text-[clamp(2rem,4vw,3.6rem)] mt-1 mb-3">G1 application control room</h1>
                <p className="text-muted-foreground">Monitor saved applications, data quality, and submission progress.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-primary text-sm font-semibold">
                <span className="w-2 h-2 rounded-full bg-current shadow-[0_0_0_0.2rem_color-mix(in_oklch,currentColor_15%,transparent)]" /> Live via SSE
              </span>
            </div>
            {overview.error && (
              <Card className="flex items-center gap-2 text-destructive mb-4">
                <AlertTriangle size={18} /> Could not load admin metrics: {overview.error.message}
              </Card>
            )}
            <div className="grid grid-cols-5 gap-3 mb-4">
              {metrics.map(([label, value, Icon]) => (
                <div className="grid gap-1 p-4 border rounded-[14px] bg-card shadow-[0_10px_30px_color-mix(in_oklch,var(--foreground)_5%,transparent)]" key={label}>
                  <Icon size={18} className="text-primary" />
                  <span className="text-muted-foreground text-xs">{label}</span>
                  <strong className="text-[1.8rem]">{value}</strong>
                </div>
              ))}
            </div>
            <FormWindowSettings intakeYear={intakeYear} />
            <Card className="mb-4">
              <CardHeader><CardTitle>Application requests</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Review and act on access, removal, and late submission requests from applicants.</p>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="secondary" render={<Link to="/admin/requests" search={true} />}>Submission requests</Button>
                  <Button variant="secondary" render={<Link to="/admin/removal-requests" search={true} />}>Removal requests</Button>
                  <Button variant="secondary" render={<Link to="/admin/forgot-requests" search={true} />}>Forgot key requests</Button>
                </div>
              </CardContent>
            </Card>
            <Card className="mb-4">
              <CardHeader><CardTitle>Admissions</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Open one submitted application at a time for interview review, corrections, and admissions decisions.</p>
                <Button variant="secondary" render={<Link to="/admin/admissions" search={true} />}><ClipboardCheck size={17} /> Open admissions</Button>
              </CardContent>
            </Card>
            <Card className="mb-4">
              <CardHeader><CardTitle>School coordinates</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Schools missing coordinates from the Google Maps scrape can be pinned manually using Google Maps / Earth lookups. Stored in the database and shared across deployments.</p>
                <Button variant="secondary" render={<Link to="/admin/schools" search={true} />}><MapPinned size={17} /> Open schools hub</Button>
              </CardContent>
            </Card>
            <Card className="mb-4">
              <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-1">
                  {overview.data?.recent.map((item) => (
                    <div className="grid gap-0.5 py-2 border-b border-border last:border-b-0" key={item.id}>
                      <span className="font-medium">{item.applicantName}</span>
                      <small className="text-muted-foreground text-xs">{item.status} · updated {new Date(item.updatedAt).toLocaleString()}</small>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </main>
        )}
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}

function DateTimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : undefined;
  const hours = date ? String(date.getHours()).padStart(2, "0") : "00";
  const minutes = date ? String(date.getMinutes()).padStart(2, "0") : "00";

  const setTime = (h: string, m: string) => {
    if (!date) return;
    const d = new Date(date);
    d.setHours(Number(h), Number(m));
    onChange(d.toISOString().slice(0, 16));
  };

  const display = date
    ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + " · " + date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : "Select date & time";

  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground text-xs font-semibold">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="flex min-h-10.5 items-center gap-2 px-3 rounded-lg border border-input bg-background text-foreground text-sm cursor-pointer"
        >
          <span className={date ? "" : "text-muted-foreground"}>{display}</span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(day) => {
              if (!day) return;
              day.setHours(Number(hours), Number(minutes));
              onChange(day.toISOString().slice(0, 16));
            }}
          />
          <div className="flex items-center gap-2 border-t px-4 py-3">
            <select
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
              value={hours}
              onChange={(e) => setTime(e.target.value, minutes)}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={String(i).padStart(2, "0")}>{String(i).padStart(2, "0")}</option>
              ))}
            </select>
            <span className="text-muted-foreground">:</span>
            <select
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
              value={minutes}
              onChange={(e) => setTime(hours, e.target.value)}
            >
              {["00", "15", "30", "45"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FormWindowSettings({ intakeYear }: { intakeYear: string }) {
  const queryClient = useQueryClient();
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [selectedYear, setSelectedYear] = useState(intakeYear);
  const yearSettings = useQuery(orpc.admin.settings.get.queryOptions({ input: { intakeYear: selectedYear } }));

  useEffect(() => {
    if (yearSettings.data) {
      setOpensAt(yearSettings.data.opensAt.toISOString().slice(0, 16));
      setClosesAt(yearSettings.data.closesAt.toISOString().slice(0, 16));
    } else if (yearSettings.isFetched && !yearSettings.data) {
      setOpensAt("");
      setClosesAt("");
    }
  }, [yearSettings.data, yearSettings.isFetched]);

  const windowStatus = yearSettings.data
    ? (() => {
        const now = Date.now();
        if (now < yearSettings.data.opensAt.getTime()) return { label: "Configured — opens later", className: "text-amber-600" };
        if (now > yearSettings.data.closesAt.getTime()) return { label: "Configured — window closed", className: "text-muted-foreground" };
        return { label: "Configured — open now", className: "text-emerald-600" };
      })()
    : null;

  const saveMutation = useMutation({
    mutationFn: () => client.admin.settings.update({ opensAt: new Date(opensAt), closesAt: new Date(closesAt), intakeYear: selectedYear }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.admin.settings.get.queryKey({ input: { intakeYear: selectedYear } }) });
      toast.success("Form window saved");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save form window");
    },
  });

  return (
    <Card className="mb-4">
      <CardContent className="grid gap-4">
        <div>
          <CardHeader className="p-0"><CardTitle>Form availability</CardTitle></CardHeader>
          <CardDescription>Choose when applicants can submit the form for a specific intake year.</CardDescription>
        </div>
        <div className="grid grid-cols-3 gap-4 items-start">
          <div className="grid gap-1">
            <span className="text-muted-foreground text-xs font-semibold">Intake year</span>
            <YearStepper value={selectedYear} onChange={setSelectedYear} />
            {windowStatus
              ? <span className={`text-[10px] font-medium ${windowStatus.className}`}>{windowStatus.label}</span>
              : <span className="text-[10px] text-muted-foreground">Not configured — set dates to enable</span>
            }
          </div>
          <DateTimePicker value={opensAt} onChange={setOpensAt} label="Opens" />
          <DateTimePicker value={closesAt} onChange={setClosesAt} label="Closes" />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="default" type="button" disabled={saveMutation.isPending || !opensAt || !closesAt} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving…" : "Save form window"}
          </Button>
          {saveMutation.isError && <p className="text-destructive text-sm" role="status">{saveMutation.error.message}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function AccessRequestQueue({ requests, onRefresh }: { requests: Array<{ id: string; applicantName: string; guardianName?: string; contactEmail: string; contactPhone?: string | null; birthCertificateNumber: string; requestType: string; createdAt: Date }>; onRefresh: () => void }) {
  const [generatedKey, setGeneratedKey] = useState("");
  const [qrKey, setQrKey] = useState("");

  const rotateMutation = useMutation({
    mutationFn: (requestId: string) => client.admin.accessRequests.rotateKey({ requestId }),
    onSuccess: (result) => {
      setGeneratedKey(result.accessKey);
      setQrKey(result.accessKey);
      toast.success("New key generated. Share it securely with the verified applicant.");
      onRefresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not generate key"),
  });

  const removeMutation = useMutation({
    mutationFn: (requestId: string) => client.admin.accessRequests.deleteAfterRemovalRequest({ requestId }),
    onSuccess: () => {
      toast.success("The application was deleted after review.");
      onRefresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete the application"),
  });

  const dismissMutation = useMutation({
    mutationFn: (requestId: string) => client.admin.accessRequests.dismiss({ requestId }),
    onSuccess: () => onRefresh(),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not dismiss request"),
  });

  return (
    <Card className="mb-4">
      <CardContent className="grid gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <CardHeader className="p-0"><CardTitle>Application requests</CardTitle></CardHeader>
            <CardDescription>Access requests generate keys. Removal requests require school review before deletion.</CardDescription>
          </div>
          <Badge variant="secondary">{requests.length} open</Badge>
        </div>
        {generatedKey && (
          <div className="grid gap-1 p-4 border rounded-[10px] border-primary/35 bg-primary/7">
            <strong className="font-semibold text-sm">One-time display</strong>
            <code className="text-[1.1rem] font-bold break-all">{generatedKey}</code>
            <span className="text-muted-foreground text-xs">Copy this key now; it will not be shown again.</span>
            <Button variant="secondary" type="button" onClick={() => setQrKey(generatedKey)}><QrCode size={16} /> Show QR code</Button>
          </div>
        )}
        {requests.length === 0
          ? <p className="text-muted-foreground text-sm">No open application requests.</p>
          : (
            <div className="grid gap-1">
              {requests.map((request) => {
                const isRemoval = request.requestType === "removal";
                return (
                  <div className="flex items-center justify-between gap-4 py-3 border-b border-border" key={request.id}>
                    <div className="grid gap-0.5">
                      <strong className="font-semibold">{isRemoval ? "Record removal request" : "Access-key recovery"}</strong>
                      <small className="text-muted-foreground text-xs">{request.applicantName}{isRemoval && request.guardianName ? ` · Guardian: ${request.guardianName}` : ""}</small>
                      <small className="text-muted-foreground text-xs">{request.contactPhone || request.contactEmail || "No contact provided"}</small>
                      <small className="text-muted-foreground text-xs">Birth certificate ending {request.birthCertificateNumber.slice(-4)} · {new Date(request.createdAt).toLocaleString()}</small>
                    </div>
                    <div className="flex gap-1">
                      {isRemoval
                        ? <Button variant="secondary" type="button" disabled={removeMutation.isPending} onClick={() => removeMutation.mutate(request.id)}><Trash2 size={15} /> {removeMutation.isPending ? "Deleting…" : "Delete after review"}</Button>
                        : <Button variant="secondary" type="button" disabled={rotateMutation.isPending} onClick={() => rotateMutation.mutate(request.id)}><KeyRound size={15} /> {rotateMutation.isPending ? "Generating…" : "Generate key"}</Button>}
                      <Button variant="ghost" size="icon" title="Dismiss request" type="button" className="hover:text-destructive" disabled={dismissMutation.isPending} onClick={() => dismissMutation.mutate(request.id)}><Trash2 size={16} /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        <AccessKeyQrDialog accessKey={qrKey} open={Boolean(qrKey)} onOpenChange={(open) => { if (!open) setQrKey(""); }} />
      </CardContent>
    </Card>
  );
}
