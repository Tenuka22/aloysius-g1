import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aloysius-g1/ui/components/dialog";
import { Input } from "@aloysius-g1/ui/components/input";
import { client } from "@/utils/orpc";
import { normalizeDraft, useApplicationStore } from "@/lib/application-store";

export const Route = createFileRoute("/application/access")({ component: AccessPage });

function AccessPage() {
  const navigate = useNavigate();
  const search = Route.useSearch() as { key?: string };
  const updateDraft = useApplicationStore((state) => state.updateDraft);
  const [key, setKey] = useState(search.key ?? "");
  const [error, setError] = useState("");
  const load = async () => {
    setError("");
    try {
      const normalized = key.trim();
      const result = await client.application.get({ accessKey: normalized });
      const keys = JSON.parse(localStorage.getItem("aloysius-g1-application-keys") ?? "[]") as string[];
      localStorage.setItem("aloysius-g1-application-keys", JSON.stringify([...new Set([normalized, ...keys])]));
      localStorage.setItem("aloysius-g1-application-key", normalized);
      updateDraft(normalizeDraft(result.data as any));
      await navigate({ to: "/application" });
    } catch { setError("That application key was not found. Check it and try again."); }
  };
  return <main className="access-page"><Dialog open><DialogContent showCloseButton={false} className="access-dialog"><DialogHeader><DialogTitle>Load an application</DialogTitle><DialogDescription>Enter the private key for the child’s application. We verify it before opening the form.</DialogDescription></DialogHeader><Input className="access-key-input" value={key} onChange={(event) => setKey(event.target.value)} placeholder="ALY-…" autoComplete="off" autoFocus />{error && <p className="error-line">{error}</p>}<div className="dialog-actions"><button className="secondary-button" type="button" onClick={() => void navigate({ to: "/" })}>Cancel</button><button className="primary-button" type="button" disabled={!key.trim()} onClick={() => void load()}>Verify and load</button></div></DialogContent></Dialog></main>;
}
