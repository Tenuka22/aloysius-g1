import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aloysius-g1/ui/components/dialog";
import { Input } from "@aloysius-g1/ui/components/input";
import { client } from "@/utils/orpc";

export function AccessRecoveryDialog({ accessKey, applicantName, open, onOpenChange, onForgot }: { accessKey: string; applicantName?: string; open: boolean; onOpenChange: (open: boolean) => void; onForgot: () => void }) {
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
      await client.application.requestAccess({ accessKey, birthCertificateNumber: birthCertificateNumber.trim() || undefined, sessionCode: sessionCode.trim() || undefined, guardianNic: guardianNic.trim() || undefined, applicantName: name, contactEmail: email });
      onForgot();
      setMessage("Request sent. An administrator will contact you with a replacement key.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the admin request");
    } finally {
      setSaving(false);
    }
  };
  const hasIdentifier = Boolean(birthCertificateNumber.trim() || sessionCode.trim() || guardianNic.trim() || accessKey.trim());
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="access-recovery-dialog"><DialogHeader><DialogTitle>Forget this application key?</DialogTitle><DialogDescription>Give us any one of the birth certificate number, session code, or guardian NIC, together with your name and contact email, so an administrator can verify the record and help you access it again.</DialogDescription></DialogHeader><div className="access-recovery-form"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Applicant name" autoComplete="name" /><Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Contact email" type="email" autoComplete="email" /><Input value={birthCertificateNumber} onChange={(event) => setBirthCertificateNumber(event.target.value)} placeholder="Birth certificate number" /><Input value={sessionCode} onChange={(event) => setSessionCode(event.target.value.toUpperCase())} placeholder="Session code" autoComplete="off" /><Input value={guardianNic} onChange={(event) => setGuardianNic(event.target.value.toUpperCase())} placeholder="Guardian NIC" autoComplete="off" /><button className="primary-button" type="button" disabled={saving || !name.trim() || !/^\S+@\S+\.\S+$/.test(email) || !hasIdentifier} onClick={() => void submit()}>{saving ? "Sending request…" : "Forget key and request help"}</button>{message && <p className="field-help" role="status">{message}</p>}</div></DialogContent></Dialog>;
}
