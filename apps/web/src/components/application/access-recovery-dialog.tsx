import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aloysius-g1/ui/components/dialog";
import { Input } from "@aloysius-g1/ui/components/input";
import { client } from "@/utils/orpc";

export function AccessRecoveryDialog({ applicantName, open, onOpenChange, onForgot }: { applicantName?: string; open: boolean; onOpenChange: (open: boolean) => void; onForgot: () => void }) {
  const [mode, setMode] = useState<"session" | "birth" | "guardian">("session");
  const [name, setName] = useState(applicantName ?? "");
  const [email, setEmail] = useState("");
  const [birthCertificateNumber, setBirthCertificateNumber] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [guardianNic, setGuardianNic] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    setMessage("");
    try {
      await client.application.requestAccess({ birthCertificateNumber: mode === "birth" ? birthCertificateNumber.trim() || undefined : undefined, sessionCode: mode === "session" ? sessionCode.trim() || undefined : undefined, guardianNic: mode === "guardian" ? guardianNic.trim() || undefined : undefined, applicantName: name, contactEmail: email });
      onForgot();
      setMessage("Request sent. An administrator will contact you with a replacement key.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the admin request");
    } finally {
      setSaving(false);
    }
  };
  const hasIdentifier = mode === "session" ? Boolean(sessionCode.trim()) : mode === "birth" ? Boolean(birthCertificateNumber.trim()) : Boolean(guardianNic.trim() && name.trim());
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="access-recovery-dialog"><DialogHeader><DialogTitle>Forget this application key?</DialogTitle><DialogDescription>Choose one way to identify the submitted application. Draft applications cannot be recovered through this request.</DialogDescription></DialogHeader><div className="access-recovery-form"><label className="recovery-mode-label" htmlFor="recovery-mode">Recovery method</label><select id="recovery-mode" className="recovery-mode-select" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="session">Session code</option><option value="birth">Birth certificate number</option><option value="guardian">Guardian NIC and applicant name</option></select>{mode === "session" && <Input value={sessionCode} onChange={(event) => setSessionCode(event.target.value.toUpperCase())} placeholder="Session code" autoComplete="off" />}{mode === "birth" && <Input value={birthCertificateNumber} onChange={(event) => setBirthCertificateNumber(event.target.value)} placeholder="Birth certificate number" />}{mode === "guardian" && <Input value={guardianNic} onChange={(event) => setGuardianNic(event.target.value.toUpperCase())} placeholder="Guardian NIC" autoComplete="off" />}<Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Applicant name" autoComplete="name" /><Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Contact email" type="email" autoComplete="email" /><button className="primary-button" type="button" disabled={saving || !name.trim() || !/^\S+@\S+\.\S+$/.test(email) || !hasIdentifier} onClick={() => void submit()}>{saving ? "Sending request…" : "Forget key and request help"}</button>{message && <p className="field-help" role="status">{message}</p>}</div></DialogContent></Dialog>;
}
