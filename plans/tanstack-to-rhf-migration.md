# Migration: TanStack Form → React Hook Form

## Problem
The auto-save indicator shows "Saved locally" immediately even when the user makes changes. The `form.Subscribe` + `onChange` pattern from TanStack Form fires during React's commit phase, making `setState` calls from `onChange` unreliable. React Hook Form's `watch()` / `useWatch()` uses a proper subscription model that reliably tracks value changes.

## Scope
3 forms use TanStack Form:
1. **`application-form.tsx`** — 18 fields (applicant, guardian, residence steps), auto-save, hydration sync, step navigation
2. **`sign-in-form.tsx`** — 2 fields (email, password), simple submit
3. **`sign-up-form.tsx`** — 3 fields (name, email, password), simple submit

Supporting infrastructure to delete:
- `lib/form-context.ts` — wraps `createFormHookContexts` from TanStack Form
- `lib/app-form.ts` — wraps `createFormHook` from TanStack Form  
- `components/form-fields.tsx` — `App*` field components (keep `Field`/`FieldGroup` re-exports from `@aloysius-g1/ui`)

## Step 1: Install react-hook-form + zod resolver
```bash
cd apps/web && bun add react-hook-form @hookform/resolvers
```
Remove `@tanstack/react-form` from `apps/web/package.json` if no longer used.

## Step 2: Rewrite `application-form.tsx`

### Form setup
```ts
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const form = useForm<ApplicationDraft>({
  resolver: zodResolver(applicationDraftSchema), // or just cast, since we validate externally
  defaultValues: draft as ApplicationDraft,
});
```

### Auto-save via `watch` (replaces `form.Subscribe`)
```ts
const watchedValues = form.watch();
const formSnapshot = useMemo(() => JSON.stringify(watchedValues), [watchedValues]);
```
This is a proper subscription — fires on every value change, no commit-phase issues.

### Hydration sync via `reset`
```ts
// After fetching from server:
form.reset(latest); // React Hook Form's reset replaces form state entirely
```

### Field rendering — replace `form.Field` render-prop with `Controller`
Before (TanStack Form):
```tsx
<form.Field name="applicant.fullName">
  {(field: AnyFieldApi) => (
    <Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
  )}
</form.Field>
```

After (React Hook Form):
```tsx
<Controller
  name="applicant.fullName"
  control={form.control}
  render={({ field }) => (
    <Input {...field} />
  )}
/>
```

### Step-specific changes

**ApplicantStep** — 7 fields → 7 `<Controller>`s
**GuardianStep** — 5 fields → 5 `<Controller>`s  
**ResidenceStep** — 6 fields → 6 `<Controller>`s, plus `form.setValue` for same-as-permanent copy

### Next step / submit
```ts
const next = async () => {
  await form.handleSubmit(async () => {
    // validation passed, advance
  })();
};
```
Or since we validate externally via `getNextStepReason`, just advance directly and sync to zustand.

### Key types change
- Remove `AppForm = ReactFormExtendedApi<...>` type alias
- Remove `AnyFieldApi` type usage
- `ApplicantStep`, `GuardianStep`, `ResidenceStep` props change from `form: AppForm` to `form: UseFormReturn<ApplicationDraft>`

## Step 3: Rewrite `sign-in-form.tsx` and `sign-up-form.tsx`

Simple forms — replace `useAppForm` with `useForm` from react-hook-form + `Controller` for each field.

## Step 4: Delete TanStack Form infrastructure
- Delete `lib/form-context.ts`
- Delete `lib/app-form.ts`
- Remove `App*` components from `components/form-fields.tsx` (keep the `Field`/`FieldGroup` re-exports on line 196 which come from `@aloysius-g1/ui`)
- Remove `@tanstack/react-form` from `apps/web/package.json`

## Step 5: Update tests
- `application-form.test.tsx` — no changes needed (tests interact via screen queries, not form internals)
- Run `bun x tsc --noEmit -p apps/web` for type checking
- Run `bun x vitest run` for all tests

## Files to modify
| File | Action |
|---|---|
| `apps/web/package.json` | Add `react-hook-form`, `@hookform/resolvers`. Remove `@tanstack/react-form` |
| `apps/web/src/components/application/application-form.tsx` | Major rewrite: useForm from RHF, Controller for fields, watch() for snapshots |
| `apps/web/src/components/sign-in-form.tsx` | Replace useAppForm with useForm from RHF |
| `apps/web/src/components/sign-up-form.tsx` | Replace useAppForm with useForm from RHF |
| `apps/web/src/lib/form-context.ts` | DELETE |
| `apps/web/src/lib/app-form.ts` | DELETE |
| `apps/web/src/components/form-fields.tsx` | Remove App* components, keep Field/FieldGroup re-exports |

## Risk
- `application-form.tsx` is ~1857 lines and the core of the app. Every field must be carefully migrated.
- The auto-save and hydration sync effects are complex — must preserve exact behavior.
- Test suite (42 tests in application-form.test.tsx) must stay green.
