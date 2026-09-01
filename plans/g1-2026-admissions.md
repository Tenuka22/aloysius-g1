# G1 2026 Admissions Interview Workflow

## Purpose

Provide a structured interview workflow for administrators to review submitted G1 2026 applications. The admissions workspace allows admins to verify applicant data, review location evidence, evaluate category scoring, record interview decisions, and flag suspicious submissions.

## Current implementation

- Admissions are accessible after the submission window closes or via early admin access
- The admissions list shows all submitted applications with status filtering and search
- Each application enters a 4-step interview workspace: Applicant Data → Location Evidence → Category Scoring → Decision & Flagging
- Admin-entered marks are stored separately from auto-calculated indicative scores
- Flags are saved to the database and persist across sessions
- Banned applicants are highlighted throughout the admin interface

## Access and roles

- `adminProcedure` requires authenticated Better Auth user with `role === "admin"`
- `subAdminProcedure` requires admin or sub-admin role
- Admissions data is restricted to admin roles only

## Admissions list

### Features

- Searchable, paginated table with applicant name, categories, birth certificate, session code, status, and submission date
- Status filtering: All, Pending review, Verified, Potentially fake, Banned
- Real-time statistics: Total, Pending, Verified, Flagged/Banned counts
- Click an applicant name to enter the interview workspace

### Admission statuses

| Status | Description |
|--------|-------------|
| `pending` | Awaiting interview review |
| `verified` | Application confirmed as legitimate |
| `fake` | Suspicious or potentially fraudulent |
| `banned` | Blocked from admission with reason |

## Interview workspace (4 steps)

### Step 1: Applicant Data

Shows applicant and residence information with field-level flagging:

- **Applicant section**: Full name, Sinhala name, date of birth, birth certificate number, gender, religion
- **Guardian section**: Guardian name, relationship, NIC, phone, email
- **Residence section**: Permanent address, current address, district, DS division, GN division, electoral district

Each field has:
- Edit button (pencil icon) - opens dialog to record interview observation (does NOT change applicant's original data)
- Flag button (flag icon) - marks field as suspicious; flagged fields show red highlight and "Flagged" badge
- Previous value tooltip - shows original value if field was edited during interview

Interview edits are recorded as observations only with:
- Field path and label
- Previous value
- New value (observation)
- Timestamp

### Step 2: Location Evidence

Shows geographic evidence with interactive map:

- **Map view**: Leaflet map centered on St. Aloysius' College with:
  - Circles centered on each home point with radius = distance to school
  - School marker with custom icon
  - Lines connecting each home to school
  - Color-coded location markers

- **Location lists**:
  - User selected locations (from map clicks)
  - User true locations (from browser GPS/device)

- **Toggle visibility**: Checkbox to show/hide individual locations on map

- **Flagging**: Each location has a flag button to mark suspicious coordinates

- **Edit mode**: "Edit location" button enables dragging the latest selected location marker:
  - Shows "Edit mode" indicator badge
  - Draggable marker replaces the static marker
  - Drag end records the change as an interview edit observation

### Step 3: Category Scoring

Shows per-category scoring with mark allocation:

- **Category header**: Shows category name and indicative score
- **Scoring inputs**: Read-only display of applicant's category inputs (6.1-6.6)
  - For unrecognized categories, shows raw inputs with flag buttons
  - Flagged inputs appear in summary section
- **Mark allocation table**: Editable marks with:
  - Label column
  - Auto column: auto-calculated marks
  - Admin column: editable input pre-filled with auto values
  - Max column: maximum allowed marks
  - Color coding: green (matches auto), amber (modified), red (exceeds max)
  - Tooltip showing "Pre-filled: X / Y"
- **Badges**: Indicative total, Modified indicator, Exceeds max warning, Admin total
- **Save/Reset buttons**: Save admin marks or reset to auto-calculated values
- **Example marks section**: Shows breakdown of auto-calculated marks

Admin marks are stored in `applicationMarks` table with:
- Application ID
- Category type
- Breakdown array (label, marks, max)
- Total
- Timestamps

### Step 4: Decision & Flagging

Final interview recording section:

- **Review status dropdown**: Pending / Verified / Potentially fake

- **Flagged items summary**: Shows all flagged items with categories:
  - Applicant / Guardian fields
  - Category scoring inputs
  - Locations
  - Click X to remove flag before saving

- **Interview notes section**: Shows field edits made during interview
  - Field label
  - Previous value (strikethrough)
  - New observation value
  - These are notes only and do not modify the applicant's original data

- **Interview notes textarea**: Free-form notes for the review

- **Ban controls**: Ban/unban applicant with required reason

- **Save review button**: Saves status, notes, flags, and ban state to database

## Flagging system

### Flag types

| Type | Source | Description |
|------|--------|-------------|
| `field` | Applicant data step | Applicant/guardian/residence field flagged as suspicious |
| `input` | Category scoring step | Category scoring input flagged |
| `location` | Location evidence step | Geographic location flagged |

### Flag storage

Flags are stored in the `applications` table as JSON array:

```json
[
  { "type": "field", "key": "applicant.fullName", "label": "Full name" },
  { "type": "input", "key": "mainDocumentType", "label": "Main document type" },
  { "type": "location", "key": "selected", "label": "Location selected" }
]
```

### Flag indicators

- **Row highlight**: Red-tinted background on flagged rows
- **Flag badge**: Red "Flagged" badge next to label
- **Flag button**: Toggles between outlined (unflagged) and filled red (flagged)
- **Summary card**: All flagged items listed in Decision step with remove buttons

## Interview edits vs data changes

**Important**: The admissions workspace does NOT modify the applicant's original data. All edits are recorded as interview observations:

- Field edits create `InterviewEdit` records with previous/new values
- Location adjustments are logged as observations
- Notes are stored separately in `interviewNotes` field
- Only admin-entered marks (in `applicationMarks`) affect scoring outcomes

This separation ensures:
- Applicant data integrity
- Audit trail of admin observations
- Clear distinction between applicant claims and admin verification

## Database schema

### applications table additions

```sql
ALTER TABLE applications ADD COLUMN flags TEXT NOT NULL DEFAULT '[]';
```

The `flags` column stores JSON array of flag objects.

### applicationMarks table

```sql
CREATE TABLE application_marks (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  category_type TEXT NOT NULL,
  breakdown TEXT NOT NULL, -- JSON array of {label, marks, max}
  total REAL NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

## API endpoints

### Admin admissions procedures

| Procedure | Input | Output |
|-----------|-------|--------|
| `admissions.list` | page, pageSize, query, status | Paginated admission summaries |
| `admissions.get` | id | Full admission detail with data |
| `admissions.updateReview` | id, status, notes, isBanned, banReason, flags | Updated review state |
| `admissions.getMarks` | applicationId | Array of admin marks |
| `admissions.saveMarks` | applicationId, categoryType, breakdown, total | Saved mark record |
| `admissions.deleteMarks` | applicationId, categoryType | Deletion confirmation |

### Flag handling

The `updateReview` procedure accepts a `flags` parameter:

```typescript
flags: z.array(z.object({
  type: z.string(),
  key: z.string(),
  label: z.string()
})).default([])
```

## UI components

### DataRow

Reusable row component with:
- Label with field-type icon
- Value display with color coding
- Edit button (optional)
- Flag button with flagged state styling
- Previous value tooltip for edited fields

### CategoryScoringCard

Per-category scoring display:
- Category header with indicative score
- Scoring inputs display
- Mark allocation table with inline editing
- Save/Reset controls
- Flagged inputs summary

### ApplicantLocationReview

Location evidence display:
- Interactive Leaflet map
- Location toggle lists
- Edit mode for adjusting markers
- Flag buttons per location
- Flagged locations summary

## State management

The workspace uses local React state for:
- `flaggedFields`: Set of flagged field keys
- `flaggedInputs`: Set of flagged input keys
- `flaggedLocations`: Set of flagged location IDs
- `editFieldConfig`: Active field edit dialog state

Flags are persisted to database on "Save review" action.

## Recent changes

### Flagging system added

- Field-level flagging on applicant/guardian/residence data
- Input-level flagging on category scoring inputs
- Location-level flagging on map locations
- Flags summary in Decision & Flagging step
- Flags saved to database as JSON array

### Interview edits as observations

All field edits during interview are recorded as observations:
- Previous value preserved
- New value is admin's observation
- Original applicant data unchanged
- Edits visible in Decision step summary

### Location edit mode

- Toggle button to enable map editing
- Click-to-place marker (no dragging) for admin location adjustment
- Visual indicator during edit mode
- Admin locations saved with `source: "admin"` to distinguish from user selections
- Admin-adjusted location replaces the last user-selected pin in "User selected locations" (display-level replacement, original data not overridden)
- Each new admin save replaces the previous admin pin (only the most recent admin location is shown)
- Admin pin retains amber border/highlight and "Admin" badge for visual distinction

### Dedicated API endpoints for interview data

- `saveAdminLocation` - saves admin-adjusted location directly to `data.userLocationHistory`
- `saveInterviewEdits` - saves interview edits array to `data.interviewEdits`
- Both bypass birth certificate validation (unlike `admin.application.update`)

## Known issues and missing logic

### Critical

1. **Auto-save race conditions** - Flag toggle useEffect fires on every change, causing multiple rapid API calls
2. **Missing useEffect dependency** - `reviewMutation` not in dependency array of flag auto-save effect
3. **Cache invalidation** - `setQueryData` used without `invalidateQueries`, may cause stale cache

### High

4. **Duplicate marks queries** - Both `CategoryScoringCard` and `MarkAllocationEditor` fetch same data
5. **No loading state for flag save** - No visual feedback during auto-save
6. **Category 6.5 not handled** - `Category65Fields` exists in `category-step.tsx` but is not exported or imported; falls through to default generic fields in both `admissions.$id.$categoryId.tsx` and `admin-application-editor.tsx`
7. **Empty onChange handlers** - Category fields receive `() => {}`, making "Edit inputs" non-functional
8. **Ban dialog validation** - Confirm may proceed without re-validating cleared reason field

### Medium

9. **Duplicate flag building logic** - `buildFlags()` and `saveReview()` have identical code
10. **MarkAllocationEditor unused** - Component defined but never rendered
11. **No distance feedback during edit** - New location doesn't show calculated distance
12. **Client-side timestamps** - Interview edits use client clock instead of server time
13. **No debouncing for flag toggles** - Each toggle fires immediate save request

### Low

14. **Mark input doesn't enforce max value** - Users can type values exceeding max
15. **Hardcoded zoom levels** - Magic numbers in map configuration
16. **Missing accessibility labels** - Interactive elements lack aria-labels
17. **No optimistic updates** - All mutations wait for server response
18. **Interview notes character count** - Shows used, not remaining

## Security considerations

- All admissions endpoints require admin role
- No applicant PII exposed beyond necessary fields
- Access keys never shown to admins
- Ban actions require recorded reason
- Flag deletions are immediate and irreversible (until next save)

## Implementation files

- `apps/web/src/routes/_auth/admin/admissions.tsx` - Admissions list page
- `apps/web/src/routes/_auth/admin/admissions.$id.tsx` - Category selection
- `apps/web/src/routes/_auth/admin/admissions.$id.$categoryId.tsx` - Interview workspace
- `packages/api/src/routers/index.ts` - Admin procedures
- `packages/db/src/schema/applications.ts` - Database schema
