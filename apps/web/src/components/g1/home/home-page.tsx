import { useQueries } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Clock, FileText, FileWarning, KeyRound, LayoutDashboard, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import { Button } from "@aloysius-admissions/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@aloysius-admissions/ui/components/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@aloysius-admissions/ui/components/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aloysius-admissions/ui/components/dialog";
import { Input } from "@aloysius-admissions/ui/components/input";
import { orpc } from "@/utils/orpc";
import type { ApplicationDraft } from "@/lib/g1/application-store";
import { completionPercent } from "@/lib/g1/completion";
import { clearActiveKey, setActiveKey } from "@/lib/g1/saved-keys";
import { useSavedApplicationsStore } from "@/lib/g1/saved-applications-store";
import { useHomeUiStore } from "@/lib/g1/home-ui-store";
import { AccessKeyQrImporter } from "@/components/g1/application/access-key-qr";
import { AccessRecoveryDialog } from "@/components/g1/application/access-recovery-dialog";
import Footer from "@/components/footer";
import { useTranslation } from "@/lib/i18n";

// retry disabled and error toasts suppressed since a stale/removed saved key is an
// expected, inline-handled state (rendered as an "unavailable" card), not an unexpected failure.
function savedApplicationQueryOptions(accessKey: string) {
  return {
    ...orpc.application.get.queryOptions({ input: { accessKey } }),
    retry: false,
    meta: { skipErrorToast: true },
  };
}

type SavedApplicationRecord = {
  name: string;
  birthCertificateNumber: string;
  documents: number;
  sessionCode?: string;
  updatedAt?: string;
  completion: number;
  submitted: boolean;
  error?: string;
};

export function HomeComponent({ isAdmin, isSubAdmin }: { isAdmin: boolean; isSubAdmin: boolean }) {
  const { t } = useTranslation();
  const { keys, add: addSavedKey, remove: removeSavedApplication } = useSavedApplicationsStore();
  const ui = useHomeUiStore();
  const refreshSavedKeys = useSavedApplicationsStore((s) => s.refresh);

  // The saved-keys list lives in localStorage, external to this store; re-sync on mount
  // in case it changed since the store module was first evaluated (e.g. another tab).
  useEffect(() => {
    refreshSavedKeys();
  }, [refreshSavedKeys]);

  const applicationQueries = useQueries({
    queries: keys.map((key) => savedApplicationQueryOptions(key)),
  });

  const records: Record<string, SavedApplicationRecord> = {};
  keys.forEach((key, index) => {
    const query = applicationQueries[index];
    if (!query || query.isPending) return;
    if (query.isError) {
      const notFound = query.error instanceof Error && query.error.message.toLowerCase().includes("not found");
      records[key] = {
        name: notFound ? t("home.saved.unavailableApplication") : t("home.saved.unavailable"),
        birthCertificateNumber: "",
        documents: 0,
        completion: 0,
        submitted: false,
        error: notFound ? t("home.saved.notFound") : t("home.saved.loadError"),
      };
      return;
    }
    const result = query.data;
    // application.data is stored as a loosely-typed jsonb column server-side; the client shape is the draft schema.
    const data = result?.data as (Partial<ApplicationDraft> & { documents?: unknown[] }) | undefined;
    records[key] = {
      name: data?.applicant?.fullName || t("home.saved.unnamed"),
      birthCertificateNumber: data?.applicant?.birthCertificateNumber || t("home.saved.notProvided"),
      documents: Array.isArray(data?.documents) ? data.documents.length : 0,
      sessionCode: result?.sessionCode,
      updatedAt: result ? String(result.updatedAt) : undefined,
      completion: completionPercent(data),
      submitted: Boolean(result?.submittedAt),
    };
  });

  const createNewApplication = () => {
    clearActiveKey();
    window.location.assign("/application");
  };
  const removeApplication = (key: string) => {
    removeSavedApplication(key);
    ui.setRemoveKey(null);
    ui.setQrImportOpen(true);
  };
  const loadWithKey = () => {
    const key = ui.loadKeyInput.trim();
    if (!key) { ui.setLoadKeyError(t("home.loadKey.error.empty")); return; }
    setActiveKey(key);
    addSavedKey(key);
    ui.closeLoadKey();
    window.location.assign(`/application/access?key=${encodeURIComponent(key)}`);
  };
  const handleQrKey = (key: string) => {
    ui.setQrImportOpen(false);
    if (key) window.location.assign(`/application/access?key=${encodeURIComponent(key)}`);
  };
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
            <Button type="button" variant="secondary" className="h-auto py-4 flex-col items-center gap-2 text-sm" onClick={() => ui.openLoadKey()}><KeyRound size={18} /> {t("home.quickActions.loadWithKey")}</Button>
            {isAdmin && <Button type="button" variant="secondary" className="h-auto py-4 flex-col items-center gap-2 text-sm" onClick={() => window.location.assign("/g1/admin")}><ShieldCheck size={18} /> {t("home.quickActions.adminPanel")}</Button>}
            {!isAdmin && isSubAdmin && <Button type="button" variant="secondary" className="h-auto py-4 flex-col items-center gap-2 text-sm" onClick={() => window.location.assign("/sub-admin")}><ShieldCheck size={18} /> {t("home.quickActions.subAdminPanel")}</Button>}
            <Button type="button" variant="secondary" className="h-auto py-4 flex-col items-center gap-2 text-sm" onClick={() => ui.setManageKeysOpen(true)} disabled={keys.length === 0}><KeyRound size={18} /> {t("home.quickActions.manageSavedKeys")}</Button>
            <Button type="button" variant="secondary" className="h-auto py-4 flex-col items-center gap-2 text-sm" onClick={() => ui.setQrImportOpen(true)}><Upload size={18} /> {t("home.quickActions.importQrImage")}</Button>
            <Button type="button" variant="outline" className="h-auto py-4 flex-col items-center gap-2 text-sm" onClick={() => ui.openRecovery(keys[0] ?? null)}><Trash2 size={18} /> {t("home.quickActions.forgotKey")}</Button>
          </div>
        </section>
      <Dialog open={ui.qrImportOpen} onOpenChange={(open) => ui.setQrImportOpen(open)}>
        <DialogContent className="max-w-[min(24rem,calc(100%-2rem))]">
          <DialogHeader>
            <DialogTitle>{t("home.qrDialog.title")}</DialogTitle>
            <DialogDescription>{t("home.qrDialog.description")}</DialogDescription>
          </DialogHeader>
          <AccessKeyQrImporter onKey={handleQrKey} />
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
                  <Button variant="ghost" size="icon-sm" type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); ui.setRemoveKey(key); }}><Trash2 size={16} /></Button>
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
      <AccessRecoveryDialog applicantName={ui.recoveryKey ? records[ui.recoveryKey]?.name : undefined} open={ui.recoveryOpen} onOpenChange={(open) => { if (!open) ui.closeRecovery(); }} onForgot={() => { if (ui.recoveryKey) removeSavedApplication(ui.recoveryKey); ui.closeRecovery(); }} />
      <AlertDialog open={ui.removeKey !== null} onOpenChange={(open) => { if (!open) ui.setRemoveKey(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("home.removeDialog.title")}</AlertDialogTitle><AlertDialogDescription>{t("home.removeDialog.description")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("home.removeDialog.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => { if (ui.removeKey) removeApplication(ui.removeKey); }}>{t("home.removeDialog.forget")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <Dialog open={ui.manageKeysOpen} onOpenChange={(open) => ui.setManageKeysOpen(open)}>
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
                <Button variant="ghost" size="icon-sm" type="button" onClick={() => { ui.setRemoveKey(key); ui.setManageKeysOpen(false); }}><Trash2 size={14} /></Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ui.loadKeyOpen} onOpenChange={(open) => { if (open) ui.openLoadKey(); else ui.closeLoadKey(); }}>
        <DialogContent className="max-w-[min(28rem,calc(100%-2rem))]">
          <DialogHeader>
            <DialogTitle>{t("home.loadKey.title")}</DialogTitle>
            <DialogDescription>{t("home.loadKey.description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input value={ui.loadKeyInput} onChange={(e) => ui.setLoadKeyInput(e.target.value)} placeholder={t("home.loadKey.placeholder")} />
            {ui.loadKeyError && <p className="text-sm text-destructive">{ui.loadKeyError}</p>}
            <Button type="button" onClick={loadWithKey}>{t("home.loadKey.submit")}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
    </main>
  );
}
