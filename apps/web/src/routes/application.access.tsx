import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aloysius-g1/ui/components/dialog";
import { z } from "zod";
import { Input } from "@aloysius-g1/ui/components/input";
import { Button } from "@aloysius-g1/ui/components/button";
import { AccessKeyQrImporter } from "@/components/application/access-key-qr";
import { normalizeDraft, useApplicationStore } from "@/lib/application-store";
import { client } from "@/utils/orpc";
import { useTranslation } from "@/lib/i18n";
import { getActiveKey, getActiveSessionCode, setActiveApplication, setActiveKey, setActiveSessionCode } from "@/lib/saved-keys";

const accessSearchSchema = z.object({
  key: z.string().optional(),
  code: z.string().optional(),
});

export const Route = createFileRoute("/application/access")({
  validateSearch: accessSearchSchema,
  loaderDeps: ({ search }) => ({ code: search.code }),
  loader: async ({ deps }) => {
    const code = deps.code || getActiveSessionCode();
    if (!/^\d{2}[A-Z]{3}\d{3}$/.test(code)) {
      return { foundApplication: null };
    }
    try {
      const result = await client.application.lookup({ sessionCode: code });
      return { foundApplication: { applicantName: result.applicantName, status: result.status } };
    } catch {
      return { foundApplication: null };
    }
  },
  component: AccessPage,
});

function AccessPage() {
  const navigate = useNavigate();
  const search = Route.useSearch() as { key?: string; code?: string };
  const loaderData = Route.useLoaderData();
  const updateDraft = useApplicationStore((state) => state.updateDraft);
  const { t } = useTranslation();
  const [key, setKey] = useState(search.key ?? getActiveKey());
  const [sessionCode, setSessionCode] = useState(search.code ?? getActiveSessionCode());
  const [foundApplication, setFoundApplication] = useState<{ applicantName: string; status: string } | null>(loaderData.foundApplication);
  const [error, setError] = useState("");

  const lookup = async () => {
    setError("");
    try {
      const result = await client.application.lookup({ sessionCode: sessionCode.trim().toUpperCase() });
      setSessionCode(result.sessionCode);
      setFoundApplication({ applicantName: result.applicantName, status: result.status });
      setActiveSessionCode(result.sessionCode);
    } catch { setFoundApplication(null); setError(t("access.error.sessionNotFound")); }
  };

  const load = async () => {
    setError("");
    try {
      const normalized = key.trim();
      const normalizedCode = sessionCode.trim().toUpperCase();
      if (normalizedCode && !/^\d{2}[A-Z]{3}\d{3}$/.test(normalizedCode)) throw new Error(t("access.error.invalidSessionCode"));
      const result = await client.application.get({ accessKey: normalized });
      if (normalizedCode && result.sessionCode !== normalizedCode) throw new Error(t("access.error.keyMismatch"));
      setActiveApplication(normalized, result.sessionCode);
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
                setActiveSessionCode(v);
              }}
              placeholder={t("access.sessionPlaceholder")}
              autoComplete="off"
            />
            <Button variant="secondary" className="h-full min-h-12" type="button" disabled={!sessionCode.trim()} onClick={() => void lookup()}>
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
              setActiveKey(event.target.value);
            }}
            placeholder={t("access.privateKeyPlaceholder")}
            autoComplete="off"
            autoFocus
          />
          <AccessKeyQrImporter onKey={(v) => { setKey(v); setActiveKey(v); }} />
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
