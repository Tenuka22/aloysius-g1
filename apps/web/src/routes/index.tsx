import { useEffect, useState } from "react";
import { consumeEventIterator } from "@orpc/client";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, KeyRound, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@aloysius-g1/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@aloysius-g1/ui/components/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@aloysius-g1/ui/components/alert-dialog";
import { client } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import { completionPercent } from "@/lib/completion";
import { clearActiveKey, getSavedKeys, removeSavedKey } from "@/lib/saved-keys";
import { AccessKeyQrImporter } from "@/components/application/access-key-qr";
import { AccessRecoveryDialog } from "@/components/application/access-recovery-dialog";

export const Route = createFileRoute("/")({ component: HomeComponent });

function HomeComponent() {
  const [keys, setKeys] = useState(getSavedKeys);
  const [records, setRecords] = useState<Record<string, { name: string; birthCertificateNumber: string; documents: number; sessionCode?: string; updatedAt?: string; completion: number; submitted: boolean; error?: string }>>({});
  const [removeKey, setRemoveKey] = useState<string | null>(null);
  const [applicationCount, setApplicationCount] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const createNewApplication = () => {
    clearActiveKey();
    window.location.assign("/application");
  };
  const removeApplication = (key: string) => {
    removeSavedKey(key);
    const remaining = getSavedKeys().filter((savedKey) => savedKey !== key);
    setKeys(remaining);
    setRemoveKey(null);
  };
  useEffect(() => {
    let cancelled = false;
    void Promise.all(keys.map(async (key) => {
      try {
        const result = await client.application.get({ accessKey: key });
        const data = result.data as { applicant?: { fullName?: string; birthCertificateNumber?: string }; documents?: unknown[] };
        return [key, { name: data.applicant?.fullName || "Unnamed applicant", birthCertificateNumber: data.applicant?.birthCertificateNumber || "Not provided", documents: Array.isArray(data.documents) ? data.documents.length : 0, sessionCode: result.sessionCode, updatedAt: String(result.updatedAt), completion: completionPercent(data), submitted: Boolean(result.submittedAt) }] as const;
      } catch (error) {
        if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
          const remaining = getSavedKeys().filter((savedKey) => savedKey !== key);
          localStorage.setItem("aloysius-g1-application-keys", JSON.stringify(getSavedKeys().filter((savedKey) => savedKey !== key)));
          if (localStorage.getItem("aloysius-g1-application-key") === key) localStorage.removeItem("aloysius-g1-application-key");
          setKeys(remaining);
        return [key, { name: "Removed locally", birthCertificateNumber: "", documents: 0, completion: 0, submitted: false, error: "No longer exists on the server" }] as const;
        }
        return [key, { name: "Unavailable", birthCertificateNumber: "", documents: 0, completion: 0, submitted: false, error: "Could not refresh from the database" }] as const;
      }
    })).then((entries) => { if (!cancelled) setRecords(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, [keys]);
  useEffect(() => { void authClient.getSession().then((result) => setIsAdmin(result.data?.user.role === "admin")); }, []);
  useEffect(() => {
    const controller = new AbortController();
    void client.application.count().then((result) => setApplicationCount(result.count)).catch(() => undefined);
    const cancel = consumeEventIterator(client.application.liveCount(undefined, { signal: controller.signal }), { onEvent: (event) => setApplicationCount(event.count), onError: () => undefined });
    return () => { controller.abort(); void cancel(); };
  }, []);
  return <main className="min-h-svh p-8" data-surface="g1-2026-application">
    <div className="max-w-[1200px] mx-auto grid gap-8">
      <section className="grid gap-4">
        <p className="text-primary font-bold tracking-widest uppercase text-xs">G1 2026 intake</p>
        <h1 className="text-3xl font-bold tracking-tight">Application dashboard</h1>
        <p className="text-muted-foreground max-w-[42rem]">Start a new application, continue an existing one, or manage saved records. All data is stored securely and synchronized with the school database.</p>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-5"><div className="text-4xl font-bold">{applicationCount ?? "—"}</div><div className="text-sm text-muted-foreground">Total applications</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-4xl font-bold">{keys.length}</div><div className="text-sm text-muted-foreground">Saved on this device</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-4xl font-bold">{keys.filter((k) => records[k]?.submitted).length}</div><div className="text-sm text-muted-foreground">Submitted</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-4xl font-bold">{keys.filter((k) => !records[k]?.submitted).length}</div><div className="text-sm text-muted-foreground">Drafts</div></CardContent></Card>
      </section>

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button type="button" className="w-full h-auto py-6 flex-col gap-2" onClick={createNewApplication}><Plus size={24} /> New application</Button>
          <Link className={buttonVariants({ variant: "secondary", className: "w-full h-auto py-6 flex-col gap-2" })} to="/application/access"><KeyRound size={24} /> Load with a key</Link>
          {isAdmin && <Link className={buttonVariants({ variant: "secondary", className: "w-full h-auto py-6 flex-col gap-2" })} to="/admin"><ShieldCheck size={24} /> Admin panel</Link>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AccessKeyQrImporter onKey={(importedKey) => window.location.assign(`/application/access?key=${encodeURIComponent(importedKey)}`)} />
          {keys[0] && <Button variant="outline" type="button" onClick={() => setRecoveryKey(keys[0])}><KeyRound size={17} /> Forget first key</Button>}
        </div>
      </section>

      {keys.length > 0 && <section className="grid gap-2.5 pt-6 border-t">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Your saved applications</h2>
            <p className="text-sm text-muted-foreground">Every application available with a saved access key is refreshed from the database.</p>
          </div>
          <span className="text-sm text-muted-foreground">{keys.length} {keys.length === 1 ? "application" : "applications"}</span>
        </div>
        <div className="grid gap-2.5">{keys.map((key) => {
          const record = records[key];
          return <Card key={key}>
            <Link className="contents" to="/application/access" search={{ key, code: record?.sessionCode }}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="truncate">{record?.name || "Loading application…"}</span>
                  <ArrowRight size={19} className="shrink-0 text-muted-foreground" />
                </CardTitle>
                <CardDescription className="flex items-center justify-between">
                  <span>{record?.submitted ? "Submitted" : `${record?.completion ?? 0}% complete`}</span>
                  <span>{record?.submitted ? <CheckCircle2 size={15} /> : `${record?.documents ?? 0} documents`}</span>
                </CardDescription>
                <CardAction>
                  <Button variant="ghost" size="icon-sm" type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRemoveKey(key); }}><Trash2 size={16} /></Button>
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-1.5">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${record?.completion ?? 0}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{record?.error || (record?.updatedAt ? `Updated ${new Date(record.updatedAt).toLocaleString()}` : "Refreshing from database…")}</p>
                <p className="text-xs text-muted-foreground">{record?.sessionCode || "Finding session code…"}</p>
              </CardContent>
            </Link>
          </Card>;
        })}</div>
      </section>}
      <AccessRecoveryDialog applicantName={recoveryKey ? records[recoveryKey]?.name : undefined} open={Boolean(recoveryKey)} onOpenChange={(open) => { if (!open) setRecoveryKey(null); }} onForgot={() => { if (!recoveryKey) return; const forgottenKey = recoveryKey; const remaining = keys.filter((key) => key !== forgottenKey); localStorage.setItem("aloysius-g1-application-keys", JSON.stringify(remaining)); if (localStorage.getItem("aloysius-g1-application-key") === forgottenKey) localStorage.removeItem("aloysius-g1-application-key"); setKeys(remaining); setRecoveryKey(null); }} />
      <AlertDialog open={removeKey !== null} onOpenChange={(open) => { if (!open) setRemoveKey(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Forget this application key?</AlertDialogTitle><AlertDialogDescription>This removes the key from this device only. The application remains safely stored in the database and can be loaded again with its session code and access key.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (removeKey) removeApplication(removeKey); }}>Forget key</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  </main>;
}
