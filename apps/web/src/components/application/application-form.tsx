import { useEffect, useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { ArrowLeft, ArrowRight, Check, Clock3, RotateCcw, ShieldCheck } from "lucide-react";
import { LocationStep } from "./location-step";
import { emptyDraft, useApplicationStore, type ApplicationDraft } from "@/lib/application-store";

const RELEASE_DATE = new Date("2026-09-09T00:00:00+05:30");
const steps = ["Location", "Applicant", "Parent / guardian", "Residence", "Schools", "Declaration", "Review"];

function Field({ label, name, type = "text", placeholder, form }: { label: string; name: string; type?: string; placeholder?: string; form: any }) {
  return <form.Field name={name}>{(field: any) => <div className="field-group"><label htmlFor={name}>{label}</label><input id={name} name={name} type={type} value={field.state.value} placeholder={placeholder} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />{field.state.meta.errors?.length ? <p className="error-line">{field.state.meta.errors.join(", ")}</p> : null}</div>}</form.Field>;
}

export function ApplicationForm() {
  const draft = useApplicationStore();
  const [hydrated, setHydrated] = useState(false);
  const collectionOnly = new Date() < RELEASE_DATE;
  const form = useForm({ defaultValues: draft, onSubmit: ({ value }) => draft.updateDraft(value as Partial<ApplicationDraft>) });
  useEffect(() => { setHydrated(true); }, []);
  const progress = Math.round((draft.currentStep / (steps.length - 1)) * 100);
  const current = draft.currentStep;

  const setSection = (section: keyof ApplicationDraft, value: unknown) => draft.updateDraft({ [section]: value } as Partial<ApplicationDraft>);
  const next = () => { draft.setStep(Math.min(current + 1, steps.length - 1)); void form.handleSubmit(); };
  const back = () => draft.setStep(Math.max(current - 1, 0));

  const reviewSections = useMemo(() => [
    ["Location", draft.location.address || "Not selected"], ["Applicant", draft.applicant.fullName || "Not completed"], ["Parent / guardian", draft.guardian.fullName || "Not completed"], ["Residence", draft.residence.permanentAddress || "Not completed"], ["First school choice", draft.schools.firstChoice || "Not completed"],
  ], [draft]);

  if (!hydrated) return <div className="loading-state">Restoring your draft…</div>;
  return <main className="application-shell">
    <section className="application-intro"><div><p className="form-kicker">G1 2026 intake</p><h1>Applicant information</h1><p>Complete the details at your own pace. Your progress is saved on this device while this form is being prepared.</p></div><div className="draft-badge"><ShieldCheck size={17} /> Draft saved locally</div></section>
    <section className="wizard-card" aria-label="Application form">
      <div className="progress-header"><div><p className="step-count">Step {current + 1} of {steps.length}</p><h2>{steps[current]}</h2></div><span>{progress}% complete</span></div>
      <div className="progress-track"><div style={{ width: `${Math.max(progress, 8)}%` }} /></div>
      <nav className="step-nav" aria-label="Form steps">{steps.map((step, index) => <button type="button" key={step} className={index === current ? "active" : index < current ? "done" : ""} onClick={() => index <= current && draft.setStep(index)}><span>{index < current ? <Check size={14} /> : index + 1}</span>{step}</button>)}</nav>
      <div className="step-content">
        {current === 0 && <><div className="step-copy"><h3>Start with the home location</h3><p>Place the pin first, then continue with the applicant’s details.</p></div><LocationStep value={draft.location} onChange={(value) => setSection("location", value)} /></>}
        {current === 1 && <div className="fields-grid"><div className="step-copy full-span"><h3>Tell us about the applicant</h3><p>Use the name shown on the applicant’s birth certificate.</p></div><Field form={form} name="applicant.fullName" label="Full name" placeholder="Enter full name" /><Field form={form} name="applicant.sinhalaName" label="Name in Sinhala" /><Field form={form} name="applicant.gender" label="Gender" /><Field form={form} name="applicant.religion" label="Religion" /><Field form={form} name="applicant.educationMedium" label="Education medium" placeholder="Sinhala / Tamil / English" /><Field form={form} name="applicant.dateOfBirth" label="Date of birth" type="date" /></div>}
        {current === 2 && <div className="fields-grid"><div className="step-copy full-span"><h3>Parent or guardian details</h3><p>We’ll use these details only to contact the family about this intake.</p></div><Field form={form} name="guardian.relationship" label="Relationship to applicant" /><Field form={form} name="guardian.fullName" label="Full name" /><Field form={form} name="guardian.nic" label="NIC number" /><Field form={form} name="guardian.phone" label="Phone number" type="tel" /><Field form={form} name="guardian.email" label="Email address" type="email" /></div>}
        {current === 3 && <div className="fields-grid"><div className="step-copy full-span"><h3>Where does the family live?</h3><p>Provide the permanent residence first, then add current details if different.</p></div><Field form={form} name="residence.permanentAddress" label="Permanent address" placeholder="House number, street, town" /><Field form={form} name="residence.currentAddress" label="Current address" /><Field form={form} name="residence.district" label="District" /><Field form={form} name="residence.dsDivision" label="Divisional Secretariat division" /><Field form={form} name="residence.gnDivision" label="Grama Niladhari division" /><Field form={form} name="residence.electoralDistrict" label="Electoral district" /></div>}
        {current === 4 && <div className="fields-grid"><div className="step-copy full-span"><h3>Choose preferred schools</h3><p>List your choices in order of preference. You can update this later.</p></div><Field form={form} name="schools.firstChoice" label="First choice" placeholder="School name" /><Field form={form} name="schools.secondChoice" label="Second choice" placeholder="School name" /><div className="field-group full-span"><label>Would you accept a nearby school?</label><div className="choice-row"><label><input type="radio" name="nearby" value="yes" checked={draft.schools.acceptNearby === "yes"} onChange={() => setSection("schools", { ...draft.schools, acceptNearby: "yes" })} /> Yes</label><label><input type="radio" name="nearby" value="no" checked={draft.schools.acceptNearby === "no"} onChange={() => setSection("schools", { ...draft.schools, acceptNearby: "no" })} /> No</label></div></div></div>}
        {current === 5 && <div className="declaration-panel"><div className="step-copy"><h3>Confirm before review</h3><p>This is a collection draft. Nothing will be submitted while collection mode is active.</p></div><label className="check-row"><input type="checkbox" checked={draft.declaration.confirmed} onChange={(event) => setSection("declaration", { ...draft.declaration, confirmed: event.target.checked })} /> I confirm that the information I provide is accurate to the best of my knowledge.</label><label className="check-row"><input type="checkbox" checked={draft.declaration.consent} onChange={(event) => setSection("declaration", { ...draft.declaration, consent: event.target.checked })} /> I consent to this information being used to prepare the G1 2026 intake application.</label></div>}
        {current === 6 && <div className="review-list"><div className="step-copy"><h3>Review your draft</h3><p>Check the key details before the application submission step becomes available.</p></div>{reviewSections.map(([label, value], index) => <div className="review-row" key={label}><div><span>{label}</span><strong>{value}</strong></div><button type="button" onClick={() => draft.setStep(index)}>Edit</button></div>)}</div>}
      </div>
      <div className="wizard-footer">{draft.lastSavedAt && <span className="saved-time"><Check size={15} /> Saved locally</span>}<div className="footer-actions">{current > 0 && <button type="button" className="secondary-button" onClick={back}><ArrowLeft size={17} /> Back</button>}{current < steps.length - 1 ? <button type="button" className="primary-button" onClick={next}>Continue <ArrowRight size={17} /></button> : <button type="button" className="primary-button" disabled={collectionOnly || !draft.declaration.confirmed || !draft.declaration.consent}>{collectionOnly ? <><Clock3 size={17} /> Submission opens 9 Sep 2026</> : "Submit application"}</button>}</div></div>
      {collectionOnly && <div className="collection-banner"><Clock3 size={18} /><div><strong>Collection mode is active</strong><span>Your draft stays on this device. Submission and server saving are disabled until 9 September 2026.</span></div><button type="button" className="reset-button" onClick={() => draft.reset()}><RotateCcw size={15} /> Clear draft</button></div>}
    </section>
  </main>;
}
