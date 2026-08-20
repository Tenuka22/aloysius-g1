import { useEffect, useState } from "react";
import { consumeEventIterator } from "@orpc/client";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, KeyRound, Plus, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@aloysius-g1/ui/components/alert-dialog";
import { useApplicationStore } from "@/lib/application-store";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/")({ component: HomeComponent });

function getSavedKeys() {
  try {
    const saved = JSON.parse(localStorage.getItem("aloysius-g1-application-keys") ?? "[]") as string[];
    const legacy = localStorage.getItem("aloysius-g1-application-key");
    return [...new Set(legacy ? [legacy, ...saved] : saved)];
  } catch { return []; }
}

function HomeComponent() {
  const [keys, setKeys] = useState(getSavedKeys);
  const [records, setRecords] = useState<Record<string, { name: string; birthCertificateNumber: string; documents: number; updatedAt?: string; error?: string }>>({});
  const [removeKey, setRemoveKey] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState(false);
  const [applicationCount, setApplicationCount] = useState<number | null>(null);
  const reset = useApplicationStore((state) => state.reset);
  const createNewApplication = () => {
    localStorage.removeItem("aloysius-g1-application-key");
    reset();
    window.location.assign("/application");
  };
  const removeApplication = async (key: string) => {
    const removeLocally = () => {
      const remaining = keys.filter((savedKey) => savedKey !== key);
      localStorage.setItem("aloysius-g1-application-keys", JSON.stringify(remaining));
      setKeys(remaining);
      if (localStorage.getItem("aloysius-g1-application-key") === key) localStorage.removeItem("aloysius-g1-application-key");
    };
    try {
      await client.application.remove({ accessKey: key });
      removeLocally();
      window.location.reload();
    } catch { removeLocally(); setRemoveError(true); window.setTimeout(() => window.location.reload(), 1400); }
  };
  useEffect(() => {
    let cancelled = false;
    void Promise.all(keys.map(async (key) => {
      try {
        const result = await client.application.get({ accessKey: key });
        const data = result.data as { applicant?: { fullName?: string; birthCertificateNumber?: string }; documents?: unknown[] };
        return [key, { name: data.applicant?.fullName || "Unnamed applicant", birthCertificateNumber: data.applicant?.birthCertificateNumber || "Not provided", documents: Array.isArray(data.documents) ? data.documents.length : 0, updatedAt: String(result.updatedAt) }] as const;
      } catch (error) {
        if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
          const remaining = getSavedKeys().filter((savedKey) => savedKey !== key);
          localStorage.setItem("aloysius-g1-application-keys", JSON.stringify(remaining));
          if (localStorage.getItem("aloysius-g1-application-key") === key) localStorage.removeItem("aloysius-g1-application-key");
          setKeys(remaining);
          return [key, { name: "Removed locally", birthCertificateNumber: "", documents: 0, error: "No longer exists on the server" }] as const;
        }
        return [key, { name: "Unavailable", birthCertificateNumber: "", documents: 0, error: "Could not refresh from the database" }] as const;
      }
    })).then((entries) => { if (!cancelled) setRecords(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const cancel = consumeEventIterator(client.application.liveCount(undefined, { signal: controller.signal }), { onEvent: (event) => setApplicationCount(event.count) });
    return () => { controller.abort(); void cancel(); };
  }, []);
  return <main className="application-landing" data-surface="g1-2026-application">
    <p className="form-kicker">G1 2026 intake</p>
    <h1>Start or continue an application</h1>
    <div className="application-count" aria-live="polite">{applicationCount === null ? "Checking application count…" : `${applicationCount} application${applicationCount === 1 ? "" : "s"} stored on the server`}</div>
    <p>Each child has a separate private application key. Keep each key safe so you can return and update that child’s application.</p>
    <div className="landing-actions"><button className="primary-button" type="button" onClick={createNewApplication}><Plus size={17} /> New application</button><Link className="secondary-button" to="/application/access"><KeyRound size={17} /> Load with a key</Link></div>
    {keys.length > 0 && <section className="saved-applications"><h2>Your saved applications</h2><p>Latest details are refreshed from the database for every saved key.</p>{keys.map((key) => { const record = records[key]; return <div className="saved-application" key={key}><Link className="saved-application-link" to="/application/access" search={{ key }}><span><KeyRound size={16} /><span><strong>{record?.name || "Loading application…"}</strong><small>Key ending in {key.slice(-6)} · {record?.documents ?? 0} documents · {record?.error || "Database synced"}</small></span></span><ArrowRight size={16} /></Link><button className="remove-application" type="button" onClick={() => setRemoveKey(key)}><Trash2 size={16} /> Remove</button></div>; })}</section>}
    <AlertDialog open={removeKey !== null} onOpenChange={(open) => { if (!open) setRemoveKey(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove this application?</AlertDialogTitle><AlertDialogDescription>This permanently removes the application from the database and this device. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (removeKey) void removeApplication(removeKey); setRemoveKey(null); }}>Remove application</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={removeError} onOpenChange={setRemoveError}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Removed from this device</AlertDialogTitle><AlertDialogDescription>The server could not remove the application, so it was removed from local storage only. The server copy may still exist.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Close</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}
