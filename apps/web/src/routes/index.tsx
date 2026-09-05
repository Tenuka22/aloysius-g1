import { useEffect, useRef, useState } from "react";
import { consumeEventIterator } from "@orpc/client";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Camera, CheckCircle2, Clock, FileText, FileWarning, KeyRound, LayoutDashboard, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import { Button } from "@aloysius-g1/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@aloysius-g1/ui/components/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@aloysius-g1/ui/components/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aloysius-g1/ui/components/dialog";
import { Input } from "@aloysius-g1/ui/components/input";
import { client } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import { completionPercent } from "@/lib/completion";
import { clearActiveKey, getSavedKeys, removeSavedKey } from "@/lib/saved-keys";
import { AccessKeyQrImporter } from "@/components/application/access-key-qr";
import { AccessRecoveryDialog } from "@/components/application/access-recovery-dialog";
import Footer from "@/components/footer";
import { STAT_ICON_COLORS } from "@/lib/color-classes";
import { useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/")({ component: HomeComponent });

export function HomeComponent() {
  const { t } = useTranslation();
  const [keys, setKeys] = useState(getSavedKeys);
  const [records, setRecords] = useState<Record<string, { name: string; birthCertificateNumber: string; documents: number; sessionCode?: string; updatedAt?: string; completion: number; submitted: boolean; error?: string }>>({});
  const [removeKey, setRemoveKey] = useState<string | null>(null);
  const [applicationCount, setApplicationCount] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [manageKeysOpen, setManageKeysOpen] = useState(false);
  const [loadKeyOpen, setLoadKeyOpen] = useState(false);
  const [loadKeyInput, setLoadKeyInput] = useState("");
  const [loadKeyError, setLoadKeyError] = useState("");
  const [qrImportOpen, setQrImportOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<{ stop: () => void } | null>(null);
  const createNewApplication = () => {
    clearActiveKey();
    window.location.assign("/application");
  };
  const removeApplication = (key: string) => {
    removeSavedKey(key);
    const remaining = getSavedKeys().filter((savedKey) => savedKey !== key);
    setKeys(remaining);
    setRemoveKey(null);
    setQrImportOpen(true);
  };
  const loadWithKey = () => {
    const key = loadKeyInput.trim();
    if (!key) { setLoadKeyError(t("home.loadKey.error.empty")); return; }
    localStorage.setItem("aloysius-g1-application-key", key);
    const saved = getSavedKeys();
    if (!saved.includes(key)) { localStorage.setItem("aloysius-g1-application-keys", JSON.stringify([...saved, key])); }
    setLoadKeyOpen(false);
    setLoadKeyInput("");
    setLoadKeyError("");
    window.location.assign(`/application/access?key=${encodeURIComponent(key)}`);
  };
  const handleQrKey = (key: string) => {
    if (key) window.location.assign(`/application/access?key=${encodeURIComponent(key)}`);
  };
  const handleFileImport = (file: File) => {
    import("qr-scanner").then(({ default: QrScanner }) =>
      QrScanner.scanImage(file, { returnDetailedScanResult: true }).then((result: unknown) => {
        const data = result as { data?: string } | string;
        const key = typeof data === "string" ? data : data.data || "";
        handleQrKey(key);
      }).catch(() => {})
    );
  };
  const startCamera = async () => {
    setCameraActive(true);
    const { default: QrScanner } = await import("qr-scanner");
    await new Promise((r) => setTimeout(r, 100));
    if (!videoRef.current) return;
    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        const key = typeof result === "string" ? result : (result as { data?: string }).data || "";
        stopCamera();
        handleQrKey(key);
      },
      { highlightScanRegion: true, highlightCodeOutline: true }
    );
    scannerRef.current = scanner;
    await scanner.start();
  };
  const stopCamera = () => {
    scannerRef.current?.stop();
    scannerRef.current = null;
    setCameraActive(false);
  };
  useEffect(() => {
    return () => { scannerRef.current?.stop(); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void Promise.all(keys.map(async (key) => {
      try {
        const result = await client.application.get({ accessKey: key });
        const data = result.data as { applicant?: { fullName?: string; birthCertificateNumber?: string }; documents?: unknown[] };
        return [key, { name: data.applicant?.fullName || t("home.saved.unnamed"), birthCertificateNumber: data.applicant?.birthCertificateNumber || t("home.saved.notProvided"), documents: Array.isArray(data.documents) ? data.documents.length : 0, sessionCode: result.sessionCode, updatedAt: String(result.updatedAt), completion: completionPercent(data), submitted: Boolean(result.submittedAt) }] as const;
      } catch (error) {
        if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
          return [key, { name: t("home.saved.unavailableApplication"), birthCertificateNumber: "", documents: 0, completion: 0, submitted: false, error: t("home.saved.notFound") }] as const;
        }
        return [key, { name: t("home.saved.unavailable"), birthCertificateNumber: "", documents: 0, completion: 0, submitted: false, error: t("home.saved.loadError") }] as const;
      }
    })).then((entries) => { if (!cancelled) setRecords(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, [keys]);
  useEffect(() => { void authClient.getSession().then((result) => setIsAdmin((result.data?.user as { role?: string } | undefined)?.role === "admin")); }, []);
  useEffect(() => {
    const controller = new AbortController();
    void client.application.count().then((result) => setApplicationCount(result.count)).catch(() => undefined);
    const subscription = consumeEventIterator(client.application.liveCount(undefined, { signal: controller.signal }), { onEvent: (event) => setApplicationCount(event.count), onError: () => undefined });
    return () => {
      controller.abort();
      const stop = subscription as unknown;
      if (typeof stop === "function") void stop();
      else if (typeof stop === "object" && stop !== null && "cancel" in stop && typeof stop.cancel === "function") void stop.cancel();
    };
  }, []);
  const submittedCount = keys.filter((k) => records[k]?.submitted).length;
  const draftCount = keys.filter((k) => !records[k]?.submitted).length;
  const errorCount = keys.filter((k) => records[k]?.error).length;
  const incompleteCount = keys.filter((k) => !records[k]?.submitted && (records[k]?.completion ?? 0) < 100).length;
  const visibleKeys = keys.filter((key, index) => {
    const sessionCode = records[key]?.sessionCode;
    return !sessionCode || keys.findIndex((candidate) => records[candidate]?.sessionCode === sessionCode) === index;
  });

  return (
    <main className="min-h-svh" data-surface="g1-2026-application">
      <div className="mx-auto max-w-[1120px] px-4 sm:px-8 pt-4 pb-8 sm:pt-8 sm:pb-16 grid gap-6 sm:gap-10">
        {/* Hero */}
        <section className="grid gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <LayoutDashboard size={14} />
            </div>
            <p className="text-primary font-bold tracking-widest uppercase text-[0.65rem]">
              {t("home.hero.badge")}
            </p>
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-medium tracking-tight text-foreground">
            {t("home.hero.title")}
          </h1>
          <p className="text-muted-foreground max-w-[38rem] text-sm leading-relaxed">
            {t("home.hero.description")}
          </p>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-3 sm:gap-x-6 sm:gap-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{applicationCount ?? "..."}</span>
            <span className="text-xs text-muted-foreground">{t("home.stats.total")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{keys.length}</span>
            <span className="text-xs text-muted-foreground">{t("home.stats.saved")}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{submittedCount}</span>
            <span className="text-xs text-muted-foreground">{t("home.stats.submitted")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-amber-600" />
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{draftCount}</span>
            <span className="text-xs text-muted-foreground">{t("home.stats.drafts")}</span>
          </div>
          <div className="flex items-center gap-2">
            <FileWarning size={14} className="text-rose-600" />
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{errorCount}</span>
            <span className="text-xs text-muted-foreground">{t("home.stats.errors")}</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-violet-600" />
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{incompleteCount}</span>
            <span className="text-xs text-muted-foreground">{t("home.stats.incomplete")}</span>
          </div>
        </section>

        {/* Quick actions */}
        <section className="grid gap-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("home.quickActions.heading")}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Button type="button" className="h-auto py-4 flex-col items-center gap-2 text-sm font-medium shadow-sm shadow-primary/10" onClick={createNewApplication}><Plus size={18} strokeWidth={2.5} /> {t("home.quickActions.newApplication")}</Button>
            <Button type="button" variant="secondary" className="h-auto py-4 flex-col items-center gap-2 text-sm" onClick={() => setLoadKeyOpen(true)}><KeyRound size={18} /> {t("home.quickActions.loadWithKey")}</Button>
            {isAdmin && <Button type="button" variant="secondary" className="h-auto py-4 flex-col items-center gap-2 text-sm" onClick={() => window.location.assign("/admin")}><ShieldCheck size={18} /> {t("home.quickActions.adminPanel")}</Button>}
            <Button type="button" variant="secondary" className="h-auto py-4 flex-col items-center gap-2 text-sm" onClick={() => setManageKeysOpen(true)} disabled={keys.length === 0}><KeyRound size={18} /> {t("home.quickActions.manageSavedKeys")}</Button>
            <Button type="button" variant="secondary" className="h-auto py-4 flex-col items-center gap-2 text-sm" onClick={() => setQrImportOpen(true)}><Upload size={18} /> {t("home.quickActions.importQrImage")}</Button>
            <Button type="button" variant="outline" className="h-auto py-4 flex-col items-center gap-2 text-sm" onClick={() => { setRecoveryKey(keys[0] ?? null); setRecoveryOpen(true); }}><Trash2 size={18} /> {t("home.quickActions.forgotKey")}</Button>
          </div>
        </section>
      <Dialog open={qrImportOpen} onOpenChange={(open) => { if (!open) { stopCamera(); setQrImportOpen(false); } }}>
        <DialogContent className="max-w-[min(24rem,calc(100%-2rem))]">
          <DialogHeader>
            <DialogTitle>{t("home.qrDialog.title")}</DialogTitle>
            <DialogDescription>{t("home.qrDialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {!cameraActive ? (
              <>
                <Button type="button" variant="secondary" className="h-auto py-3 flex-col items-center gap-1.5" onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.onchange = () => { if (input.files?.[0]) { handleFileImport(input.files[0]); setQrImportOpen(false); } }; input.click(); }}>
                  <Upload size={20} />
                  <span className="text-sm font-medium">{t("home.qrDialog.importFromImage")}</span>
                  <span className="text-xs text-muted-foreground">{t("home.qrDialog.uploadPhoto")}</span>
                </Button>
                <Button type="button" className="h-auto py-3 flex-col items-center gap-1.5" onClick={() => void startCamera()}>
                  <Camera size={20} />
                  <span className="text-sm font-medium">{t("home.qrDialog.openCamera")}</span>
                  <span className="text-xs text-primary-foreground/70">{t("home.qrDialog.scanWithCamera")}</span>
                </Button>
              </>
            ) : (
              <div className="grid gap-3">
                <div className="relative overflow-hidden rounded-lg border bg-black aspect-square">
                  <video ref={videoRef} className="h-full w-full object-cover" />
                </div>
                <Button type="button" variant="outline" onClick={stopCamera}>{t("home.qrDialog.cancel")}</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {keys.length > 0 && <section className="grid gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-xl font-medium text-foreground">{t("home.saved.title")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("home.saved.description")}</p>
          </div>
          <span className="text-sm text-muted-foreground tabular-nums">{t("home.saved.count", { count: keys.length, plural: keys.length === 1 ? "application" : "applications" })}</span>
        </div>
        <div className="grid gap-2.5">{visibleKeys.map((key) => {
          const record = records[key];
          return <Card key={key} className="group transition-all duration-200 hover:shadow-md hover:shadow-foreground/[0.04] hover:ring-primary/20">
            <Link className="contents" to="/application/access" search={{ key, code: record?.sessionCode }}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary/70">
                      <FileText size={16} />
                    </div>
                    <span className="truncate text-base font-medium">{record?.name || t("home.saved.loading")}</span>
                  </div>
                  <ArrowRight size={18} className="shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
                </CardTitle>
                <CardDescription className="flex items-center justify-between pl-[52px]">
                  {record?.submitted ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium"><CheckCircle2 size={14} /> {t("home.saved.submitted")}</span>
                  ) : (
                    <span className="font-medium text-foreground/80">{t("home.saved.percentComplete", { count: record?.completion ?? 0 })}</span>
                  )}
                </CardDescription>
                <CardAction>
                  <Button variant="ghost" size="icon-sm" type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRemoveKey(key); }}><Trash2 size={16} /></Button>
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-2 pl-[52px] pb-5">
                {!record?.submitted && (
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <span className="block h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${record?.completion ?? 0}%` }} />
                  </div>
                )}
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs text-muted-foreground truncate">{record?.error || (record?.updatedAt ? t("home.saved.updatedAt", { date: new Date(record.updatedAt).toLocaleString() }) : t("home.saved.refreshing"))}</p>
                  <p className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">{record?.sessionCode || ""}</p>
                </div>
              </CardContent>
            </Link>
          </Card>;
        })}</div>
      </section>}
      <AccessRecoveryDialog applicantName={recoveryKey ? records[recoveryKey]?.name : undefined} open={recoveryOpen} onOpenChange={(open) => { if (!open) { setRecoveryKey(null); setRecoveryOpen(false); } }} onForgot={() => { if (recoveryKey) { const remaining = keys.filter((key) => key !== recoveryKey); localStorage.setItem("aloysius-g1-application-keys", JSON.stringify(remaining)); if (localStorage.getItem("aloysius-g1-application-key") === recoveryKey) localStorage.removeItem("aloysius-g1-application-key"); setKeys(remaining); } setRecoveryKey(null); setRecoveryOpen(false); }} />
      <AlertDialog open={removeKey !== null} onOpenChange={(open) => { if (!open) setRemoveKey(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("home.removeDialog.title")}</AlertDialogTitle><AlertDialogDescription>{t("home.removeDialog.description")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("home.removeDialog.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => { if (removeKey) removeApplication(removeKey); }}>{t("home.removeDialog.forget")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <Dialog open={manageKeysOpen} onOpenChange={setManageKeysOpen}>
        <DialogContent className="max-w-[min(28rem,calc(100%-2rem))]">
          <DialogHeader>
            <DialogTitle>{t("home.manageKeys.title")}</DialogTitle>
            <DialogDescription>{t("home.manageKeys.description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 max-h-[50vh] overflow-y-auto">
            {keys.length === 0 && <p className="text-sm text-muted-foreground">{t("home.manageKeys.noKeys")}</p>}
            {keys.map((key) => (
              <div key={key} className="flex items-center justify-between gap-2 p-3 rounded-lg border">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{records[key]?.name || t("home.manageKeys.loading")}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{key}</div>
                </div>
                <Button variant="ghost" size="icon-sm" type="button" onClick={() => { setRemoveKey(key); setManageKeysOpen(false); }}><Trash2 size={14} /></Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={loadKeyOpen} onOpenChange={setLoadKeyOpen}>
        <DialogContent className="max-w-[min(28rem,calc(100%-2rem))]">
          <DialogHeader>
            <DialogTitle>{t("home.loadKey.title")}</DialogTitle>
            <DialogDescription>{t("home.loadKey.description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input value={loadKeyInput} onChange={(e) => { setLoadKeyInput(e.target.value); setLoadKeyError(""); }} placeholder={t("home.loadKey.placeholder")} />
            {loadKeyError && <p className="text-sm text-destructive">{loadKeyError}</p>}
            <Button type="button" onClick={loadWithKey}>{t("home.loadKey.submit")}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
    </main>
  );
}
