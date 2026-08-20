import { useEffect, useState } from "react";
import { consumeEventIterator } from "@orpc/client";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, KeyRound, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@aloysius-g1/ui/components/alert-dialog";
import { client } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import { AccessKeyQrImporter } from "@/components/application/access-key-qr";
import { AccessRecoveryDialog } from "@/components/application/access-recovery-dialog";

export const Route = createFileRoute("/")({ component: HomeComponent });

function getSavedKeys() {
  const stored = JSON.parse(localStorage.getItem("aloysius-g1-application-keys") ?? "[]") as unknown;
  const legacy = localStorage.getItem("aloysius-g1-application-key");
  return [...new Set([...(Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string") : []), ...(legacy ? [legacy] : [])])];
}

function completionPercent(data: any) {
  const checks = [
    Boolean(data.location?.address || data.location?.latitude != null),
    Boolean(data.applicant?.fullName && data.applicant?.gender && data.applicant?.religion && data.applicant?.educationMedium && data.applicant?.dateOfBirth && data.applicant?.birthCertificateNumber),
    Boolean(data.guardian?.relationship && data.guardian?.fullName && data.guardian?.nic && data.guardian?.phone && data.guardian?.email),
    Boolean(data.residence?.permanentAddress && data.residence?.district && data.residence?.dsDivision && data.residence?.gnDivision && data.residence?.electoralDistrict),
    Boolean(data.declaration?.confirmed && data.declaration?.consent),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function HomeComponent() {
  const [keys, setKeys] = useState(getSavedKeys);
  const [records, setRecords] = useState<Record<string, { name: string; birthCertificateNumber: string; documents: number; sessionCode?: string; updatedAt?: string; completion: number; submitted: boolean; error?: string }>>({});
  const [removeKey, setRemoveKey] = useState<string | null>(null);
  const [applicationCount, setApplicationCount] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const createNewApplication = () => {
    localStorage.removeItem("aloysius-g1-application-key");
    localStorage.removeItem("aloysius-g1-application-session-code");
    window.location.assign("/application");
  };
  const removeApplication = (key: string) => {
    const remaining = keys.filter((savedKey) => savedKey !== key);
    localStorage.setItem("aloysius-g1-application-keys", JSON.stringify(remaining));
    if (localStorage.getItem("aloysius-g1-application-key") === key) localStorage.removeItem("aloysius-g1-application-key");
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
  return <main className="application-landing" data-surface="g1-2026-application">
    <p className="form-kicker">G1 2026 intake</p>
    <h1>Start or continue an application</h1>
    <div className="application-count" aria-live="polite">{applicationCount === null ? "Checking application count…" : `${applicationCount} application${applicationCount === 1 ? "" : "s"} stored on the server`}</div>
    <p>Each child has a separate private application key. Keep each key safe so you can return and update that child’s application.</p>
    <div className="landing-actions"><button className="primary-button" type="button" onClick={createNewApplication}><Plus size={17} /> New application</button><Link className="secondary-button" to="/application/access"><KeyRound size={17} /> Load with a key</Link>{isAdmin && <Link className="secondary-button" to="/admin"><ShieldCheck size={17} /> Go to admin panel</Link>}<AccessKeyQrImporter onKey={(importedKey) => window.location.assign(`/application/access?key=${encodeURIComponent(importedKey)}`)} />{keys[0] && <button className="secondary-button" type="button" onClick={() => setRecoveryKey(keys[0])}><KeyRound size={17} /> Forget this key</button>}</div>
    {keys.length > 0 && <section className="saved-applications"><div className="saved-applications-heading"><div><h2>Your saved applications</h2><p>Every application available with a saved access key is refreshed from the database.</p></div><span className="saved-count">{keys.length} {keys.length === 1 ? "application" : "applications"}</span></div><div className="saved-application-list">{keys.map((key) => { const record = records[key]; return <div className="saved-application" key={key}><Link className="saved-application-link" to="/application/access" search={{ key, code: record?.sessionCode }}><div className="saved-application-heading"><span className="saved-application-icon"><KeyRound size={18} /></span><span><strong>{record?.name || "Loading application…"}</strong><small>{record?.sessionCode ? `Session code ${record.sessionCode}` : "Finding session code…"}</small></span></div><div className="saved-application-progress"><div className="saved-application-progress-label"><span>{record?.submitted ? "Submitted" : `${record?.completion ?? 0}% complete`}</span><span>{record?.submitted ? <CheckCircle2 size={15} /> : `${record?.documents ?? 0} documents`}</span></div><div className="saved-application-progress-track"><span style={{ width: `${record?.completion ?? 0}%` }} /></div><small>{record?.error || (record?.updatedAt ? `Updated ${new Date(record.updatedAt).toLocaleString()}` : "Refreshing from database…")}</small></div><ArrowRight className="saved-application-arrow" size={19} /></Link><div className="saved-application-actions"><button className="remove-application" type="button" onClick={() => setRemoveKey(key)}><Trash2 size={16} /> Forget key</button></div></div>; })}</div></section>}
    <AccessRecoveryDialog applicantName={recoveryKey ? records[recoveryKey]?.name : undefined} open={Boolean(recoveryKey)} onOpenChange={(open) => { if (!open) setRecoveryKey(null); }} onForgot={() => { if (!recoveryKey) return; const forgottenKey = recoveryKey; const remaining = keys.filter((key) => key !== forgottenKey); localStorage.setItem("aloysius-g1-application-keys", JSON.stringify(remaining)); if (localStorage.getItem("aloysius-g1-application-key") === forgottenKey) localStorage.removeItem("aloysius-g1-application-key"); setKeys(remaining); setRecoveryKey(null); }} />
    <AlertDialog open={removeKey !== null} onOpenChange={(open) => { if (!open) setRemoveKey(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Forget this application key?</AlertDialogTitle><AlertDialogDescription>This removes the key from this device only. The application remains safely stored in the database and can be loaded again with its session code and access key.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (removeKey) removeApplication(removeKey); }}>Forget key</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}
