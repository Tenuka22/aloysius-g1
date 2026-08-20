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

## State audit and invariants

The application has four distinct state layers: route state (the active key and route), Zustand state (the persisted local draft), TanStack Form state (field editing), and server/database state (the authoritative saved record). The following invariants are now enforced:

- A database load is normalized before entering either Zustand or TanStack Form, so older records cannot leave missing nested fields or crash location/session UI.
- An invalid or deleted active key clears the active key and resets the local draft instead of silently showing another child’s stale data.
- Server saves merge the current TanStack Form values with the current Zustand draft, preserving location, declaration, selected/default location, and other non-form state.
- Autosave is debounced and only runs for an active server key; step transitions still await an explicit save before changing steps.
- The active key is separate from the list of saved keys, so creating another child cannot overwrite the current child’s session.
- A local removal fallback is explicit: the local key is removed even if the server is unavailable, and the user is told which copy may remain.
- Production submission locking is separate from draft persistence; collection mode no longer claims that server synchronization is disabled.

Remaining architectural risks are document storage/metadata, payload integrity signing, and cross-device key recovery. Those require a defined storage and trust model before implementation.

## Database-first draft sessions and cross-device recovery

The application must create its server record before requesting browser location or collecting form fields. The database is the source of truth for draft contents; browser storage may retain only the current session code and private access key.

- Starting a new application creates an empty server draft immediately and returns two credentials: a private access key for opening/editing the record and a memorable year-scoped session code in the form `26ABC123` (the intake year, three uppercase letters, and three digits).
- The session code is unique, indexed, and searchable. It identifies the draft/application record without exposing the access key. A public lookup may return only safe identifying metadata such as applicant name/status and whether an access key is still required.
- The access key remains the authorization token and is never stored in plaintext in the database. It may be entered manually or imported through the existing QR flow. The session code helps the applicant find the correct child/application before presenting the access key.
- Every meaningful form change and step transition saves to the database first. The user advances only after the save succeeds. Optional fields may remain empty and do not prevent a draft save; server-side validation is enforced when submitting.
- Reloading or changing devices uses the session code plus the access key/QR import to retrieve the latest server draft. Local storage contains only those two credentials, never a second copy of the draft or a registry of stale records.
- Draft creation and updates remain available outside the submission window. Submission is allowed only inside the configured published window. Editing a submitted application is allowed only within the configured edit window; outside it, the record is readable but locked.
- The home and access pages provide session-code lookup and access-key/QR recovery. The UI must make the distinction clear: the session code finds the record, while the access key authorizes access.

### Database/API changes

- Add a unique `session_code` column to `applications` and generate collision-safe `26ABC123` values server-side.
- Add `application.start`, `application.lookup`, and update `application.create/get/update` contracts so drafts can be created without a birth certificate and returned with their session code.
- Return the session code with authorized loads and show it in the application header; never return access-key hashes.
- Remove browser-local draft persistence; retain only the active session code and access key for resuming the server record.
- Keep the configured open/publish window separate from draft persistence and enforce read/edit/submit policy on the server.

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

## Admin panel observability plan

The authenticated admin area provides an operational view of the G1 application system. It is separate from the applicant flow and is restricted to the Better Auth admin role.

### Access and roles

- Add a dedicated admin route under the authenticated route group.
- Restrict the route and all admin procedures to users with the Better Auth admin role; an authenticated user without the admin role must receive `FORBIDDEN`.
- Keep applicant access-key procedures separate from authenticated admin procedures. Admins should not need or see applicants’ plaintext access keys.
- Use the existing site-admin bootstrap and Better Auth session as the source of identity and authorization.

### Admin overview

The overview should show:

- Total application records currently stored.
- Draft, submitted, and recently updated counts.
- Applications created and updated over time.
- Applications with incomplete required fields.
- Duplicate or rejected birth-certificate attempts, where safely measurable.
- Validation/error trends, such as invalid email addresses, missing phone numbers, invalid DOB, disallowed gender/religion, and missing location.
- Synchronization health: local-only activity cannot be observed by the server, while server saves, updates, submissions, and deletions can be counted and timestamped.

### Application inspection

- Show a searchable, paginated table of applications using safe metadata: record ID, applicant name, birth-certificate hint or masked value, status, created time, updated time, submitted time, and validation state.
- Never show plaintext access keys, passwords, or unnecessary private secrets.
- Open a detail view with the saved application sections, default/true location, selected location, and document metadata when documents exist.
- Record an audit trail for admin reads, edits, exports, and deletes if those actions are introduced.

### API and data integration

- Add authenticated admin-only API procedures for summary metrics, paginated application lists, application detail, and validation/error reports.
- Derive metrics from the `applications` table and structured application data rather than duplicating counts in the browser.
- Add explicit status/validation fields or a server-side validation result model if querying JSON data becomes too fragile.
- Publish admin metrics updates through the existing oRPC event-iterator pattern when application records are created, updated, submitted, or deleted.
- Keep the applicant event stream and admin event stream separate so application-count data is not accidentally exposed with private application details.

### Validation and data-quality reporting

- Validate email, phone, NIC, DOB, birth-certificate number, residence fields, location, and eligibility rules on the server as well as in the browser.
- Store normalized validation results and error codes, not raw invalid secrets or full request payloads.
- Make it clear whether an issue was detected during draft save, update, or submission.
- Treat a missing local key as a client synchronization issue; it must not be reported as an applicant validation failure.

### Admin UI structure

- `/_auth/admin`: protected admin shell and navigation.
- `/_auth/admin/index`: summary cards, trends, synchronization status, and recent activity.
- `/_auth/admin/applications`: searchable, sortable, filterable application list with view, edit, and delete actions.
- `/_auth/admin/applications/$id`: safe application detail and validation report.
- Shared admin loading, empty, error, and permission-denied states should use the existing UI components.

### Acceptance criteria

- A non-admin cannot access admin routes or admin procedures.
- An admin can see the number of applications and reconcile it with database state.
- An admin can identify incomplete applications and common invalid-email/data-quality issues without seeing access keys.
- Updates, submissions, deletions, and synchronization failures are distinguishable in the activity view.
- The admin view remains useful when there are zero applications, stale client keys, failed saves, or partially completed drafts.

### Implemented admin slice

- Added `adminProcedure`, requiring an authenticated Better Auth user with `role === "admin"`.
- Added admin overview and paginated/searchable application procedures.
- Added `/_auth/admin` with total, draft, submitted, incomplete, and invalid-email metrics.
- Added safe application metadata and validation issue counts without exposing plaintext access keys.
- Added recent activity and SSE live updates for create, update, submit, and delete events.
- Added responsive admin dashboard styling and permission-denied UI.
- Added the `/admin/applications` child route and rendered nested admin routes through the admin shell outlet.
- Added admin detail inspection for complete saved data, including default/device and user-selected locations.
- Added confirmation-protected admin editing and deletion with server-side admin procedures.
- Added table sorting and status/data-quality filtering.

Remaining admin work is persistent validation/audit records, document metadata, appeals, and richer time-series reporting.

## Appeals, disputes, and lost-key recovery

The admin panel must include a separate appeals queue for applicants who cannot safely resolve an application themselves.

### Appeal reasons

- Wrong child or incorrect applicant information was saved.
- A birth certificate number is already used by another application, but the applicant claims ownership or reports misuse.
- The applicant lost the application key.
- The applicant believes an application was created fraudulently or by mistake.
- The applicant needs an administrator to correct or remove a record.

### Applicant flow

- Add a public appeal form that accepts a contact method, child/applicant identifying details, birth-certificate details, appeal reason, explanation, and optional supporting-document metadata.
- Do not require the application key when the reason is “lost key,” but require enough information for manual identity verification.
- Never display or email the existing plaintext key automatically.
- Show a reference number after the appeal is created and tell the applicant that an administrator must verify ownership.
- Rate-limit appeals and avoid revealing whether a birth-certificate number exists to unauthenticated users.

### Admin workflow

- Add an admin appeals queue with status: `open`, `needs_verification`, `approved`, `rejected`, and `resolved`.
- Show the appeal, linked application metadata when a safe match exists, verification notes, and an audit history.
- Allow an admin to request more information, approve a correction, delete a wrongly created application, or close the appeal.
- For a verified lost key, issue a new one-time recovery key or rotate the application key; do not reveal the old key.
- For a birth-certificate conflict, allow the admin to place the conflicting application on hold while ownership is investigated. Deletion must require an explicit confirmation and audit entry.
- Every admin action must record who acted, when, the appeal reference, the target application ID, and the reason.

### Data and security boundaries

- Store only a hash of appeal recovery tokens and application keys.
- Keep appeals separate from application JSON so sensitive correspondence and verification state are queryable and auditable.
- Admin APIs must require the admin role and must never return access-key plaintext.
- Deleting an application must also revoke its active key and publish the application-count update.
- A key rotation must invalidate the previous key immediately and update all local-session guidance after the applicant loads the replacement key.

### Implemented duplicate birth-certificate and lost-key recovery

- Birth-certificate numbers are checked against existing database records before a new application is created.
- A matching number shows an existing-application notice instead of allowing a second student record.
- Applicants with their key can open the existing profile through the verified access-key route.
- Applicants without a key can submit a recovery request with their name and contact email.
- Admins can review open recovery requests, generate a replacement key once, or dismiss the request.
- Replacement keys rotate the stored hash so the previous key is immediately invalid.
- A saved matching key is detected locally and offers a direct profile-open action.
- Admins can display a generated replacement key as a QR code, and applicants can import that QR from `/` or `/application`.

### Acceptance criteria

- An applicant can submit a lost-key or wrong-record appeal without learning whether another person’s record exists.
- An admin can see, verify, resolve, reject, delete, or rotate a record through an auditable queue.
- A birth-certificate conflict cannot be solved by simply overwriting another application.
- Lost-key recovery produces a new secret rather than exposing the old one.
- Appeal and recovery actions are visible in admin activity reporting.
