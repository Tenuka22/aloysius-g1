# G1 2026 Application Flow

## Purpose

Provide a persistent G1 2026 application flow for multiple children. Each child has a separate long-lived application key that can reopen, update, submit, or remove that child’s record. Applications support multiple marking scheme categories (6.1, 6.4, 6.5, 6.6) per child, each with its own scoring inputs and school selection.

## Current implementation

- The home page supports creating a new application, loading an application by key, and selecting any key saved on the device.
- Application records are stored in SQLite through `@api` and Drizzle.
- Access keys are generated with cryptographically secure random bytes; only their SHA-256 hashes are stored in the database.
- Drafts and application keys persist in `localStorage`.
- Opening an application refreshes its latest data from the database before displaying the form.
- Form changes are automatically synchronized to the database for an active key, with step navigation also saving explicitly.
- The home page displays the latest applicant status for each saved key and the live number of server-stored applications.
- Application removal uses shared alert dialogs. If the server cannot remove a record, its local key is still removed and the user is told that the server copy may remain. Keys already missing on the server are automatically pruned from local storage.

## Form sequence (7 steps)

1. **Application location** – Browser geolocation is requested automatically whenever no saved latitude/longitude exists, whether for a new or an existing application (unless the user has manually set a location). Permission is required before continuing when the browser supports geolocation. If geolocation is unavailable, manual address or map selection is allowed. The map is always clickable regardless of geolocation permission status. The true device location and user-selected location are stored separately. The user-selected location (not the device location) is used as the center for school proximity calculations.
2. **Applicant** – Full name, Sinhala name, gender, religion, education medium, date of birth, and birth certificate number.
3. **Parent or guardian** – Mother, Father, or Guardian; full name, NIC, phone, WhatsApp phone, and email.
4. **Residence** – Permanent/current addresses, same-address synchronization, district, DS division, GN division, and electoral district comboboxes backed by cached administrative data.
5. **Categories** – Marking scheme category selection and per-category scoring inputs. User selects one or more categories (6.1, 6.4, 6.5, 6.6) and fills in the required scoring inputs for each. Each category includes a map-based school picker.
6. **Declaration** – Accuracy confirmation and consent.
7. **Review** – Complete read-only summary with working edit actions, including all category data.

School preferences remain excluded because this is a boys’ school; the category step replaces any generic school-selection concept.

## Category step (step index 4) – detailed design

### Phase A: Category picker

User sees checkboxes for four marking scheme categories. Any combination may be selected (unlimited). Each selected category expands into its own sub-form below the picker.

| Category | Name | Max Marks |
|----------|------|-----------|
| 6.1 | Residence Verification & Proximity | 100 |
| 6.4 | Period of Service & Distance | 100 |
| 6.5 | Transfer Applications | 100 |
| 6.6 | Foreign Employment & Proximity | 100 |

### Phase B: Per-category scoring inputs

Fields derive from `plans/g1-2026-marking-scheme.md`.

**6.1 – Residence Verification:**

- Main document type (dropdown: title deed applicant / title deed parents / lease deed / municipal or DS certificate / other documents)
- Years registered at residence (number)
- Additional documents (checkboxes: NIC, driving license, landline bill, marriage certificate, life insurance policy, school leaving certificate, child birth certificate, vehicle registration/license/insurance, bank passbook)
- Electoral register – mother years (0–5)
- Electoral register – father years (0–5)
- **Schools within radius** (map picker)

**6.4 – Period of Service:**

- Period of service years (number)
- Difficult service type (radio: currently working / previously worked / none)
- If previously worked: distance of permanent residence from place of first appointment (km number)
- Difficult service extra periods beyond one year (number of 6-month periods)
- Unutilized leave years with more than 20 days unused (count 0–5)
- Service location level (radio: same school / education zone or division / province / other education-related institution)
- Distance: permanent residence to applied school (km number)
- Distance: current workplace to applied school (km number)
- **Schools within radius** (map picker)

**6.5 – Transfer Applications:**

- Distance previous workplace to new workplace (km number)
- Period of service (years number)
- Period served at previous place of service (years number)
- Time elapsed since obtaining the transfer (years number)
- Unutilized leave years count (0–5)
- **Schools within radius** (map picker)

**6.6 – Foreign Employment:**

- Period spent abroad continuously with the child up to arrival (years number)
- Employment purpose (radio: board executive duties / personal employment / Sri Lankan government needs / education-professional development)
- **Schools within radius** (map picker)

### Phase C: School map picker (shared across categories)

A reusable Leaflet map component rendered at the bottom of each selected category sub-form.

Behavior:

- Map center = `selectedLocation` from step 0 (the user-selected location, never the device GPS location).
- A geographic `Circle` overlay shows the radius around the home point.
- Schools are plotted as clickable markers.
- Every school inside the radius is listed with a checkbox; all checkboxes are enabled because data can be wrong and users must be able to select or deselect anything.
- Clicking a marker toggles its checkbox.
- The selected-school count feeds the proximity formulas (6.1: 5 × count, max 50; 6.5: 3 × count, max 30; 6.6: 3.5 × count, max 35).
- Radius = home-to-school distances; the circle spans the furthest selectable school range with a sensible default (10 km) adjustable by the user.

School data source:

- Static `schools.ts` modeled after `divisions.ts`, covering government schools in the Galle and Matara districts.
- Each entry: id, name (en/si), latitude, longitude, genderType (boys/girls/mixed), schoolType (national/provincial/private), districtId, dsId.
- Coordinates are approximate reference points; users visually confirm positions on the map and control final selection.
- Haversine distance calculation filters schools by radius client-side; no API round-trips.

Scoring helpers live in `school-utils.ts` (haversineDistance, getSchoolsWithinRadius) so both the form and future server-side scoring can reuse them.

## Validation and policy rules

- Female applicants cannot continue for this boys’ school.
- Catholic and Christian applicants cannot continue.
- Education medium is Sinhala or Tamil only.
- G1 date-of-birth validation uses the circular’s requirement: the child must be at least five years old by 31 January 2027.
- Birth certificate numbers are required and unique among submitted applications. Multiple drafts may share a birth certificate number, but only one submitted application per number is allowed.
- Submissions are locked in production until 9 September 2026.
- Submitted applications can be updated until 11 September 2026.
- At least one category must be selected before advancing past the category step.
- Category scoring inputs stay optional while drafting; submission-time validation enforces required fields per selected category.
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
  categories: CategoryApplication[],
  declaration,
  lastSavedAt
}

CategoryApplication = {
  id: string,
  categoryType: "6.1" | "6.4" | "6.5" | "6.6",
  scoringInputs: {
    mainDocumentType?, documentOwnership?, yearsRegistered?,
    additionalDocs?: string[], electoralMotherYears?, electoralFatherYears?,
    schoolsWithinRadius?: string[], schoolsRadiusKm?,
    periodOfServiceYears?, difficultServiceType?: "current"|"previous"|"none",
    difficultServiceDistanceKm?, difficultServiceExtraPeriods?,
    unutilizedLeaveYears?, serviceLocationLevel?,
    residenceToSchoolKm?, workplaceToSchoolKm?,
    previousWorkplaceDistanceKm?, previousWorkplacePeriodYears?, transferElapsedYears?,
    periodAbroadYears?, employmentPurpose?: "board"|"personal"|"government"|"education"
  }
}
```

Zustand owns the persisted local draft. TanStack Form owns field state. The active access key identifies the server record. Database refreshes replace the local draft with the latest server copy; debounced edits and step transitions sync local changes back to the server.

Store helpers: `addCategory(type)` appends a normalized category with a fresh id, `removeCategory(id)` deletes it, and category sub-forms patch `scoringInputs` immutably.

The home-page application count uses an oRPC `EventPublisher` and event iterator, publishing after application creation and deletion and consuming the stream as an SSE-style live update.

## State audit and invariants

The application has four distinct state layers: route state (the active key and route), Zustand state (the persisted local draft), TanStack Form state (field editing), and server/database state (the authoritative saved record). Invariants:

- A database load is normalized before entering either Zustand or TanStack Form, so older records cannot leave missing nested fields or crash location/session UI.
- Categories are always normalized to an array on load; missing entries default to `[]` and malformed entries are dropped rather than crashing the wizard.
- Category ids are stable strings generated once at add-time so reordering or reloading does not duplicate or orphan selections.
- An invalid or deleted active key clears the active key and resets the local draft instead of silently showing another child’s stale data.
- Server saves merge the current TanStack Form values with the current Zustand draft, preserving location, declaration, categories, selected/default location, and other non-form state.
- Autosave is debounced and only runs for an active server key; step transitions still await an explicit save before changing steps.
- The active key is separate from the list of saved keys, so creating another child cannot overwrite the current child’s session.
- A local removal fallback is explicit: the local key is removed even if the server is unavailable, and the user is told which copy may remain.
- Production submission locking is separate from draft persistence; collection mode no longer claims that server synchronization is disabled.

Remaining architectural risks are document storage/metadata, payload integrity signing, and cross-device key recovery.

## Recent changes

### Auto-location request logic

`autoRequestLocation` fires whenever there is no saved latitude/longitude in the draft, regardless of whether the application is new or updating. The `!accessKey` guard was removed. The Next button at step 0 still checks `locationIsReady` via `getNextStepReason` so the user must confirm a location before advancing.

### Map always clickable

The map's `onSelect` handler no longer checks `permissionDenied`. Users can always click the map to place a location pin even after denying or ignoring browser geolocation permission.

### ORPCError for descriptive server errors

All user-facing `throw new Error(...)` calls in the API router (`packages/api/src/routers/index.ts`) were replaced with `throw new ORPCError(code, { message })` using codes like `CONFLICT`, `NOT_FOUND`, and `BAD_REQUEST`. This ensures error messages pass through to the client as human-readable strings instead of being swallowed as "Internal server error".

### Error display UI

The submit-error display in `application-form.tsx` was upgraded from a plain `<p>` to a styled card with a `TriangleAlert` warning icon and bordered container, using `break-words` for long messages.

### Location address text wrapping

The location step's address text and search input changed from `truncate` to `break-words` to handle long or unbreakable strings that previously overflowed their containers.

## Database-first draft sessions and cross-device recovery

The application creates its server record before requesting browser location or collecting form fields. The database is the source of truth for draft contents; browser storage retains only the current session code and private access key.

- Starting a new application creates an empty server draft immediately and returns two credentials: a private access key and a memorable year-scoped session code in the form `26ABC123`.
- The session code is unique, indexed, and searchable. A public lookup returns only safe identifying metadata.
- The access key remains the authorization token and is never stored plaintext. It may be entered manually or imported through the QR flow.
- Every meaningful form change and step transition saves to the database first; the user advances only after the save succeeds.
- Reloading or changing devices uses the session code plus the access key/QR import to retrieve the latest server draft.
- Draft creation and updates remain available outside the submission window. Submission is allowed only inside the configured published window.
- Category selections save with every autosave like any other draft section.

### Database/API changes

- None required for categories: the open `draftSchema` (`Record<string, unknown>`) accepts the new `categories` array inside the existing JSON `data` blob.
- `withoutSchoolPreferences()` strips a legacy `schools` key only; the new `categories` key passes through untouched.
- Existing create/get/update/submit contracts continue unchanged.

## Implementation structure

New files:

- `apps/web/src/lib/schools.ts`: static Galle + Matara district school dataset (id, names, coordinates, genderType, schoolType, districtId, dsId).
- `apps/web/src/lib/school-utils.ts`: haversine distance and radius filtering utilities with unit tests.
- `apps/web/src/components/application/category-step.tsx`: category picker plus per-category scoring-input sub-forms embedding the school map picker.
- `apps/web/src/components/application/school-map-picker.tsx`: Leaflet map centered on the user-selected location with a radius circle and selectable school markers/checkboxes.

Modified files:

- `apps/web/src/lib/application-store.ts`: add `CategoryApplication` type, `categories` field, CRUD helpers, and normalization defaults.
- `apps/web/src/lib/validation.ts`: Zod schemas for category payloads and the category step gate.
- `apps/web/src/components/application/application-form.tsx`: expand the wizard to seven steps inserting Categories at index 4; persist categories through the existing save pipeline.
- `apps/web/src/components/application/review-step.tsx` (or review section): render every selected category with its inputs, selected schools, and computed proximity counts.
- `apps/web/src/lib/eligibility.ts`: shift step indices for the inserted step and add the at-least-one-category rule.
- `apps/web/src/lib/completion.ts`: include category selection completeness in the percentage.
- `apps/web/src/components/admin/admin-application-editor.tsx`: render a categories tab listing per-category inputs and chosen schools; editable fields follow the existing auto-label convention.

Unchanged:

- `packages/api/*` and `packages/db/*` require no schema or contract changes.

## Implementation order

1. Data layer: `schools.ts`, `school-utils.ts` with haversine/radius helpers and tests.
2. State layer: store categories support, normalization, Zod validation schemas.
3. Components: `school-map-picker.tsx`, then `category-step.tsx`.
4. Wiring: wizard expansion, review rendering, eligibility/completion updates.
5. Admin: categories display/edit in the application detail view.
6. Verification: `bun run typecheck`, lint, and full vitest suite.

## Deferred work

- Document upload/storage and displaying actual uploaded documents.
- Cryptographic signing/integrity protection for the JSON payload beyond access-key authorization.
- Official verified school directory with authoritative coordinates; current dataset ships approximate reference points.
- Server-side scoring computation using the shared marking scheme rules.
- Administrator review/notification workflow enhancements.

## Admin panel observability plan

The authenticated admin area provides an operational view of the G1 application system, restricted to the Better Auth admin role.

### Access and roles

- Dedicated admin route under the authenticated route group.
- All admin procedures require the Better Auth admin role; others receive `FORBIDDEN`.
- Applicant access-key procedures stay separate; admins never see plaintext access keys.

### Admin overview

- Total application records currently stored.
- Draft, submitted, and recently updated counts.
- Applications created and updated over time.
- Applications with incomplete required fields.
- Duplicate or rejected birth-certificate attempts where safely measurable.
- Validation/error trends such as invalid email addresses, missing phones, invalid DOB, disallowed gender/religion, missing location.
- Category distribution: applications per marking scheme category (6.1, 6.4, 6.5, 6.6).
- Synchronization health distinguishing unobservable local-only activity from counted server saves, updates, submissions, and deletions.

### Application inspection

- Searchable, paginated table with safe metadata: record ID, applicant name, masked birth-certificate hint, status, categories applied, created/updated/submitted times, validation state.
- Never show plaintext access keys, passwords, or unnecessary private secrets.
- Detail view includes saved sections, default/true and selected locations, per-category inputs, selected schools, and document metadata when present.
- Audit trail hooks for admin reads, edits, exports, and deletes when introduced.

### API and data integration

- Admin-only procedures for summary metrics, paginated lists, application detail, and validation reports.
- Metrics derived from the `applications` table and structured data; category distribution derives from the JSON blob until a dedicated model proves necessary.
- Admin metrics publish through the oRPC event-iterator pattern on create/update/submit/delete.
- Applicant and admin event streams stay separate.

### Validation and data-quality reporting

- Validate email, phone, NIC, DOB, birth-certificate number, residence, location, and eligibility server-side as well as in the browser.
- Store normalized validation results and error codes, not raw invalid secrets.
- Distinguish issues detected during draft save, update, or submission.
- Missing local keys report as client synchronization issues, never applicant validation failures.

### Admin UI structure

- `/_auth/admin`: protected shell and navigation.
- `/_auth/admin/index`: summary cards, trends, sync status, recent activity.
- `/_auth/admin/applications`: searchable, sortable, filterable list with view/edit/delete actions.
- `/_auth/admin/applications/$id`: safe detail and validation report including a categories tab.
- Shared loading, empty, error, and permission-denied states reuse existing UI components.

### Acceptance criteria

- Non-admins cannot reach admin routes or procedures.
- Admins reconcile application counts with database state.
- Admins identify incomplete applications and data-quality issues without seeing access keys.
- Admins see which categories each application uses with per-category inputs and selected schools.
- Updates, submissions, deletions, and synchronization failures remain distinguishable in activity views.
- The admin view stays useful with zero applications, stale client keys, failed saves, or partially completed drafts.

### Implemented admin slice

- `adminProcedure` requiring authenticated Better Auth user with `role === "admin"`.
- Admin overview and paginated/searchable application procedures.
- `/_auth/admin` dashboard with total, draft, submitted, incomplete, invalid-email metrics.
- Safe metadata plus validation issue counts without plaintext keys.
- Recent activity SSE updates for create/update/submit/delete.
- Responsive styling and permission-denied UI.
- `/admin/applications` child routes rendered through the admin shell outlet.
- Detail inspection of complete saved data including device and user-selected locations.
- Confirmation-protected admin editing/deletion via server procedures.
- Table sorting and status/data-quality filtering.

Remaining admin work: persistent validation/audit records, document metadata, appeals polish, richer time-series reporting, category distribution cards.

## Appeals, disputes, and lost-key recovery

The admin panel includes a separate appeals queue for applicants who cannot safely resolve an application themselves.

### Appeal reasons

- Wrong child or incorrect applicant information was saved.
- A birth certificate number is already used but the applicant claims ownership or reports misuse.
- The applicant lost the application key.
- The applicant believes an application was created fraudulently or by mistake.
- The applicant needs an administrator to correct or remove a record.

### Applicant flow

- Public appeal form accepting contact method, identifying details, birth-certificate details, reason, explanation, and optional supporting-document metadata.
- No key required for “lost key” but enough information for manual identity verification.
- Never display or email the existing plaintext key automatically.
- Show a reference number after creation; administrators must verify ownership.
- Rate-limit appeals; avoid revealing whether a birth-certificate exists to unauthenticated users.

### Admin workflow

- Queue statuses: `open`, `needs_verification`, `approved`, `rejected`, `resolved`.
- Show appeal, safe linked-application metadata, verification notes, audit history.
- Request more information, approve corrections, delete wrongly created records, or close appeals.
- Verified lost keys produce a one-time replacement key; old keys rotate immediately.
- Birth-certificate conflicts allow holds pending investigation; deletion requires explicit confirmation and audit entry.
- Every action records actor, timestamp, appeal reference, target ID, and reason.

### Data and security boundaries

- Only hashes of recovery tokens and application keys are stored.
- Appeals stay separate from application JSON for queryability and auditability.
- Admin APIs require the admin role and never return key plaintext.
- Deletion revokes active keys and publishes count updates.
- Rotation invalidates prior keys immediately.

### Implemented duplicate birth-certificate and lost-key recovery

- Pre-create checks against existing birth-certificate numbers among submitted applications only.
- Matching submitted-application numbers surface an existing-application notice instead of a second record.
- Key holders reopen profiles via the verified access-key route.
- Keyless users submit recovery requests with name and contact email.
- Admins review requests, generate replacements once, or dismiss.
- Replacement rotation invalidates previous hashes instantly.
- Locally saved matching keys offer direct profile-open actions.
- Generated keys display as text plus QR; applicants re-import from `/` or `/application`.

### Acceptance criteria

- Lost-key or wrong-record appeals work without revealing other records’ existence.
- Admins verify, resolve, reject, delete, or rotate records through an auditable queue.
- Conflicts cannot be solved by overwriting another application.
- Recovery produces new secrets without exposing old ones.
- Appeal and recovery actions appear in admin activity reporting.

## Duplicate birth certificate and record removal

- Matching birth certificate numbers in submitted applications block second submissions.
- Existing keys or QR codes only open/edit the existing application.
- Removal goes through a separate school-review request with name and contact email; never automatic deletion or key recovery.
- Admins review, contact users, and delete only after confirming legal and operational appropriateness, then mark resolved.
- Access-key and removal requests use distinct types preventing cross-actions.
- One resolution panel verifies key-to-birth-certificate ownership before offering removal; saved keys alone prove nothing.

## Sub-admin role and forgot-key requests

### Role model

- Three roles: `admin`, `sub-admin`, `user`.
- `adminProcedure` requires `role === "admin"`.
- `subAdminProcedure` requires admin or sub-admin.
- `ensureSubAdmin(email, name)` in `packages/auth/src/index.ts` provisions accounts with `SUB_ADMIN_DEFAULT_PASSWORD`; no self-service registration.

### Forgot-key requests

- Homepage “Forgot a key?” opens `AccessRecoveryDialog` submitting `requestType: "forgot"`.
- Forgot joins access/removal/submission in `requestAccess`; phone number required.
- Duplicate prevention: one open request per application per type.

### Admin forgot-requests page

- Paginated table with applicant name, birth certificate number, request date.
- Actions: generate replacement key (one-time display + QR) or dismiss.
- `admin.accessRequests.forgotRequests` returns full request data.

### Sub-admin pages

- Overview linking to queues.
- Queues expose only verification data: birth certificate number, applicant name, status, created date.
- `subAdmin.rotateKey` generates keys; `subAdmin.deleteAfterRemovalRequest` deletes applications.
- Removal deletions respect the submission window with an amber banner outside it.
- Key generation and deletion require alert-dialog confirmation.

### QR import dialog

- File-picker import or live camera scanning via `qr-scanner` with highlighted scan region.
- Opens automatically after key loss so parents re-import immediately.

### Security notes

- Sub-admin routes return limited safe fields only.
- Role checks enforce server-side middleware.
- Keys persist solely as SHA-256 hashes.
- Rotation invalidates previous keys immediately.
- `deleteAfterRemovalRequest` verifies request type `removal` before deleting.
