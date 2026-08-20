import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@aloysius-g1/ui/components/drawer";
import { Input } from "@aloysius-g1/ui/components/input";
import { AccessKeyQrImporter } from "@/components/application/access-key-qr";
import { normalizeDraft, useApplicationStore } from "@/lib/application-store";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/application/access")({ component: AccessPage });

function AccessPage() {
  const navigate = useNavigate();
  const search = Route.useSearch() as { key?: string; code?: string };
  const updateDraft = useApplicationStore((state) => state.updateDraft);
  const [key, setKey] = useState(search.key ?? "");
  const [sessionCode, setSessionCode] = useState(search.code ?? localStorage.getItem("aloysius-g1-application-session-code") ?? "");
  const [foundApplication, setFoundApplication] = useState<{ applicantName: string; status: string } | null>(null);
  const [error, setError] = useState("");

  const lookup = async () => {
    setError("");
    try {
      const result = await client.application.lookup({ sessionCode: sessionCode.trim().toUpperCase() });
      setSessionCode(result.sessionCode);
      setFoundApplication({ applicantName: result.applicantName, status: result.status });
      localStorage.setItem("aloysius-g1-application-session-code", result.sessionCode);
    } catch { setFoundApplication(null); setError("That session code was not found."); }
  };

  useEffect(() => { if (/^\d{2}[A-Z]{3}\d{3}$/.test(sessionCode)) void lookup(); }, []);

  const load = async () => {
    setError("");
    try {
      const normalized = key.trim();
      const normalizedCode = sessionCode.trim().toUpperCase();
      if (!/^\d{2}[A-Z]{3}\d{3}$/.test(normalizedCode)) throw new Error("Enter the session code first");
      const result = await client.application.get({ accessKey: normalized });
      if (result.sessionCode !== normalizedCode) throw new Error("That access key does not match this session code");
      localStorage.setItem("aloysius-g1-application-key", normalized);
      const savedKeys = JSON.parse(localStorage.getItem("aloysius-g1-application-keys") ?? "[]") as unknown;
      localStorage.setItem("aloysius-g1-application-keys", JSON.stringify([...new Set([...(Array.isArray(savedKeys) ? savedKeys : []), normalized])]));
      localStorage.setItem("aloysius-g1-application-session-code", result.sessionCode);
      updateDraft(normalizeDraft(result.data as any));
      await navigate({ to: "/application", search: { code: result.sessionCode, key: normalized } as never });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "That application key was not found. Check it and try again.");
    }
  };

  return <main className="access-page"><Drawer open><DrawerContent showCloseButton={false} className="access-dialog"><DrawerHeader><DrawerTitle>Load an application</DrawerTitle><DrawerDescription>Find the child&apos;s application with the session code, then verify it with the private access key or QR code.</DrawerDescription></DrawerHeader><div className="access-code-row"><Input className="access-key-input" value={sessionCode} onChange={(event) => { setSessionCode(event.target.value.toUpperCase()); setFoundApplication(null); }} placeholder="26ABC123" autoComplete="off" /><button className="secondary-button" type="button" disabled={!sessionCode.trim()} onClick={() => void lookup()}>Find application</button></div>{foundApplication && <p className="field-help">{foundApplication.applicantName} · {foundApplication.status}. Enter the matching access key below.</p>}<Input className="access-key-input" value={key} onChange={(event) => setKey(event.target.value)} placeholder="Private access key" autoComplete="off" autoFocus /><AccessKeyQrImporter onKey={setKey} />{error && <p className="error-line">{error}</p>}<div className="dialog-actions"><button className="secondary-button" type="button" onClick={() => void navigate({ to: "/" })}>Cancel</button><button className="primary-button" type="button" disabled={!key.trim() || !foundApplication} onClick={() => void load()}>Verify and load</button></div></DrawerContent></Drawer></main>;
}
