import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aloysius-g1/ui/components/dialog";
import { Input } from "@aloysius-g1/ui/components/input";
import { Button } from "@aloysius-g1/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aloysius-g1/ui/components/select";
import { PhoneInput } from "@/components/application/phone-input";
import { client } from "@/utils/orpc";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

export function AccessRecoveryDialog({ applicantName, open, onOpenChange, onForgot }: { applicantName?: string; open: boolean; onOpenChange: (open: boolean) => void; onForgot: () => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"session" | "birth" | "guardian">("session");
  const [name, setName] = useState(applicantName ?? "");
  const [birthCertificateNumber, setBirthCertificateNumber] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [guardianNic, setGuardianNic] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    setMessage("");
    try {
      await client.application.requestAccess({ birthCertificateNumber: mode === "birth" ? birthCertificateNumber.trim() || undefined : undefined, sessionCode: mode === "session" ? sessionCode.trim() || undefined : undefined, guardianNic: mode === "guardian" ? guardianNic.trim() || undefined : undefined, applicantName: name, contactPhone, requestType: "forgot" });
      onForgot();
      toast.success(t("recovery.success"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("recovery.error"));
    } finally {
      setSaving(false);
    }
  };
  const hasIdentifier = mode === "session" ? Boolean(sessionCode.trim()) : mode === "birth" ? Boolean(birthCertificateNumber.trim()) : Boolean(guardianNic.trim() && name.trim());
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-[min(36rem,calc(100%-2rem))]"><DialogHeader><DialogTitle>{t("recovery.title")}</DialogTitle><DialogDescription>{t("recovery.description")}</DialogDescription></DialogHeader><div className="grid gap-2"><label className="text-muted-foreground text-sm font-semibold" htmlFor="recovery-mode">{t("recovery.methodLabel")}</label><Select value={mode} onValueChange={(value) => setMode((value ?? "session") as typeof mode)}><SelectTrigger id="recovery-mode" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="session">{t("recovery.methodSession")}</SelectItem><SelectItem value="birth">{t("recovery.methodBirth")}</SelectItem><SelectItem value="guardian">{t("recovery.methodGuardian")}</SelectItem></SelectContent></Select>{mode === "session" && <Input value={sessionCode} onChange={(event) => setSessionCode(event.target.value.toUpperCase())} placeholder={t("recovery.sessionPlaceholder")} autoComplete="off" />}{mode === "birth" && <Input value={birthCertificateNumber} onChange={(event) => setBirthCertificateNumber(event.target.value)} placeholder={t("recovery.birthPlaceholder")} />}{mode === "guardian" && <><Input value={guardianNic} onChange={(event) => setGuardianNic(event.target.value.toUpperCase())} placeholder={t("recovery.guardianNicPlaceholder")} autoComplete="off" /><Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("recovery.applicantNamePlaceholder")} autoComplete="name" /></>}<label className="text-muted-foreground text-sm font-semibold" htmlFor="recovery-phone">{t("recovery.phoneLabel")}</label><PhoneInput value={contactPhone} onChange={setContactPhone} /><Button type="button" disabled={saving || !hasIdentifier || !contactPhone.trim()} onClick={() => void submit()}>{saving ? t("recovery.sending") : t("recovery.submit")}</Button>{message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}</div></DialogContent></Dialog>;
}
