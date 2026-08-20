import { useEffect, useMemo, useState } from "react";
import { Check, CircleAlert, MapPin, Save, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CircleMarker, MapContainer, Marker, TileLayer } from "react-leaflet";
import { divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { client, orpc } from "@/utils/orpc";
import { emptyDraft, normalizeDraft, type ApplicationDraft, type LocationDraft } from "@/lib/application-store";
import { toast } from "sonner";

const sections = [
  ["applicant", "Applicant"],
  ["guardian", "Parent / guardian"],
  ["residence", "Residence"],
  ["declaration", "Declaration"],
] as const;

const selectedLocationIcon = divIcon({ className: "admin-selected-pin", html: "<span></span>", iconSize: [22, 22], iconAnchor: [11, 11] });

function Value({ label, value }: { label: string; value: unknown }) {
  const text = value === null || value === undefined || value === "" ? "Not provided" : String(value);
  return <div className="admin-value"><span>{label}</span><strong className={text === "Not provided" ? "empty-value" : ""}>{text}</strong></div>;
}

function LocationSummary({ label, value }: { label: string; value?: LocationDraft }) {
  return <div className="admin-location-summary"><div className="admin-location-title"><MapPin size={16} /><strong>{label}</strong></div><Value label="Label" value={value?.label} /><Value label="Address" value={value?.address} /><Value label="Coordinates" value={value?.latitude != null && value?.longitude != null ? `${value.latitude}, ${value.longitude}` : "Not captured"} /></div>;
}

function AdminLocationMap({ browser, selected, editable = false, onSelectedChange }: { browser?: LocationDraft; selected?: LocationDraft; editable?: boolean; onSelectedChange?: (latitude: number, longitude: number) => void }) {
  const browserPoint = browser?.latitude != null && browser?.longitude != null ? [browser.latitude, browser.longitude] as [number, number] : null;
  const selectedPoint = selected?.latitude != null && selected?.longitude != null ? [selected.latitude, selected.longitude] as [number, number] : null;
  const center = selectedPoint ?? browserPoint ?? [7.8731, 80.7718] as [number, number];
  return <div className="admin-location-map-wrap"><MapContainer center={center} zoom={selectedPoint || browserPoint ? 13 : 7} scrollWheelZoom className="admin-location-map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{browserPoint && <CircleMarker center={browserPoint} radius={10} pathOptions={{ color: "#2563eb", fillColor: "#60a5fa", fillOpacity: .9, weight: 3 }} />}{selectedPoint && (editable ? <Marker icon={selectedLocationIcon} draggable position={selectedPoint} eventHandlers={{ dragend: (event) => { const point = event.target.getLatLng(); onSelectedChange?.(point.lat, point.lng); } }} /> : <CircleMarker center={selectedPoint} radius={10} pathOptions={{ color: "#087f5b", fillColor: "#13b77e", fillOpacity: .9, weight: 3 }} />)}</MapContainer><div className="admin-map-legend"><span><i className="admin-map-dot browser" /> Browser location</span><span><i className="admin-map-dot selected" /> {editable ? "Drag to edit selected location" : "Selected / edited location"}</span></div></div>;
}

export function AdminApplicationView({ id }: { id: string }) {
  const detail = useQuery(orpc.admin.application.get.queryOptions({ input: { id } }));
  const [active, setActive] = useState("overview");
  const record = detail.data?.data as ApplicationDraft | undefined;
  const data = record ? normalizeDraft(record) : emptyDraft;
  const metadata = detail.data;
  const section = active === "overview" ? null : (data as unknown as Record<string, unknown>)[active];

  return <main className="admin-shell admin-detail-page">
    <AdminHeader title="Application details" description="Review the submitted record in a readable format. Raw JSON is kept out of the workflow." status="Database record" />
    {detail.isLoading && <section className="admin-card"><p>Loading application…</p></section>}
    {detail.isError && <section className="admin-card admin-error"><CircleAlert size={18} /> Could not load application: {detail.error.message}</section>}
    {record && <section className="admin-card admin-record-card">
      <div className="admin-record-identity"><div><p className="form-kicker">{data.applicant.fullName || "Unnamed applicant"}</p><h2>G1 2026 application</h2></div><span className={`admin-status ${metadata?.submittedAt ? "submitted" : "draft"}`}>{metadata?.submittedAt ? "submitted" : "draft"}</span></div>
      <div className="admin-record-meta"><span>Created {new Date(metadata?.createdAt ?? "").toLocaleString()}</span><span>Updated {new Date(metadata?.updatedAt ?? "").toLocaleString()}</span></div>
      <nav className="admin-detail-tabs" aria-label="Application sections"><button className={active === "overview" ? "active" : ""} type="button" onClick={() => setActive("overview")}>Overview</button>{sections.map(([key, label]) => <button key={key} className={active === key ? "active" : ""} type="button" onClick={() => setActive(key)}>{label}</button>)}<button className={active === "locations" ? "active" : ""} type="button" onClick={() => setActive("locations")}>Locations</button></nav>
      {active === "overview" && <div className="admin-overview-grid"><div><h3>Applicant</h3><Value label="Full name" value={data.applicant.fullName} /><Value label="Date of birth" value={data.applicant.dateOfBirth} /><Value label="Birth certificate" value={data.applicant.birthCertificateNumber} /></div><div><h3>Parent / guardian</h3><Value label="Name" value={data.guardian.fullName} /><Value label="Relationship" value={data.guardian.relationship} /><Value label="Phone" value={data.guardian.phone} /></div><div><h3>Residence</h3><Value label="District" value={data.residence.district} /><Value label="DS division" value={data.residence.dsDivision} /><Value label="GN division" value={data.residence.gnDivision} /></div><div><h3>Declaration</h3><Value label="Information confirmed" value={data.declaration.confirmed ? "Yes" : "No"} /><Value label="Consent given" value={data.declaration.consent ? "Yes" : "No"} /></div></div>}
      {active !== "overview" && active !== "locations" && <div className="admin-detail-section">{Object.entries((section ?? {}) as Record<string, unknown>).map(([key, value]) => <Value key={key} label={key.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())} value={typeof value === "boolean" ? value ? "Yes" : "No" : value} />)}</div>}
      {active === "locations" && <div className="admin-location-panel"><AdminLocationMap browser={data.defaultLocation} selected={data.selectedLocation.latitude != null ? data.selectedLocation : data.location} /><div className="admin-locations-grid"><LocationSummary label="Saved browser location" value={data.defaultLocation} /><LocationSummary label="Selected application location" value={data.selectedLocation.latitude != null ? data.selectedLocation : data.location} /></div></div>}
      <div className="admin-detail-actions"><a className="secondary-button" href="/admin/applications">Back to applications</a><a className="primary-button" href={`/admin/applications/${id}?mode=edit`}>Edit application</a></div>
    </section>}
  </main>;
}

export function AdminApplicationEditor({ id }: { id: string }) {
  const navigate = useNavigate();
  const detail = useQuery(orpc.admin.application.get.queryOptions({ input: { id } }));
  const [draft, setDraft] = useState<ApplicationDraft>(emptyDraft);
  const [saveState, setSaveState] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (detail.data?.data) setDraft(normalizeDraft(detail.data.data as Partial<ApplicationDraft>)); }, [detail.data?.data]);
  const set = (section: keyof ApplicationDraft, key: string, value: string | boolean) => setDraft((current) => ({ ...current, [section]: { ...(current[section] as object), [key]: value } }));
  const fields = useMemo(() => sections.filter(([key]) => key !== "declaration"), []);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveState("Saving…");
    try {
      await client.admin.application.update({ id, data: normalizeDraft(draft) });
      await detail.refetch();
      setSaveState("Saved just now");
      toast.success("Application changes saved");
      await navigate({ to: "/admin/applications/$id", params: { id } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save changes";
      setSaveState(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };
  if (detail.isLoading) return <main className="admin-shell admin-detail-page"><section className="admin-card"><p>Loading application…</p></section></main>;
  if (detail.isError) return <main className="admin-shell admin-detail-page"><section className="admin-card admin-error"><CircleAlert size={18} /> Could not load application: {detail.error.message}</section></main>;
  return <main className="admin-shell admin-detail-page"><AdminHeader title="Edit application" description="Make corrections directly to the saved record. Changes are applied to the database when you save." status="Admin edit mode" /><section className="admin-card admin-editor-card"><div className="admin-editor-intro"><div><p className="form-kicker">{draft.applicant.fullName || "Unnamed applicant"}</p><h2>Application information</h2></div>{saveState && <span className={saveState.startsWith("Could") ? "admin-save-error" : "admin-save-state"}>{saveState}</span>}</div>
    {fields.map(([key, label]) => <AdminFieldSection key={key} section={key} label={label} value={draft[key] as Record<string, unknown>} onChange={set} />)}
    <div className="admin-editor-section"><h3>Locations</h3><p className="admin-editor-help">Correct the captured browser point or the location selected by the applicant. Drag the green pin or edit the coordinates, then save.</p><AdminLocationMap editable browser={draft.defaultLocation} selected={draft.selectedLocation.latitude != null ? draft.selectedLocation : draft.location} onSelectedChange={(latitude, longitude) => setDraft((current) => ({ ...current, selectedLocation: { ...current.selectedLocation, latitude, longitude, source: "map" }, location: { ...current.location, latitude, longitude, source: "map" } }))} /><div className="admin-location-editor-grid"><AdminLocationEditor label="Saved browser location" value={draft.defaultLocation} onChange={(key, value) => setDraft((current) => ({ ...current, defaultLocation: { ...current.defaultLocation, [key]: value } }))} /><AdminLocationEditor label="Selected / edited location" value={draft.selectedLocation.latitude != null ? draft.selectedLocation : draft.location} onChange={(key, value) => setDraft((current) => ({ ...current, selectedLocation: { ...current.selectedLocation, [key]: value }, location: { ...current.location, [key]: value } }))} /></div></div>
    <div className="admin-editor-section"><h3>Declaration</h3><Toggle label="Information confirmed" checked={draft.declaration.confirmed} onChange={(value) => set("declaration", "confirmed", value)} /><Toggle label="Consent given" checked={draft.declaration.consent} onChange={(value) => set("declaration", "consent", value)} /></div>
    <div className="admin-detail-actions"><button className="secondary-button" type="button" disabled={saving} onClick={() => void navigate({ to: "/admin/applications/$id", params: { id } })}><X size={16} /> Cancel</button><button className="primary-button" type="button" disabled={saving} onClick={() => void save()}><Save size={16} /> {saving ? "Saving…" : "Save changes"}</button></div>
  </section></main>;
}

function AdminFieldSection({ section, label, value, onChange }: { section: keyof ApplicationDraft; label: string; value: Record<string, unknown>; onChange: (section: keyof ApplicationDraft, key: string, value: string | boolean) => void }) {
  return <div className="admin-editor-section"><h3>{label}</h3><div className="admin-editor-grid">{Object.entries(value).filter(([key]) => key !== "sameAsPermanent").map(([key, item]) => <label className="admin-field" key={key}><span>{key.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())}</span><input type={key === "dateOfBirth" ? "date" : key === "email" ? "email" : "text"} value={String(item ?? "")} onChange={(event) => onChange(section, key, event.target.value)} /></label>)}</div>{section === "residence" && <Toggle label="Current address is the same as permanent address" checked={Boolean(value.sameAsPermanent)} onChange={(checked) => onChange(section, "sameAsPermanent", checked)} />}</div>;
}

function AdminLocationEditor({ label, value, onChange }: { label: string; value: LocationDraft; onChange: (key: keyof LocationDraft, value: string | number | null) => void }) {
  return <div className="admin-location-editor"><h4>{label}</h4><label className="admin-field"><span>Label</span><input value={value.label} onChange={(event) => onChange("label", event.target.value)} /></label><label className="admin-field"><span>Address</span><input value={value.address} onChange={(event) => onChange("address", event.target.value)} /></label><div className="admin-editor-grid"><label className="admin-field"><span>Latitude</span><input type="number" step="any" value={value.latitude ?? ""} onChange={(event) => onChange("latitude", event.target.value === "" ? null : Number(event.target.value))} /></label><label className="admin-field"><span>Longitude</span><input type="number" step="any" value={value.longitude ?? ""} onChange={(event) => onChange("longitude", event.target.value === "" ? null : Number(event.target.value))} /></label></div></div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="admin-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{checked ? <Check size={14} /> : null}</span>{label}</label>; }
function AdminHeader({ title, description, status }: { title: string; description: string; status: string }) { return <div className="admin-topbar"><div><p className="form-kicker">Admin / Applications</p><h1>{title}</h1><p>{description}</p></div><span className="admin-live-status"><span /> {status}</span></div>; }
