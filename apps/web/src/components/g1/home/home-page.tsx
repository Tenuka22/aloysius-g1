import { useQueries } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, FileText, GraduationCap, KeyRound, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@aloysius-admissions/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@aloysius-admissions/ui/components/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@aloysius-admissions/ui/components/empty";
import { Eyebrow } from "@aloysius-admissions/ui/components/eyebrow";
import { HeroVignette } from "@aloysius-admissions/ui/components/hero-vignette";
import { IconBadge } from "@aloysius-admissions/ui/components/icon-badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@aloysius-admissions/ui/components/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aloysius-admissions/ui/components/dialog";
import { Input } from "@aloysius-admissions/ui/components/input";
import { orpc } from "@/utils/orpc";
import type { ApplicationDraft } from "@/lib/g1/application-store";
import { completionPercent } from "@/lib/g1/completion";
import { INTAKE_YEAR_DEFAULT } from "@/lib/g1/intake-year";
import { clearActiveKey, setActiveKey } from "@/lib/g1/saved-keys";
import { useSavedApplicationsStore } from "@/lib/g1/saved-applications-store";
import { useHomeUiStore } from "@/lib/g1/home-ui-store";
import { AccessRecoveryDialog } from "@/components/g1/application/access-recovery-dialog";
import Header from "@/components/header";
import { useTranslation } from "@/lib/i18n";

// retry disabled and error toasts suppressed since a stale/removed saved key is an
// expected state (the key is silently dropped from the visible list below), not an
// unexpected failure worth surfacing.
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
};

export function HomeComponent({ isAdmin, isSubAdmin }: { isAdmin: boolean; isSubAdmin: boolean }) {
  const { t } = useTranslation();
  const { keys, add: addSavedKey, remove: removeSavedApplication } = useSavedApplicationsStore();
  const ui = useHomeUiStore();
  const refreshSavedKeys = useSavedApplicationsStore((s) => s.refresh);

  // The store starts empty (see saved-applications-store.ts) so it never reads cookies
  // during server rendering; this mount-time refresh is what actually loads the real
  // saved-keys list, client-side, once per page view.
  useEffect(() => {
    refreshSavedKeys();
  }, [refreshSavedKeys]);

  const applicationQueries = useQueries({
    queries: keys.map((key) => savedApplicationQueryOptions(key)),
  });

  // Keys whose row no longer exists server-side (deleted, or from a reset database)
  // are dropped silently here rather than rendered as an "unavailable" card - a
  // dangling local key isn't something the applicant can act on, so it's pruned
  // from storage and simply doesn't appear.
  const records: Record<string, SavedApplicationRecord> = {};
  const deadKeys: string[] = [];
  keys.forEach((key, index) => {
    const query = applicationQueries[index];
    if (!query || query.isPending) return;
    if (query.isError) {
      deadKeys.push(key);
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

  useEffect(() => {
    deadKeys.forEach((key) => removeSavedApplication(key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadKeys.join(",")]);

  const loadedKeys = keys.filter((key) => records[key]);
  const isLoadingKeys = keys.length > 0 && loadedKeys.length === 0 && deadKeys.length === 0;

  const removeApplication = (key: string) => {
    removeSavedApplication(key);
    ui.setRemoveKey(null);
  };
  const loadWithKey = () => {
    const key = ui.loadKeyInput.trim();
    if (!key) { ui.setLoadKeyError(t("home.loadKey.error.empty")); return; }
    setActiveKey(key);
    addSavedKey(key);
    ui.closeLoadKey();
    window.location.assign(`/application?key=${encodeURIComponent(key)}`);
  };
  const visibleKeys = loadedKeys.filter((key, index) => {
    const sessionCode = records[key]?.sessionCode;
    return !sessionCode || loadedKeys.findIndex((candidate) => records[candidate]?.sessionCode === sessionCode) === index;
  });

  return (
    <div className="flex min-h-svh flex-col" data-surface="g1-application">
      <Header />
      <main className="flex-1">
        {/* Hero: deep crest-green band with a gold rule, matching the college crest palette exactly.
            A soft top-down vignette (not a stray radial blob) keeps the band premium at every width,
            from a 320px phone to an 8K display, since the fill never depends on a fixed pixel origin. */}
        <section className="relative isolate overflow-hidden bg-primary text-primary-foreground">
          <HeroVignette variant="vertical" />
          <div className="relative mx-auto grid w-full max-w-(--breakpoint-2xl) gap-5 px-[clamp(1rem,4vw,4rem)] pt-[clamp(2.5rem,3vw+1.5rem,4.5rem)] pb-[clamp(2rem,2.5vw+1rem,3rem)] text-center sm:text-left">
            <Eyebrow variant="dot" className="justify-center sm:justify-start">
              {t("home.hero.badge", { year: INTAKE_YEAR_DEFAULT })}
            </Eyebrow>
            <h1 className="font-display text-5xl font-semibold tracking-tight leading-[1.12]">
              <span className="block">St. Aloysius&rsquo; College - Galle</span>
              <span className="block text-brand-gold">{INTAKE_YEAR_DEFAULT} - Grade 01 Admission</span>
            </h1>
            <p className="text-primary-foreground/75 max-w-152 text-[clamp(0.875rem,0.8rem+0.3vw,1.0625rem)] leading-relaxed mx-auto sm:mx-0">
              {t("home.hero.description")}
            </p>
          </div>
        </section>

        <div className="mx-auto grid w-full max-w-(--breakpoint-2xl) gap-8 px-[clamp(1rem,4vw,4rem)] pt-[clamp(1.5rem,2vw+0.75rem,2.5rem)] pb-[clamp(2.5rem,3vw+1.5rem,5rem)] sm:gap-12">
          {/* Quick actions */}
          <section className="grid gap-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em]">
              {t("home.quickActions.heading")}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Link to="/application" onClick={clearActiveKey} className="contents">
                <Button
                  type="button"
                  className="group h-auto min-w-0 w-full flex-row sm:flex-col items-center justify-start sm:justify-center gap-4 sm:gap-3 whitespace-normal rounded-xl py-5 sm:py-8 px-5 text-left sm:text-center text-sm font-semibold shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/25"
                >
                  <IconBadge icon={<Plus size={20} strokeWidth={2.25} />} tone="gold" />
                  {t("home.quickActions.newApplication")}
                </Button>
              </Link>
              <Button
                type="button"
                variant="outline"
                className="group h-auto min-w-0 w-full flex-row sm:flex-col items-center justify-start sm:justify-center gap-4 sm:gap-3 whitespace-normal rounded-xl border-2 border-primary/15 bg-accent/40 py-5 sm:py-8 px-5 text-left sm:text-center text-sm font-semibold transition-all hover:-translate-y-0.5 hover:bg-accent/70 hover:border-brand-gold/60"
                onClick={() => ui.openLoadKey()}
              >
                <IconBadge icon={<KeyRound size={18} strokeWidth={2.25} />} tone="primary" />
                {t("home.quickActions.loadWithKey")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="group h-auto min-w-0 w-full flex-row sm:flex-col items-center justify-start sm:justify-center gap-4 sm:gap-3 whitespace-normal rounded-xl border-2 border-primary/15 bg-accent/40 py-5 sm:py-8 px-5 text-left sm:text-center text-sm font-semibold transition-all hover:-translate-y-0.5 hover:bg-accent/70 hover:border-brand-gold/60 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-accent/40 disabled:hover:border-primary/15"
                onClick={() => ui.setManageKeysOpen(true)}
                disabled={keys.length === 0}
              >
                <IconBadge icon={<ShieldCheck size={18} strokeWidth={2.25} />} tone="primary" />
                {t("home.quickActions.manageSavedKeys")}
              </Button>
            </div>
            {(isAdmin || isSubAdmin) && (
              <div className="flex justify-center sm:justify-start">
                <Link to={isAdmin ? "/g1/admin" : "/sub-admin"}>
                  <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-primary">
                    <GraduationCap size={14} />
                    {isAdmin ? t("home.quickActions.adminPanel") : t("home.quickActions.subAdminPanel")}
                  </Button>
                </Link>
              </div>
            )}
          </section>

          {/* Your saved applications */}
          {loadedKeys.length > 0 && (
            <section className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div>
                  <h2 className="font-heading text-xl font-medium text-foreground">{t("home.saved.title")}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{t("home.saved.description")}</p>
                </div>
                <span className="text-sm text-muted-foreground tabular-nums shrink-0">
                  {t("home.saved.count", { count: loadedKeys.length, plural: loadedKeys.length === 1 ? "application" : "applications" })}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleKeys.map((key) => {
                  const record = records[key];
                  return (
                    <Card key={key} elevated className="group ring-primary/10">
                      <Link className="contents active:scale-[0.995]" to="/application" search={{ key, code: record?.sessionCode }}>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary/70 ring-1 ring-primary/10">
                                <FileText size={16} />
                              </div>
                              <span className="truncate text-base font-medium">{record?.name}</span>
                            </div>
                            <ArrowRight size={18} className="shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
                          </CardTitle>
                          <CardDescription className="flex items-center justify-between pl-[52px]">
                            {record?.submitted ? (
                              <span className="inline-flex items-center gap-1.5 text-primary font-medium"><CheckCircle2 size={14} /> {t("home.saved.submitted")}</span>
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
                              <span className="block h-full rounded-full bg-brand-gold transition-all duration-500" style={{ width: `${record?.completion ?? 0}%` }} />
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-xs text-muted-foreground truncate">{record?.updatedAt ? t("home.saved.updatedAt", { date: new Date(record.updatedAt).toLocaleString() }) : t("home.saved.refreshing")}</p>
                            <p className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">{record?.sessionCode || ""}</p>
                          </div>
                        </CardContent>
                      </Link>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {keys.length === 0 && (
            <Empty className="border-2 border-dashed border-primary/15 bg-accent/30">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
                  <FileText size={16} />
                </EmptyMedia>
                <EmptyTitle>{t("home.saved.emptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("home.saved.emptyDescription")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>

        <AccessRecoveryDialog applicantName={ui.recoveryKey ? records[ui.recoveryKey]?.name : undefined} open={ui.recoveryOpen} onOpenChange={(open) => { if (!open) ui.closeRecovery(); }} onForgot={() => { if (ui.recoveryKey) removeSavedApplication(ui.recoveryKey); ui.closeRecovery(); }} />
        <AlertDialog open={ui.removeKey !== null} onOpenChange={(open) => { if (!open) ui.setRemoveKey(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("home.removeDialog.title")}</AlertDialogTitle><AlertDialogDescription>{t("home.removeDialog.description")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("home.removeDialog.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => { if (ui.removeKey) removeApplication(ui.removeKey); }}>{t("home.removeDialog.forget")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

        <Dialog open={ui.manageKeysOpen} onOpenChange={(open) => ui.setManageKeysOpen(open)}>
          <DialogContent className="max-w-[min(28rem,calc(100%-2rem))]">
            <DialogHeader>
              <DialogTitle>{t("home.manageKeys.title")}</DialogTitle>
              <DialogDescription>{t("home.manageKeys.description")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 max-h-[50vh] overflow-y-auto">
              {isLoadingKeys && <p className="text-sm text-muted-foreground">{t("home.manageKeys.loading")}</p>}
              {!isLoadingKeys && loadedKeys.length === 0 && <p className="text-sm text-muted-foreground">{t("home.manageKeys.noKeys")}</p>}
              {loadedKeys.map((key) => (
                <div key={key} className="flex items-center justify-between gap-2 p-3 rounded-lg border">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{records[key]?.name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{key}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" type="button" className="text-xs text-muted-foreground" onClick={() => { ui.setManageKeysOpen(false); ui.openRecovery(key); }}>{t("home.quickActions.forgotKey")}</Button>
                    <Button variant="ghost" size="icon-sm" type="button" onClick={() => { ui.setRemoveKey(key); ui.setManageKeysOpen(false); }}><Trash2 size={14} /></Button>
                  </div>
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
      </main>
    </div>
  );
}
