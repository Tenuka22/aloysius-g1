import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, FileWarning, KeyRound, LayoutDashboard, QrCode, ShieldCheck, Trash2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { consumeEventIterator } from "@orpc/client";
import { cn } from "@aloysius-g1/ui/lib/utils";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@aloysius-g1/ui/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@aloysius-g1/ui/components/card";
import { Button } from "@aloysius-g1/ui/components/button";
import { Badge } from "@aloysius-g1/ui/components/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@aloysius-g1/ui/components/popover";
import { Calendar } from "@aloysius-g1/ui/components/calendar";
import { client, orpc } from "@/utils/orpc";
import { AccessKeyQrDialog } from "@/components/application/access-key-qr";

export const Route = createFileRoute("/_auth/admin")({ component: AdminPage });

function AdminPage() {
  const { session } = Route.useRouteContext();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const overview = useQuery(orpc.admin.overview.queryOptions());
  const applications = useQuery(orpc.admin.applications.queryOptions({ input: { page: 1, pageSize: 50, query: "" } }));
  const settings = useQuery(orpc.admin.settings.get.queryOptions());
  const accessRequests = useQuery(orpc.admin.accessRequests.query.queryOptions());
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
    ["Applications", overview.data?.total ?? "—", ShieldCheck],
    ["Drafts", overview.data?.drafts ?? "—", FileWarning],
    ["Submitted", overview.data?.submitted ?? "—", CheckCircle2],
    ["Incomplete", overview.data?.incomplete ?? "—", AlertTriangle],
    ["Invalid emails", overview.data?.invalidEmail ?? "—", AlertTriangle],
  ] as const;

  const sidebarNav = <>
    <SidebarHeader>
      <div className="flex items-center gap-2.5">
        <div className="grid place-items-center w-9 h-9 rounded-lg text-primary-foreground bg-primary"><ShieldCheck size={19} /></div>
        <div>
          <strong className="block">G1 Intake</strong>
          <span className="block text-muted-foreground text-xs mt-0.5">Admin console</span>
        </div>
      </div>
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Workspace</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton href="/admin" isActive={location.pathname === "/admin"} onClick={() => setSidebarOpen(false)}><LayoutDashboard size={17} /> Overview</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href="/admin/applications" isActive={location.pathname.startsWith("/admin/applications")} onClick={() => setSidebarOpen(false)}><BarChart3 size={17} /> Applications</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href="/admin/requests" isActive={location.pathname === "/admin/requests"} onClick={() => setSidebarOpen(false)}><FileWarning size={17} /> Submission requests</SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <Link className="flex items-center gap-2.5 min-h-10 px-2.5 rounded-lg text-muted-foreground text-sm no-underline hover:text-foreground hover:bg-muted transition-colors" to="/dashboard">
        <ArrowLeft size={16} /> Back to dashboard
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
          <main className="min-h-svh p-12.5 max-w-[1240px] mx-auto bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
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
            <FormWindowSettings settings={settings.data} />
            <AccessRequestQueue requests={accessRequests.data ?? []} onRefresh={() => void accessRequests.refetch()} />
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

function FormWindowSettings({ settings }: { settings?: { opensAt: Date; closesAt: Date } }) {
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (settings) {
      setOpensAt(settings.opensAt.toISOString().slice(0, 16));
      setClosesAt(settings.closesAt.toISOString().slice(0, 16));
    }
  }, [settings]);
  const save = async () => {
    setSaving(true); setMessage("");
    try {
      await client.admin.settings.update({ opensAt: new Date(opensAt), closesAt: new Date(closesAt) });
      setMessage("Form window saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save form window");
    } finally { setSaving(false); }
  };
  return (
    <Card className="mb-4">
      <CardContent className="grid gap-4">
        <div>
          <CardHeader className="p-0"><CardTitle>Form availability</CardTitle></CardHeader>
          <CardDescription>Choose when applicants can submit the form. The window uses your local time.</CardDescription>
        </div>
        <div className="grid grid-cols-2 gap-4 items-end">
          <DateTimePicker value={opensAt} onChange={setOpensAt} label="Opens" />
          <DateTimePicker value={closesAt} onChange={setClosesAt} label="Closes" />
          <Button variant="default" type="button" disabled={saving || !opensAt || !closesAt} onClick={() => void save()}>
            {saving ? "Saving…" : "Save form window"}
          </Button>
        </div>
        {message && <p className="text-primary" role="status">{message}</p>}
      </CardContent>
    </Card>
  );
}

function AccessRequestQueue({ requests, onRefresh }: { requests: Array<{ id: string; applicantName: string; guardianName?: string; contactEmail: string; contactPhone?: string | null; birthCertificateNumber: string; requestType: string; createdAt: Date }>; onRefresh: () => void }) {
  const [generatedKey, setGeneratedKey] = useState("");
  const [qrKey, setQrKey] = useState("");
  const [message, setMessage] = useState("");

  const rotate = async (requestId: string) => {
    try {
      const result = await client.admin.accessRequests.rotateKey({ requestId });
      setGeneratedKey(result.accessKey); setQrKey(result.accessKey);
      setMessage("New key generated. Share it securely with the verified applicant.");
      onRefresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not generate key"); }
  };
  const removeAfterReview = async (requestId: string) => {
    if (!window.confirm("Confirm that the school has reviewed this request and approved deleting the application?")) return;
    try {
      await client.admin.accessRequests.deleteAfterRemovalRequest({ requestId });
      setMessage("The application was deleted after review."); onRefresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not delete the application"); }
  };
  const dismiss = async (requestId: string) => {
    try { await client.admin.accessRequests.dismiss({ requestId }); onRefresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not dismiss request"); }
  };

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
        {message && <p className="text-primary" role="status">{message}</p>}
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
                        ? <Button variant="secondary" type="button" onClick={() => void removeAfterReview(request.id)}><Trash2 size={15} /> Delete after review</Button>
                        : <Button variant="secondary" type="button" onClick={() => void rotate(request.id)}><KeyRound size={15} /> Generate key</Button>}
                      <Button variant="ghost" size="icon" title="Dismiss request" type="button" className="hover:text-destructive" onClick={() => void dismiss(request.id)}><Trash2 size={16} /></Button>
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
