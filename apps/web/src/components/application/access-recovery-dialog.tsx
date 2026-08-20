import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aloysius-g1/ui/components/dialog";
import { Input } from "@aloysius-g1/ui/components/input";
import { PhoneInput } from "@/components/application/phone-input";
import { client } from "@/utils/orpc";

export function AccessRecoveryDialog({ accessKey, applicantName, open, onOpenChange, onForgot }: { accessKey: string; applicantName?: string; open: boolean; onOpenChange: (open: boolean) => void; onForgot: () => void }) {
  const [name, setName] = useState(applicantName ?? "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    setMessage("");
    try {
      await client.application.requestAccess({ accessKey, applicantName: name, contactEmail: email, contactPhone: phone });
      onForgot();
      setMessage("Request sent. An administrator will contact you with a replacement key.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the admin request");
    } finally {
      setSaving(false);
    }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="access-recovery-dialog"><DialogHeader><DialogTitle>Forget this application key?</DialogTitle><DialogDescription>We will send the saved key to the administrator so they can verify the record and issue a replacement.</DialogDescription></DialogHeader><div className="access-recovery-form"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Applicant name" autoComplete="name" /><Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Contact email" type="email" autoComplete="email" /><PhoneInput value={phone} onChange={setPhone} /><button className="primary-button" type="button" disabled={saving || !name.trim() || !/^\S+@\S+\.\S+$/.test(email)} onClick={() => void submit()}>{saving ? "Sending request…" : "Forget key and request help"}</button>{message && <p className="field-help" role="status">{message}</p>}</div></DialogContent></Dialog>;
}
