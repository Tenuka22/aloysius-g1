import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, Outlet, useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, ClipboardCheck, Database, FileWarning, KeyRound, LayoutDashboard, ListOrdered, MapPin, MapPinned, Minus, Plus, QrCode, ShieldCheck, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { consumeEventIterator } from "@orpc/client";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@aloysius-admissions/ui/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@aloysius-admissions/ui/components/card";
import { Button } from "@aloysius-admissions/ui/components/button";
import { Badge } from "@aloysius-admissions/ui/components/badge";
import { Input } from "@aloysius-admissions/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aloysius-admissions/ui/components/select";
import { client, orpc } from "@/utils/orpc";
import { toast } from "sonner";
import { AccessKeyQrDialog } from "@/components/g1/application/access-key-qr";
import Footer from "@/components/footer";
import UserMenu from "@/components/user-menu";
import { intakeYearOptions, intakeYearSearchSchema } from "@/lib/g1/intake-year";
import { useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/g1/admin")({
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
  const navigate = useNavigate({ from: "/g1/admin" });
  const queryClient = useQueryClient();
  const search = useSearch({ from: Route.id });
  const intakeYear = search.intakeYear;
  const { t } = useTranslation();

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
            <CardTitle className="font-heading text-[clamp(1.8rem,4vw,2.5rem)]">{t("admin.noAccess.title")}</CardTitle>
            <CardDescription className="leading-relaxed">{t("admin.noAccess.description")}</CardDescription>
          </CardHeader>
          <Button variant="default" className="w-fit" render={<Link to="/g1-admissions" />}><ArrowLeft size={17} /> {t("admin.noAccess.backToDashboard")}</Button>
        </Card>
      </main>
    );
  }

  const metrics = [
    [t("admin.overview.metricApplications"), overview.data?.total ?? "...", ShieldCheck],
    [t("admin.overview.metricDrafts"), overview.data?.drafts ?? "...", FileWarning],
    [t("admin.overview.metricSubmitted"), overview.data?.submitted ?? "...", CheckCircle2],
    [t("admin.overview.metricIncomplete"), overview.data?.incomplete ?? "...", AlertTriangle],
    [t("admin.overview.metricInvalidEmails"), overview.data?.invalidEmail ?? "...", AlertTriangle],
  ] as const;

  const sidebarNav = <>
    <SidebarHeader>
      <div className="flex items-center gap-2.5">
        <img src="/logo.png" alt="" className="h-9 w-9 shrink-0 object-contain" width={36} height={36} />
        <div className="flex-1 min-w-0">
          <strong className="block">{t("admin.sidebar.brand")}</strong>
          <span className="block text-muted-foreground text-xs mt-0.5">{t("admin.sidebar.console")}</span>
        </div>
      </div>
      <div className="px-1 pt-1">
        <label className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-1 block">{t("admin.sidebar.intakeYearLabel")}</label>
        <Select value={intakeYear} onValueChange={handleYearChange}>
          <SelectTrigger className="h-8 text-xs w-full">
            <SelectValue placeholder={t("admin.sidebar.selectYear")} />
          </SelectTrigger>
          <SelectContent>
            {intakeYearOptions().map((y) => (
              <SelectItem key={y} value={y}>{t("admin.sidebar.yearOption", { year: y })}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{t("admin.sidebar.intakeYearHint")}</p>
      </div>
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>{t("admin.sidebar.workspace")}</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/g1/admin")} isActive={location.pathname === "/g1/admin"}><LayoutDashboard size={20} /> {t("admin.sidebar.overview")}</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/g1/admin/applications")} isActive={location.pathname.startsWith("/g1/admin/applications")}><BarChart3 size={20} /> {t("admin.sidebar.applications")}</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/g1/admin/admissions")} isActive={location.pathname.startsWith("/g1/admin/admissions")}><ClipboardCheck size={20} /> {t("admin.sidebar.admissions")}</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/g1/admin/schools")} isActive={location.pathname === "/g1/admin/schools"}><MapPinned size={20} /> {t("admin.sidebar.schoolsHub")}</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/g1/admin/admin_map")} isActive={location.pathname === "/g1/admin/admin_map"}><MapPin size={20} /> {t("admin.sidebar.mapView")}</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/g1/admin/mark-allocation")} isActive={location.pathname === "/g1/admin/mark-allocation"}><ListOrdered size={20} /> {t("admin.sidebar.markAllocation")}</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/g1/admin/data-extraction")} isActive={location.pathname === "/g1/admin/data-extraction"}><Database size={20} /> {t("admin.sidebar.dataExtraction")}</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/g1/admin/requests")} isActive={location.pathname === "/g1/admin/requests"}><FileWarning size={20} /> {t("admin.sidebar.submissionRequests")}</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/g1/admin/removal-requests")} isActive={location.pathname === "/g1/admin/removal-requests"}><Trash2 size={20} /> {t("admin.sidebar.removalRequests")}</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href={adminHref("/g1/admin/forgot-requests")} isActive={location.pathname === "/g1/admin/forgot-requests"}><KeyRound size={20} /> {t("admin.sidebar.forgotKeyRequests")}</SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <Link className="flex items-center gap-2.5 min-h-10 px-2.5 rounded-lg text-muted-foreground text-sm no-underline hover:text-foreground hover:bg-muted transition-colors" to="/g1-admissions">
        <ArrowLeft size={18} /> {t("admin.sidebar.backToDashboard")}
      </Link>
    </SidebarFooter>
  </>;

  return (
    <SidebarProvider>
      <Sidebar>{sidebarNav}</Sidebar>
      <SidebarInset>
        <div className="flex min-h-svh flex-col">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
            <SidebarTrigger />
            <span className="flex-1 truncate text-sm font-medium md:hidden">{t("admin.sidebar.mobileHeader")}</span>
            <div className="ml-auto flex items-center gap-1.5">
              <UserMenu />
            </div>
          </header>
          <div className="flex-1">
            {location.pathname === "/g1/admin" && (
          <main className="p-4 sm:p-12.5 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-8 mb-8">
              <div>
                <p className="text-primary font-bold tracking-widest uppercase text-xs">{t("admin.overview.badge")}</p>
                <h1 className="font-heading text-[clamp(2rem,4vw,3.6rem)] mt-1 mb-3">{t("admin.overview.title")}</h1>
                <p className="text-muted-foreground">{t("admin.overview.description")}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-primary text-sm font-semibold">
                <span className="w-2 h-2 rounded-full bg-current shadow-[0_0_0_0.2rem_color-mix(in_oklch,currentColor_15%,transparent)]" /> {t("admin.overview.liveIndicator")}
              </span>
            </div>
            {overview.error && (
              <Card className="flex items-center gap-2 text-destructive mb-4">
                <AlertTriangle size={18} /> {t("admin.overview.metricsError", { message: overview.error.message })}
              </Card>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
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
              <CardHeader><CardTitle>{t("admin.overview.appRequests.title")}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{t("admin.overview.appRequests.description")}</p>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="secondary" render={<Link to="/g1/admin/requests" search={true} />}>{t("admin.overview.appRequests.submissionRequests")}</Button>
                  <Button variant="secondary" render={<Link to="/g1/admin/removal-requests" search={true} />}>{t("admin.overview.appRequests.removalRequests")}</Button>
                  <Button variant="secondary" render={<Link to="/g1/admin/forgot-requests" search={true} />}>{t("admin.overview.appRequests.forgotKeyRequests")}</Button>
                </div>
              </CardContent>
            </Card>
            <Card className="mb-4">
              <CardHeader><CardTitle>{t("admin.overview.admissions.title")}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{t("admin.overview.admissions.description")}</p>
                <Button variant="secondary" render={<Link to="/g1/admin/admissions" search={true} />}><ClipboardCheck size={17} /> {t("admin.overview.admissions.openAdmissions")}</Button>
              </CardContent>
            </Card>
            <Card className="mb-4">
              <CardHeader><CardTitle>{t("admin.overview.schoolCoords.title")}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{t("admin.overview.schoolCoords.description")}</p>
                <Button variant="secondary" render={<Link to="/g1/admin/schools" search={true} />}><MapPinned size={17} /> {t("admin.overview.schoolCoords.openHub")}</Button>
              </CardContent>
            </Card>
            <Card className="mb-4">
              <CardHeader><CardTitle>{t("admin.overview.recentActivity.title")}</CardTitle></CardHeader>
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
          </div>
          <Outlet />
          <Footer />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

// `value` here is a datetime-local-style string ("YYYY-MM-DDTHH:mm", no
// timezone) and `new Date(value)` parses that as local time - so it must be
// built from local getters too. Using `toISOString()` (UTC) to produce it
// desynced the two conversions by the browser's UTC offset, which is why the
// picker showed and saved the wrong hour outside UTC.
function toLocalDateTimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DateTimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  // A native datetime-local input's value is always "YYYY-MM-DDTHH:mm" in
  // local time - exactly this state's format (see toLocalDateTimeValue) and
  // exactly what new Date(value) parses it back as - so there's no separate
  // hour/minute state to keep in sync, and the browser owns the whole
  // calendar/time UI instead of a hand-rolled Popover+Calendar+<select>
  // combination.
  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground text-xs font-semibold">{label}</span>
      <Input type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function FormWindowSettings({ intakeYear }: { intakeYear: string }) {
  const queryClient = useQueryClient();
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [selectedYear, setSelectedYear] = useState(intakeYear);
  // Tracks which year's data the fields below currently reflect, so the sync
  // effect only overwrites them when the admin switches years (or on first
  // load) - not on every background refetch of the same year, which would
  // otherwise stomp an in-progress pick with the last-saved value the
  // instant a native <select> dropdown's focus/blur cycle triggers React
  // Query's refetch-on-window-focus.
  const syncedYearRef = useRef<string | null>(null);
  const yearSettings = useQuery(orpc.admin.settings.get.queryOptions({ input: { intakeYear: selectedYear } }));
  const { t } = useTranslation();

  useEffect(() => {
    if (syncedYearRef.current === selectedYear) return;
    if (yearSettings.data) {
      setOpensAt(toLocalDateTimeValue(yearSettings.data.opensAt));
      setClosesAt(toLocalDateTimeValue(yearSettings.data.closesAt));
      syncedYearRef.current = selectedYear;
    } else if (yearSettings.isFetched && !yearSettings.data) {
      setOpensAt("");
      setClosesAt("");
      syncedYearRef.current = selectedYear;
    }
  }, [yearSettings.data, yearSettings.isFetched, selectedYear]);

  const windowStatus = yearSettings.data
    ? (() => {
        const now = Date.now();
        if (now < yearSettings.data.opensAt.getTime()) return { label: t("admin.overview.formAvailability.statusOpensLater"), className: "text-amber-600" };
        if (now > yearSettings.data.closesAt.getTime()) return { label: t("admin.overview.formAvailability.statusWindowClosed"), className: "text-muted-foreground" };
        return { label: t("admin.overview.formAvailability.statusOpenNow"), className: "text-emerald-600" };
      })()
    : null;

  const saveMutation = useMutation({
    mutationFn: () => client.admin.settings.update({ opensAt: new Date(opensAt), closesAt: new Date(closesAt), intakeYear: selectedYear }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.admin.settings.get.queryKey({ input: { intakeYear: selectedYear } }) });
      toast.success(t("admin.overview.formAvailability.saved"));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("admin.overview.formAvailability.saveError"));
    },
  });

  return (
    <Card className="mb-4">
      <CardContent className="grid gap-4">
        <div>
          <CardHeader className="p-0"><CardTitle>{t("admin.overview.formAvailability.title")}</CardTitle></CardHeader>
          <CardDescription>{t("admin.overview.formAvailability.description")}</CardDescription>
        </div>
        <div className="grid grid-cols-1 gap-4 items-start sm:grid-cols-3">
          <div className="grid min-w-0 gap-1">
            <span className="text-muted-foreground text-xs font-semibold">{t("admin.overview.formAvailability.intakeYearLabel")}</span>
            <YearStepper value={selectedYear} onChange={setSelectedYear} />
            {windowStatus
              ? <span className={`text-[10px] font-medium ${windowStatus.className}`}>{windowStatus.label}</span>
              : <span className="text-[10px] text-muted-foreground">{t("admin.overview.formAvailability.notConfigured")}</span>
            }
          </div>
          <div className="min-w-0">
            <DateTimePicker value={opensAt} onChange={setOpensAt} label={t("admin.overview.formAvailability.opens")} />
          </div>
          <div className="min-w-0">
            <DateTimePicker value={closesAt} onChange={setClosesAt} label={t("admin.overview.formAvailability.closes")} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="default" type="button" disabled={saveMutation.isPending || !opensAt || !closesAt} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? t("admin.overview.formAvailability.saving") : t("admin.overview.formAvailability.saveButton")}
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
  const { t } = useTranslation();

  const rotateMutation = useMutation({
    mutationFn: (requestId: string) => client.admin.accessRequests.rotateKey({ requestId }),
    onSuccess: (result) => {
      setGeneratedKey(result.accessKey);
      setQrKey(result.accessKey);
      toast.success(t("admin.overview.requestQueue.toast.keyGenerated"));
      onRefresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("admin.overview.requestQueue.toast.generateKeyError")),
  });

  const removeMutation = useMutation({
    mutationFn: (requestId: string) => client.admin.accessRequests.deleteAfterRemovalRequest({ requestId }),
    onSuccess: () => {
      toast.success(t("admin.overview.requestQueue.toast.applicationDeleted"));
      onRefresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("admin.overview.requestQueue.toast.deleteError")),
  });

  const dismissMutation = useMutation({
    mutationFn: (requestId: string) => client.admin.accessRequests.dismiss({ requestId }),
    onSuccess: () => onRefresh(),
    onError: (error) => toast.error(error instanceof Error ? error.message : t("admin.overview.requestQueue.toast.dismissError")),
  });

  return (
    <Card className="mb-4">
      <CardContent className="grid gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <CardHeader className="p-0"><CardTitle>{t("admin.overview.requestQueue.title")}</CardTitle></CardHeader>
            <CardDescription>{t("admin.overview.requestQueue.description")}</CardDescription>
          </div>
          <Badge variant="secondary">{t("admin.overview.requestQueue.openCount", { count: requests.length })}</Badge>
        </div>
        {generatedKey && (
          <div className="grid gap-1 p-4 border rounded-[10px] border-primary/35 bg-primary/7">
            <strong className="font-semibold text-sm">{t("admin.overview.requestQueue.oneTimeDisplay")}</strong>
            <code className="text-[1.1rem] font-bold break-all">{generatedKey}</code>
            <span className="text-muted-foreground text-xs">{t("admin.overview.requestQueue.copyHint")}</span>
            <Button variant="secondary" type="button" onClick={() => setQrKey(generatedKey)}><QrCode size={16} /> {t("admin.overview.requestQueue.showQr")}</Button>
          </div>
        )}
        {requests.length === 0
          ? <p className="text-muted-foreground text-sm">{t("admin.overview.requestQueue.noRequests")}</p>
          : (
            <div className="grid gap-1">
              {requests.map((request) => {
                const isRemoval = request.requestType === "removal";
                return (
                  <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-border" key={request.id}>
                    <div className="grid min-w-0 gap-0.5">
                      <strong className="font-semibold">{isRemoval ? t("admin.overview.requestQueue.removalRequest") : t("admin.overview.requestQueue.accessKeyRecovery")}</strong>
                      <small className="text-muted-foreground text-xs">{request.applicantName}{isRemoval && request.guardianName ? ` · ${t("admin.overview.requestQueue.guardianLabel", { name: request.guardianName })}` : ""}</small>
                      <small className="text-muted-foreground text-xs">{request.contactPhone || request.contactEmail || t("admin.overview.requestQueue.noContact")}</small>
                      <small className="text-muted-foreground text-xs">{t("admin.overview.requestQueue.birthCertEnding", { last4: request.birthCertificateNumber.slice(-4) })} · {new Date(request.createdAt).toLocaleString()}</small>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {isRemoval
                        ? <Button variant="secondary" type="button" className="whitespace-normal" disabled={removeMutation.isPending} onClick={() => removeMutation.mutate(request.id)}><Trash2 size={15} /> {removeMutation.isPending ? t("admin.overview.requestQueue.deleting") : t("admin.overview.requestQueue.deleteAfterReview")}</Button>
                        : <Button variant="secondary" type="button" className="whitespace-normal" disabled={rotateMutation.isPending} onClick={() => rotateMutation.mutate(request.id)}><KeyRound size={15} /> {rotateMutation.isPending ? t("admin.overview.requestQueue.generating") : t("admin.overview.requestQueue.generateKey")}</Button>}
                      <Button variant="ghost" size="icon" title={t("admin.overview.requestQueue.dismissRequest")} type="button" className="hover:text-destructive" disabled={dismissMutation.isPending} onClick={() => dismissMutation.mutate(request.id)}><Trash2 size={16} /></Button>
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
