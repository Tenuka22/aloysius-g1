import { useEffect, useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { ArrowLeft, ArrowRight, Check, Clock3, Copy, House, RotateCcw, ShieldCheck, UserPlus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { LocationStep } from "./location-step";
import { emptyDraft, useApplicationStore, type ApplicationDraft } from "@/lib/application-store";
import type { AdministrativeData } from "@/lib/administrative-data";
import { client } from "@/utils/orpc";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@aloysius-g1/ui/components/combobox";
import { Input } from "@aloysius-g1/ui/components/input";
import { Checkbox } from "@aloysius-g1/ui/components/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aloysius-g1/ui/components/select";
import { useQuery } from "@tanstack/react-query";

const steps = ["Location", "Applicant", "Parent / guardian", "Residence", "Declaration", "Review"];

function Field({ label, name, type = "text", placeholder, form, disabled = false }: { label: string; name: string; type?: string; placeholder?: string; form: any; disabled?: boolean }) {
  return <form.Field name={name}>{(field: any) => <div className="field-group"><label htmlFor={name}>{label}</label><Input id={name} name={name} type={type} value={field.state.value} placeholder={placeholder} disabled={disabled} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />{field.state.meta.errors?.length ? <p className="error-line">{field.state.meta.errors.join(", ")}</p> : null}</div>}</form.Field>;
}

const G1_DOB_CUTOFF = "2022-01-31";
function DateOfBirthField({ form, onChange }: { form: any; onChange?: (value: string) => void }) {
  return <form.Field name="applicant.dateOfBirth">{(field: any) => <div className="field-group"><label htmlFor="applicant.dateOfBirth">Date of birth</label><Input id="applicant.dateOfBirth" name="applicant.dateOfBirth" type="date" max={G1_DOB_CUTOFF} value={field.state.value} onBlur={field.handleBlur} onChange={(event) => { field.handleChange(event.target.value); onChange?.(event.target.value); }} /><p className="field-help">The child must be at least five years old by 31 January 2027.</p></div>}</form.Field>;
}

function SinhalaNameField({ form }: { form: any }) {
  return <form.Field name="applicant.sinhalaName">{(field: any) => <div className="field-group"><label htmlFor="applicant.sinhalaName">Name in Sinhala</label><Input id="applicant.sinhalaName" name="applicant.sinhalaName" value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} /><a className="keyboard-help-link" href="https://www.helakuru.lk/keyboard" target="_blank" rel="noreferrer">Need a Sinhala phonetic keyboard? Open Helakuru</a>{field.state.meta.errors?.length ? <p className="error-line">{field.state.meta.errors.join(", ")}</p> : null}</div>}</form.Field>;
}

const boysSchools = ["Select a boys’ school", "Ananda College", "Nalanda College", "Royal College", "D. S. Senanayake College"];
const girlsSchools = ["Select a girls’ school", "Visakha Vidyalaya", "Devi Balika Vidyalaya", "Sirimavo Bandaranaike Vidyalaya", "Musaeus College"];

function SelectField({ form, name, label, options, onChange }: { form: any; name: string; label: string; options: string[]; onChange?: (value: string) => void }) {
  return <form.Field name={name}>{(field: any) => <div className="field-group"><label htmlFor={name}>{label}</label><Select value={field.state.value || ""} onValueChange={(value) => { const next = String(value ?? ""); field.handleChange(next); onChange?.(next); }}><SelectTrigger id={name} className="w-full"><SelectValue placeholder={options[0]} /></SelectTrigger><SelectContent>{options.slice(1).map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>{field.state.meta.errors?.length ? <p className="error-line">{field.state.meta.errors.join(", ")}</p> : null}</div>}</form.Field>;
}

function ResidenceCombobox({ form, name, label, options, onChange, onInputValueChange }: { form: any; name: string; label: string; options: string[]; onChange?: (value: string) => void; onInputValueChange?: (value: string) => void }) {
  const items = options.map((value) => ({ value, label: value }));
  return <form.Field name={name}>{(field: any) => <div className="field-group"><label htmlFor={name}>{label}</label><Combobox items={items} value={field.state.value || ""} onInputValueChange={(value) => onInputValueChange?.(value)} onValueChange={(value) => { const next = typeof value === "object" && value ? (value as { value: string }).value : String(value ?? ""); field.handleChange(next); onChange?.(next); }}><ComboboxInput id={name} placeholder={`Search ${label.toLowerCase()}`} /><ComboboxContent><ComboboxEmpty>{options.length ? "No matches found." : "Type at least 2 characters to search."}</ComboboxEmpty><ComboboxList>{(item) => <ComboboxItem key={item.value} value={item}>{item.label}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox></div>}</form.Field>;
}


function ResidenceStep({ form, draft, setSection, administrativeData }: { form: any; draft: ApplicationDraft; setSection: (section: keyof ApplicationDraft, value: unknown) => void; administrativeData: AdministrativeData }) {
  const [sameAsPermanent, setSameAsPermanent] = useState(draft.residence.sameAsPermanent);
  const [districtSearch, setDistrictSearch] = useState("");
  const [dsSearch, setDsSearch] = useState("");
  const [gnSearch, setGnSearch] = useState("");
  const [electoralSearch, setElectoralSearch] = useState("");
  const filterOptions = (values: string[], search: string) => values.filter((value) => value.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  const districtQuery = useQuery({ queryKey: ["administrative", "districts", districtSearch.toLowerCase()], queryFn: async () => filterOptions(administrativeData.districts, districtSearch), enabled: districtSearch.trim().length >= 2, staleTime: 24 * 60 * 60 * 1000 });
  const dsQuery = useQuery({ queryKey: ["administrative", "ds-divisions", dsSearch.toLowerCase()], queryFn: async () => filterOptions(administrativeData.dsDivisions, dsSearch), enabled: dsSearch.trim().length >= 2, staleTime: 24 * 60 * 60 * 1000 });
  const gnQuery = useQuery({
    queryKey: ["administrative", "gn-divisions", gnSearch.toLowerCase()],
    queryFn: async () => administrativeData.gnDivisions.filter((value) => value.toLowerCase().includes(gnSearch.toLowerCase())).slice(0, 8),
    enabled: gnSearch.trim().length >= 2,
    staleTime: 24 * 60 * 60 * 1000,
  });
  const electoralQuery = useQuery({ queryKey: ["administrative", "electoral-districts", electoralSearch.toLowerCase()], queryFn: async () => filterOptions(administrativeData.districts, electoralSearch), enabled: electoralSearch.trim().length >= 2, staleTime: 24 * 60 * 60 * 1000 });

  const copyPermanent = (checked: boolean) => {
    setSameAsPermanent(checked);
    setSection("residence", { ...form.state.values.residence, sameAsPermanent: checked });
    if (checked) {
      const residence = form.state.values.residence;
      form.setFieldValue("residence.currentAddress", residence.permanentAddress);
      setSection("residence", { ...residence, currentAddress: residence.permanentAddress, sameAsPermanent: true });
    }
  };
  return <div className="fields-grid">
    <div className="step-copy full-span"><h3>Where does the family live?</h3><p>Provide the permanent residence first, then add current details if different. The circular requires residence to be supported by official documents and, where applicable, GN certification.</p></div>
    <Field form={form} name="residence.permanentAddress" label="Permanent address" placeholder="House number, street, town" />
    <Field form={form} name="residence.currentAddress" label="Current address" placeholder="Current address" disabled={sameAsPermanent} />
    <div className="field-group full-span"><label className="check-row"><Checkbox className="size-5" checked={sameAsPermanent} onCheckedChange={(checked) => copyPermanent(checked === true)} /> Current address is the same as permanent address</label></div>
    <ResidenceCombobox form={form} name="residence.district" label="District" options={districtQuery.data ?? []} onInputValueChange={setDistrictSearch} onChange={(value) => form.setFieldValue("residence.electoralDistrict", value)} />
    <ResidenceCombobox form={form} name="residence.dsDivision" label="Divisional Secretariat division" options={dsQuery.data ?? []} onInputValueChange={setDsSearch} />
    <ResidenceCombobox form={form} name="residence.gnDivision" label="Grama Niladhari division" options={gnQuery.data ?? []} onInputValueChange={setGnSearch} />
    <ResidenceCombobox form={form} name="residence.electoralDistrict" label="Electoral district" options={electoralQuery.data ?? []} onInputValueChange={setElectoralSearch} />
  </div>;
}

export function ApplicationForm({ administrativeData }: { administrativeData: AdministrativeData }) {
  const draft = useApplicationStore();
  const [hydrated, setHydrated] = useState(false);
  const [accessKey, setAccessKey] = useState(() => localStorage.getItem("aloysius-g1-application-key") ?? "");
  const [saveStatus, setSaveStatus] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [locationCanProceed, setLocationCanProceed] = useState(false);
  const navigate = useNavigate();
  const [collectionOnly, setCollectionOnly] = useState(import.meta.env.PROD);
  const form = useForm({ defaultValues: draft, onSubmit: ({ value }) => draft.updateDraft(value as Partial<ApplicationDraft>) });
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const key = localStorage.getItem("aloysius-g1-application-key");
      try {
        if (key) {
          const result = await client.application.get({ accessKey: key });
          if (!cancelled) {
            const latest = result.data as ApplicationDraft;
            draft.updateDraft(latest);
            form.reset(latest);
            setSavedSnapshot(JSON.stringify(latest));
          }
        }
        const status = await client.application.status();
        if (!cancelled) setCollectionOnly(status.submissionLocked);
      } catch {
        if (!cancelled) setCollectionOnly(import.meta.env.PROD);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, []);
  const progress = Math.round((draft.currentStep / (steps.length - 1)) * 100);
  const current = draft.currentStep;

  const setSection = (section: keyof ApplicationDraft, value: unknown) => draft.updateDraft({ [section]: value } as Partial<ApplicationDraft>);
  const saveToServer = async () => {
    const data = form.state.values as ApplicationDraft;
    setSaveStatus("Saving…");
    if (accessKey) await client.application.update({ accessKey, data });
    else { const result = await client.application.create({ data }); localStorage.setItem("aloysius-g1-application-key", result.accessKey); const keys = JSON.parse(localStorage.getItem("aloysius-g1-application-keys") ?? "[]") as string[]; localStorage.setItem("aloysius-g1-application-keys", JSON.stringify([...new Set([result.accessKey, ...keys])])); setAccessKey(result.accessKey); }
    setSavedSnapshot(JSON.stringify(data));
    setSaveStatus("Saved securely");
  };
  useEffect(() => {
    if (!hydrated || !accessKey || !savedSnapshot || JSON.stringify(form.state.values) === savedSnapshot) return;
    const timer = window.setTimeout(() => { void saveToServer(); }, 1500);
    return () => window.clearTimeout(timer);
  }, [accessKey, hydrated, savedSnapshot, JSON.stringify(form.state.values)]);
  const next = async () => { if (current === 0 && !locationCanProceed) return; await form.handleSubmit(); await saveToServer(); draft.setStep(Math.min(current + 1, steps.length - 1)); };
  const hasUnsavedChanges = !accessKey || JSON.stringify(form.state.values) !== savedSnapshot;
  const submitApplication = async () => { try { setSubmitError(""); let key = accessKey; if (!key || hasUnsavedChanges) { await saveToServer(); key = localStorage.getItem("aloysius-g1-application-key") ?? ""; } if (!key) return; setSaveStatus("Submitting…"); await client.application.submit({ accessKey: key }); setSaveStatus("Submitted"); setSubmitted(true); } catch (error) { setSaveStatus(""); setSubmitError(error instanceof Error ? error.message : "Could not submit the application. Please try again."); } };
  const startAnotherApplication = () => { localStorage.removeItem("aloysius-g1-application-key"); draft.reset(); window.location.assign("/application"); };
  const back = () => draft.setStep(Math.max(current - 1, 0));

  const reviewSections = useMemo(() => [
    ["Location", draft.location.address || "Not selected", 0],
    ["Applicant full name", draft.applicant.fullName || "Not completed", 1],
    ["Name in Sinhala", draft.applicant.sinhalaName || "Not completed", 1],
    ["Gender", draft.applicant.gender || "Not selected", 1],
    ["Religion", draft.applicant.religion || "Not selected", 1],
    ["Education medium", draft.applicant.educationMedium || "Not selected", 1],
    ["Date of birth", draft.applicant.dateOfBirth || "Not completed", 1],
    ["Birth certificate number", draft.applicant.birthCertificateNumber || "Not completed", 1],
    ["Relationship", draft.guardian.relationship || "Not selected", 2],
    ["Guardian name", draft.guardian.fullName || "Not completed", 2],
    ["Guardian NIC", draft.guardian.nic || "Not completed", 2],
    ["Phone number", draft.guardian.phone || "Not completed", 2],
    ["WhatsApp number", draft.guardian.whatsappPhone || "Not completed", 2],
    ["Guardian email", draft.guardian.email || "Not completed", 2],
    ["Permanent address", draft.residence.permanentAddress || "Not completed", 3],
    ["Current address", draft.residence.currentAddress || "Not completed", 3],
    ["District", draft.residence.district || "Not selected", 3],
    ["Divisional Secretariat division", draft.residence.dsDivision || "Not selected", 3],
    ["Grama Niladhari division", draft.residence.gnDivision || "Not selected", 3],
    ["Electoral district", draft.residence.electoralDistrict || "Not selected", 3],
  ], [draft]);

  if (!hydrated) return <div className="loading-state">Restoring your draft…</div>;
  return <main className="application-shell">
    <section className="application-intro"><div><p className="form-kicker">G1 2026 intake</p><h1>Applicant information</h1><p>Complete the details at your own pace. Your progress is saved securely and can be reopened with your application key.</p>{accessKey && <p className="application-key"><strong>Application key:</strong> <code>{accessKey}</code><br /><span>Do not lose this key. It is required to update and view your application.</span></p>}</div><div className="draft-badge"><ShieldCheck size={17} /> {accessKey ? "Saved to database" : "Draft saved locally"}</div></section>
    <section className="wizard-card" aria-label="Application form">
      <div className="progress-header"><div><p className="step-count">Step {current + 1} of {steps.length}</p><h2>{steps[current]}</h2></div><span>{progress}% complete</span></div>
      <div className="progress-track"><div style={{ width: `${Math.max(progress, 8)}%` }} /></div>
      <nav className="step-nav" aria-label="Form steps">{steps.map((step, index) => <button type="button" key={step} className={index === current ? "active" : index < current ? "done" : ""} onClick={() => index <= current && draft.setStep(index)}><span>{index < current ? <Check size={14} /> : index + 1}</span>{step}</button>)}</nav>
      <div className="step-content">
        {current === 0 && <><div className="step-copy"><h3>Start with the home location</h3><p>Your true browser location is saved first. You may then replace the selected application location with another point.</p></div><LocationStep value={draft.location ?? emptyDraft.location} defaultValue={draft.defaultLocation ?? emptyDraft.defaultLocation} onAvailabilityChange={setLocationCanProceed} onChange={(value, defaultValue) => { setSection("location", value); setSection("selectedLocation", value); if (defaultValue) setSection("defaultLocation", defaultValue); }} /></>}
        {current === 1 && <div className="fields-grid"><div className="step-copy full-span"><h3>Tell us about the applicant</h3><p>Use the name shown on the applicant’s birth certificate.</p></div><Field form={form} name="applicant.fullName" label="Full name" placeholder="Enter full name" /><SinhalaNameField form={form} /><SelectField form={form} name="applicant.gender" label="Gender" options={["Select gender", "Female", "Male"]} onChange={(value) => setSection("applicant", { ...draft.applicant, gender: value })} />{draft.applicant.gender === "Female" && <p className="error-line full-span">This is a boys’ school, so female applicants cannot continue with this application.</p>}<SelectField form={form} name="applicant.religion" label="Religion" options={["Select religion", "Catholic", "Christian", "Buddhist", "Islam"]} onChange={(value) => setSection("applicant", { ...draft.applicant, religion: value })} />{["Catholic", "Christian"].includes(draft.applicant.religion) && <p className="error-line full-span">This intake is not available to Catholic or Christian applicants.</p>}<SelectField form={form} name="applicant.educationMedium" label="Education medium" options={["Select medium", "Sinhala", "Tamil"]} onChange={(value) => setSection("applicant", { ...draft.applicant, educationMedium: value })} /><DateOfBirthField form={form} /><Field form={form} name="applicant.birthCertificateNumber" label="Birth certificate number" placeholder="Enter birth certificate number" /></div>}
        {current === 2 && <div className="fields-grid"><div className="step-copy full-span"><h3>Parent or guardian details</h3><p>We’ll use these details only to contact the family about this intake.</p></div><SelectField form={form} name="guardian.relationship" label="Relationship to applicant" options={["Select relationship", "Mother", "Father", "Guardian"]} /><Field form={form} name="guardian.fullName" label="Full name" /><Field form={form} name="guardian.nic" label="NIC number" /><Field form={form} name="guardian.phone" label="Phone number" type="tel" /><Field form={form} name="guardian.whatsappPhone" label="WhatsApp phone number" type="tel" /><Field form={form} name="guardian.email" label="Email address" type="email" /></div>}
        {current === 3 && <ResidenceStep form={form} draft={draft} setSection={setSection} administrativeData={administrativeData} />}
        {current === 4 && <div className="declaration-panel"><div className="step-copy"><h3>Confirm before review</h3><p>This is a collection draft. Nothing will be submitted while collection mode is active.</p></div><label className="check-row"><Checkbox className="size-5" checked={draft.declaration.confirmed} onCheckedChange={(checked) => setSection("declaration", { ...draft.declaration, confirmed: checked === true })} /> I confirm that the information I provide is accurate to the best of my knowledge.</label><label className="check-row"><Checkbox className="size-5" checked={draft.declaration.consent} onCheckedChange={(checked) => setSection("declaration", { ...draft.declaration, consent: checked === true })} /> I consent to this information being used to prepare the G1 2026 intake application.</label></div>}
        {current === 5 && <div className="review-list"><div className="step-copy"><h3>Review your draft</h3><p>Check all collected information before the application submission step becomes available.</p></div>{reviewSections.map(([label, value, step]) => <div className="review-row" key={label}><div><span>{label}</span><strong>{value}</strong></div><button type="button" onClick={() => draft.setStep(Number(step))}>Edit</button></div>)}</div>}
      </div>
      <div className="wizard-footer">{submitError && <p className="error-line submit-error">{submitError}</p>}{submitted ? <div className="submission-actions"><strong>Application submitted successfully.</strong><div className="key-success"><span>Keep this application key safe. You need it to view or update this child’s application.</span><code>{accessKey}</code><button type="button" className="secondary-button" onClick={() => void navigator.clipboard?.writeText(accessKey)}><Copy size={16} /> Copy key</button></div><div className="footer-actions"><button type="button" className="secondary-button" onClick={() => void navigate({ to: "/" })}><House size={17} /> Back to home</button><button type="button" className="primary-button" onClick={startAnotherApplication}><UserPlus size={17} /> Apply for another child</button></div></div> : <>{draft.lastSavedAt && <span className="saved-time"><Check size={15} /> Saved locally</span>}<div className="footer-actions">{current > 0 && <button type="button" className="secondary-button" onClick={back}><ArrowLeft size={17} /> Back</button>}{current < steps.length - 1 ? <button type="button" className="primary-button" disabled={current === 1 && (draft.applicant.gender === "Female" || ["Catholic", "Christian"].includes(draft.applicant.religion) || !form.state.values.applicant.dateOfBirth || form.state.values.applicant.dateOfBirth > G1_DOB_CUTOFF || !form.state.values.applicant.birthCertificateNumber)} onClick={next}>Continue <ArrowRight size={17} /></button> : <button type="button" className="primary-button" disabled={collectionOnly || !draft.declaration.confirmed || !draft.declaration.consent || !hasUnsavedChanges} onClick={() => void submitApplication()}>{collectionOnly ? <><Clock3 size={17} /> Submission opens 9 Sep 2026</> : accessKey ? "Update application" : "Submit application"}</button>}</div></>}</div>
      {collectionOnly && <div className="collection-banner"><Clock3 size={18} /><div><strong>Collection mode is active</strong><span>Your draft stays on this device. Submission and server saving are disabled until 9 September 2026.</span></div><button type="button" className="reset-button" onClick={() => draft.reset()}><RotateCcw size={15} /> Clear draft</button></div>}
    </section>
  </main>;
}
