# G1 2026 Application Flow

## Purpose

Provide a persistent G1 2026 application flow for multiple children. Each child has a separate long-lived application key that can reopen, update, submit, or remove that child’s record.

## Current implementation

- The home page supports creating a new application, loading an application by key, and selecting any key saved on the device.
- Application records are stored in SQLite through `@api` and Drizzle.
- Access keys are generated with cryptographically secure random bytes; only their SHA-256 hashes are stored in the database.
- Drafts and application keys persist in `localStorage`.
- Opening an application refreshes its latest data from the database before displaying the form.
- Form changes are automatically synchronized to the database for an active key, with step navigation also saving explicitly.
- The home page displays the latest applicant status for each saved key and the live number of server-stored applications.
- Application removal uses shared alert dialogs. If the server cannot remove a record, its local key is still removed and the user is told that the server copy may remain. Keys already missing on the server are automatically pruned from local storage.

## Form sequence

1. **Application location** — Browser geolocation is requested automatically when available. Permission is required before continuing when the browser supports geolocation. If geolocation is unavailable, manual address or map selection is allowed. The true device location and user-selected location are stored separately.
2. **Applicant** — Full name, Sinhala name, gender, religion, education medium, date of birth, and birth certificate number.
3. **Parent or guardian** — Mother, Father, or Guardian; full name, NIC, phone, WhatsApp phone, and email.
4. **Residence** — Permanent/current addresses, same-address synchronization, district, DS division, GN division, and electoral district comboboxes backed by cached administrative data.
5. **Declaration** — Accuracy confirmation and consent.
6. **Review** — Complete read-only summary with working edit actions.

School preferences are intentionally excluded because this is a boys’ school and the school-selection step is not required.

## Validation and policy rules

- Female applicants cannot continue for this boys’ school.
- Catholic and Christian applicants cannot continue.
- Education medium is Sinhala or Tamil only.
- G1 date-of-birth validation uses the circular’s requirement: the child must be at least five years old by 31 January 2027.
- Birth certificate numbers are required and unique in the database.
- Submissions are locked in production until 9 September 2026.
- Submitted applications can be updated until 11 September 2026.
- Review shows `Submit application` for a new record and `Update application` for a saved record; the update action is disabled when no data changed.

## State and synchronization model

```text
ApplicationDraft = {
  currentStep,
  location,
  defaultLocation,
  selectedLocation,
  applicant,
  guardian,
  residence,
  declaration,
  lastSavedAt
}
```

Zustand owns the persisted local draft. TanStack Form owns field state. The active access key identifies the server record. Database refreshes replace the local draft with the latest server copy; debounced edits and step transitions sync local changes back to the server.

The home-page application count uses an oRPC `EventPublisher` and event iterator, publishing after application creation and deletion and consuming the stream as an SSE-style live update.

## Implementation structure

- `apps/web/src/routes/index.tsx`: home page, saved-key list, live count, and deletion dialogs.
- `apps/web/src/routes/application.tsx`: application route and administrative-data loader.
- `apps/web/src/routes/application.access.tsx`: verified application-key dialog and database load.
- `apps/web/src/components/application/application-form.tsx`: wizard, persistence, validation, synchronization, and review.
- `apps/web/src/components/application/location-step.tsx`: browser geolocation, map selection, true/selected location handling, and reverse geocoding.
- `apps/web/src/lib/application-store.ts`: typed Zustand persisted draft.
- `packages/api/src/routers/index.ts`: create/get/update/submit/remove/status procedures and live application-count event iterator.
- `packages/db/src/schema/applications.ts`: application record schema.
- `packages/db/src/migrations/`: application, birth-certificate uniqueness, and submission-state migrations.

## Deferred work

- Document upload/storage and displaying actual uploaded documents; the home page currently displays document metadata/count when present in the saved record.
- Cryptographic signing/integrity protection for the JSON payload beyond access-key authorization.
- Official school directory lookup and final electoral validation.
- Administrator review and notification workflow.
