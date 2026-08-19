# G1 2026 Applicant Collection Form

## Purpose

Build the first applicant-facing collection flow on the web app home page. It collects the information represented by Appendix 01 of `g1 2026 circular.md` without submitting an application to the server yet.

## Guardrails

- The flow is collection-only. No API mutation, server save, or push action is wired in this phase.
- The final action is disabled until **9 September 2026**. The date gate is evaluated in the browser and is visible to applicants.
- Draft progress is allowed locally through Zustand `persist`, so a refresh or return visit can resume the form.
- Location is requested only after the applicant chooses the location step action. Browser permission denial must not block manual entry.
- Location data is stored as an explicit draft field (`latitude`, `longitude`, label/address, source), not inferred from an IP address.

## Form sequence

1. **Application location** — Search/manual location, map click/tap, and “use my location” using the browser Geolocation API. Show the selected point on OpenStreetMap tiles and reverse-geocode with Nominatim when available.
2. **Applicant** — Full name, name in Sinhala, gender, religion, medium of education, date of birth, and age at 31 January 2027.
3. **Parent or guardian** — Guardian role, full name, NIC, address, phone, and email.
4. **Residence** — Permanent and current addresses, telephone numbers, GN division, DS division, district, province, and electoral details.
5. **School preferences** — Requested schools in priority order and whether a nearer school could be accepted.
6. **Declaration** — Applicant/guardian declaration acknowledgement and consent to use the collected information for this intake.
7. **Review** — Read-only summary with edit links. The primary action remains blocked before the release date and is clearly labelled as unavailable during collection mode.

## State model

```text
Draft = {
  currentStep: 0..6,
  location: { label, address, latitude, longitude, source },
  applicant: {...},
  guardian: {...},
  residence: {...},
  schools: [{ name, priority }],
  declaration: {...},
  lastSavedAt: string | null
}
```

Zustand owns the draft and current step. TanStack Form owns field registration, validation, and step-local submission. On step advance, the valid step values are copied into the persisted draft. The persist key is namespaced for this circular and versioned for future schema changes.

## Validation and interaction

- Required fields are validated before advancing; errors are shown beside the relevant field and the first invalid field receives focus.
- Back navigation never discards values.
- Refresh restores the last step and values after hydration.
- Map selection is valid only when latitude and longitude are present; manual address text alone is not enough.
- Geolocation loading, permission denial, reverse-geocoding failure, and unavailable map tiles each have an inline recovery message.
- Keyboard users can operate every field and map action; the map has a text/manual fallback.

## Implementation structure

- `apps/web/src/routes/index.tsx`: route shell and form entry point.
- `apps/web/src/components/application/application-form.tsx`: wizard orchestration, TanStack Form, validation, and step rendering.
- `apps/web/src/components/application/location-step.tsx`: geolocation, OpenStreetMap display, marker selection, and reverse geocoding.
- `apps/web/src/lib/application-store.ts`: typed Zustand persisted draft.
- `apps/web/src/index.css`: application surface styling and responsive map/form layout.

## Deferred work

- Server/API persistence and applicant identity binding.
- Document uploads and supporting evidence.
- Official school directory lookup and postal/electoral validation.
- Final submission, confirmation number, and administrator workflow.
