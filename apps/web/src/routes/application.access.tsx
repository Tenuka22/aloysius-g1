import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aloysius-g1/ui/components/dialog";
import { Input } from "@aloysius-g1/ui/components/input";
import { Button } from "@aloysius-g1/ui/components/button";
import { AccessKeyQrImporter } from "@/components/application/access-key-qr";
import { normalizeDraft, useApplicationStore } from "@/lib/application-store";
import { client } from "@/utils/orpc";
import { useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/application/access")({ component: AccessPage });

function AccessPage() {
  const navigate = useNavigate();
  const search = Route.useSearch() as { key?: string; code?: string };
  const updateDraft = useApplicationStore((state) => state.updateDraft);
  const { t } = useTranslation();
  const [key, setKey] = useState(search.key ?? localStorage.getItem("aloysius-g1-application-key") ?? "");
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
    } catch { setFoundApplication(null); setError(t("access.error.sessionNotFound")); }
  };

  useEffect(() => { if (/^\d{2}[A-Z]{3}\d{3}$/.test(sessionCode)) void lookup(); }, []);

  const load = async () => {
    setError("");
    try {
      const normalized = key.trim();
      const normalizedCode = sessionCode.trim().toUpperCase();
      if (normalizedCode && !/^\d{2}[A-Z]{3}\d{3}$/.test(normalizedCode)) throw new Error(t("access.error.invalidSessionCode"));
      const result = await client.application.get({ accessKey: normalized });
      if (normalizedCode && result.sessionCode !== normalizedCode) throw new Error(t("access.error.keyMismatch"));
      localStorage.setItem("aloysius-g1-application-key", normalized);
      const savedKeys = JSON.parse(localStorage.getItem("aloysius-g1-application-keys") ?? "[]") as unknown;
      localStorage.setItem("aloysius-g1-application-keys", JSON.stringify([...new Set([...(Array.isArray(savedKeys) ? savedKeys : []), normalized])]));
      localStorage.setItem("aloysius-g1-application-session-code", result.sessionCode);
      updateDraft(normalizeDraft(result.data as any));
      await navigate({ to: "/application", search: { code: result.sessionCode, key: normalized } as never });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("access.error.keyNotFound"));
    }
  };

  return (
    <main className="min-h-svh grid content-center gap-4 p-8 max-w-[760px] mx-auto">
      <Dialog open>
        <DialogContent showCloseButton={false} className="max-w-[min(34rem,calc(100%-2rem))] gap-4">
          <DialogHeader>
            <DialogTitle>{t("access.title")}</DialogTitle>
            <DialogDescription>{t("access.description")}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              className="min-h-12 w-full font-mono"
              value={sessionCode}
              onChange={(event) => {
                const v = event.target.value.toUpperCase();
                setSessionCode(v);
                setFoundApplication(null);
                localStorage.setItem("aloysius-g1-application-session-code", v);
              }}
              placeholder={t("access.sessionPlaceholder")}
              autoComplete="off"
            />
            <Button variant="secondary" type="button" disabled={!sessionCode.trim()} onClick={() => void lookup()}>
              {t("access.findApplication")}
            </Button>
          </div>
          {foundApplication && (
            <p className="text-sm text-muted-foreground">
              {t("access.foundDescription", { applicantName: foundApplication.applicantName, status: foundApplication.status })}
            </p>
          )}
          <Input
            className="min-h-12 w-full font-mono"
            value={key}
            onChange={(event) => {
              setKey(event.target.value);
              localStorage.setItem("aloysius-g1-application-key", event.target.value);
            }}
            placeholder={t("access.privateKeyPlaceholder")}
            autoComplete="off"
            autoFocus
          />
          <AccessKeyQrImporter onKey={(v) => { setKey(v); localStorage.setItem("aloysius-g1-application-key", v); }} />
          {error && <p className="flex items-center gap-1 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" type="button" onClick={() => void navigate({ to: "/" })}>
              {t("access.cancel")}
            </Button>
            <Button type="button" disabled={!key.trim()} onClick={() => void load()}>
              {t("access.verifyAndLoad")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
