# Handover: Intake Year System

## Current State (Broken)

The intake year system was partially implemented across multiple files but is currently **broken** due to several conflicting approaches (localStorage + search params + invalidation keys).

## What Was Built

### 1. Database Schema
- `applications` table has `intake_year TEXT NOT NULL DEFAULT '2027'`
- `application_access_requests` table has `intake_year TEXT NOT NULL DEFAULT '2027'`
- `application_settings` table has per-year settings (id = year string like "2027")
- Migration: `packages/db/src/migrations/0001_add_intake_year.sql`

### 2. API Changes (`packages/api/src/routers/index.ts`)
- All admin queries filter by `intakeYear` parameter:
  - `admin.overview` - filters applications by intakeYear
  - `admin.applications` - filters by intakeYear
  - `admin.admissions.list` - filters by intakeYear
  - `admin.admissions.listWithLocations` - filters by intakeYear
  - `admin.accessRequests.submissionRequests` - filters by intakeYear
  - `admin.accessRequests.forgotRequests` - filters by intakeYear
  - `admin.accessRequests.removalRequests` - filters by intakeYear
  - `admin.settings.get` - returns settings for specific year
  - `admin.settings.update` - saves settings for specific year

- Two helper functions:
  - `getApplicationWindow(intakeYear)` - returns settings or null (no auto-create)
  - `getOrCreateApplicationWindow(intakeYear)` - returns settings or creates defaults (for public form)

- Public form endpoints use `getOrCreateApplicationWindow`:
  - `application.create`
  - `application.update`
  - `application.status`
  - `application.submit`

- Admin endpoints use `getApplicationWindow`:
  - `admin.settings.get` - returns null if no record exists

### 3. Admin UI Changes (`apps/web/src/routes/_auth/admin.tsx`)

#### Sidebar Year Selector (BROKEN)
- **Intended**: Select dropdown with dynamic year range (currentYear-1 to currentYear+5)
- **Intended**: Note "Intake year = current year + 1"
- **Actual**: Uses TanStack Router search params `?intakeYear=2027`

#### FormWindowSettings
- Uses `YearStepper` component (number input + minus/plus buttons)
- Auto-loads opens/closes when settings exist for selected year
- Shows "Already configured" or "Not configured — set dates to enable"
- New years show empty datetime pickers

#### Query Invalidation (BROKEN)
- Year change should invalidate all queries to refetch with new intakeYear
- Uses `queryClient.invalidateQueries` with router path prefix matching
- **Issue**: oRPC `key()` returns `[path, {}]` but `queryOptions` creates keys with `input` included

### 4. Other Admin Pages (BROKEN - still use localStorage)
All these pages still read intakeYear from localStorage instead of search params:
- `apps/web/src/routes/_auth/admin/applications.tsx`
- `apps/web/src/routes/_auth/admin/admissions.tsx`
- `apps/web/src/routes/_auth/admin/admin_map.tsx`
- `apps/web/src/routes/_auth/admin/requests.tsx`
- `apps/web/src/routes/_auth/admin/forgot-requests.tsx`
- `apps/web/src/routes/_auth/admin/removal-requests.tsx`

### 5. Seed Data (`packages/db/src/seed.ts`)
- 100 applications distributed across 2024-2029 with weighted variety
- All 6 category types (6.1-6.6) covered
- Realistic timestamps spread across months
- Access keys format: `ALY-SEED-XXXX-FIRST-LAST-YEAR-####` (min 32 chars)
- Indicative marks generated for submitted applications

## What's Broken

### Issue 1: Overview shows 100 instead of filtering by year
- **Symptom**: Admin overview shows 100 total applications even when 2027 is selected (only ~20 are 2027)
- **Root cause**: Query invalidation uses wrong key format
  - `orpc.admin.overview.key()` returns `[["admin","overview"], {}]`
  - But `queryOptions({ input: { intakeYear } })` creates key `[["admin","overview"], { type: "query", input: { intakeYear } }]`
  - Invalidation doesn't match, so old data persists

### Issue 2: Seeded access keys don't work
- **Symptom**: Can't load seeded applications via access key
- **Root cause**: Originally keys were too short (< 32 chars), now fixed but may still have issues
- **Current format**: `ALY-SEED-0001-KAVINDU-PERERA-2027-3847`

### Issue 3: Inconsistent intakeYear sourcing
- **Symptom**: Admin sidebar uses search params, but other pages use localStorage
- **Root cause**: Only `admin.tsx` was updated; 6 other pages still use `localStorage.getItem("admin-intake-year")`
- **Impact**: Navigating between pages shows wrong year data

### Issue 4: Settings auto-create defaults
- **Symptom**: Can't distinguish between "configured" and "not configured" years
- **Root cause**: `getApplicationWindow` was auto-creating defaults
- **Fix applied**: Now returns null for new years, but FormWindowSettings may not handle it correctly

## What Needs to be Fixed

### Priority 1: Fix query invalidation
```typescript
// Current (BROKEN)
void queryClient.invalidateQueries({ queryKey: orpc.admin.overview.key() });

// Should be exact match
void queryClient.invalidateQueries({ 
  queryKey: orpc.admin.overview.queryKey({ input: { intakeYear: year } }) 
});
```

### Priority 2: Migrate all admin pages to search params
All these files need to:
1. Import `useSearch` from `@tanstack/react-router`
2. Read `intakeYear` from search params instead of localStorage
3. Update loaders to use search params

Files to update:
- `apps/web/src/routes/_auth/admin/applications.tsx`
- `apps/web/src/routes/_auth/admin/admissions.tsx`
- `apps/web/src/routes/_auth/admin/admin_map.tsx`
- `apps/web/src/routes/_auth/admin/requests.tsx`
- `apps/web/src/routes/_auth/admin/forgot-requests.tsx`
- `apps/web/src/routes/_auth/admin/removal-requests.tsx`

### Priority 3: Remove localStorage entirely
- Delete all `localStorage.setItem("admin-intake-year", ...)` calls
- Delete all `localStorage.getItem("admin-intake-year")` calls
- Remove localStorage fallback logic

### Priority 4: Add search param sync for all admin routes
Each admin route should:
1. Add `validateSearch` with intakeYear schema
2. Read intakeYear from search params in loader
3. Pass intakeYear to all queries
4. Navigate to update search params when year changes

### Priority 5: Test seeded access keys
Verify seeded keys work:
1. Seed DB with test data
2. Try to load application via `/application/access?key=ALY-SEED-0001-...`
3. Verify it loads correctly

## Recommended Approach

### Option A: Use TanStack Router search params (preferred)
- Year is in URL: `?intakeYear=2027`
- All pages read from search params
- Year change updates URL and invalidates queries
- Can bookmark/share URLs with specific year

### Option B: Use React context (simpler)
- Create `IntakeYearContext` at admin layout level
- All pages consume context
- Year change updates context + localStorage backup
- No URL changes needed

## Files Involved

### Backend
- `packages/api/src/routers/index.ts` - All admin queries filter by intakeYear
- `packages/db/src/schema/applications.ts` - Has intake_year column
- `packages/db/src/schema/application-access-requests.ts` - Has intake_year column
- `packages/db/src/schema/application-settings.ts` - Per-year settings
- `packages/db/src/seed.ts` - Test data generator

### Frontend
- `apps/web/src/routes/_auth/admin.tsx` - Main admin layout (partially fixed)
- `apps/web/src/routes/_auth/admin/applications.tsx` - Needs search params
- `apps/web/src/routes/_auth/admin/admissions.tsx` - Needs search params
- `apps/web/src/routes/_auth/admin/admin_map.tsx` - Needs search params
- `apps/web/src/routes/_auth/admin/requests.tsx` - Needs search params
- `apps/web/src/routes/_auth/admin/forgot-requests.tsx` - Needs search params
- `apps/web/src/routes/_auth/admin/removal-requests.tsx` - Needs search params

## Testing Checklist

- [ ] Change year in sidebar → URL updates to `?intakeYear=2026`
- [ ] Overview shows only 2026 applications
- [ ] Applications page shows only 2026 applications
- [ ] Admissions page shows only 2026 applications
- [ ] Requests pages show only 2026 requests
- [ ] FormWindowSettings loads 2026 settings if exists
- [ ] FormWindowSettings shows empty if 2026 not configured
- [ ] Seeded access keys work in application form
- [ ] Bookmark URL with `?intakeYear=2025` loads correct data
- [ ] Navigate between admin pages, year persists
