import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aloysius-admissions/ui/components/dialog";
import { Input } from "@aloysius-admissions/ui/components/input";
import { Button } from "@aloysius-admissions/ui/components/button";
import { PhoneInput } from "@/components/g1/application/phone-input";
import { client } from "@/utils/orpc";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

type Mode = "session" | "identity";

export function AccessRecoveryDialog({ open, onOpenChange, onForgot }: { applicantName?: string; open: boolean; onOpenChange: (open: boolean) => void; onForgot: () => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("session");
  const [sessionCode, setSessionCode] = useState("");
  const [birthCertificateNumber, setBirthCertificateNumber] = useState("");
  const [guardianNic, setGuardianNic] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const hasIdentifier =
    mode === "session"
      ? Boolean(sessionCode.trim())
      : Boolean(birthCertificateNumber.trim() && guardianNic.trim());

  const canSubmit = hasIdentifier && Boolean(contactPhone.trim());

  const submit = async () => {
    setSaving(true);
    setMessage("");
    try {
      await client.application.requestAccess({
        ...(mode === "session"
          ? { sessionCode: sessionCode.trim() }
          : { birthCertificateNumber: birthCertificateNumber.trim(), guardianNic: guardianNic.trim() }),
        contactPhone,
        requestType: "forgot",
      });
      onForgot();
      toast.success(t("recovery.success"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("recovery.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(36rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>{t("recovery.title")}</DialogTitle>
          <DialogDescription>{t("recovery.descriptionCombined")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1 rounded-lg border p-1">
            <button
              type="button"
              onClick={() => setMode("session")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mode === "session" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t("recovery.methodSession")}
            </button>
            <button
              type="button"
              onClick={() => setMode("identity")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mode === "identity" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t("recovery.methodIdentity")}
            </button>
          </div>

          {mode === "session" && (
            <Input
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              placeholder={t("recovery.sessionPlaceholder")}
              autoComplete="off"
            />
          )}

          {mode === "identity" && (
            <>
              <Input
                value={birthCertificateNumber}
                onChange={(e) => setBirthCertificateNumber(e.target.value)}
                placeholder={t("recovery.birthPlaceholder")}
                autoComplete="off"
              />
              <Input
                value={guardianNic}
                onChange={(e) => setGuardianNic(e.target.value.toUpperCase())}
                placeholder={t("recovery.guardianNicPlaceholder")}
                autoComplete="off"
              />
            </>
          )}

          <div className="grid gap-1.5">
            <label className="text-sm font-semibold text-muted-foreground" htmlFor="recovery-phone">
              {t("recovery.phoneLabel")}
            </label>
            <PhoneInput value={contactPhone} onChange={setContactPhone} />
          </div>

          <Button type="button" disabled={saving || !canSubmit} onClick={() => void submit()}>
            {saving ? t("recovery.sending") : t("recovery.submit")}
          </Button>
          {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
