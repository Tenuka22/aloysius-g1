import { cn } from "@aloysius-admissions/ui/lib/utils"

type HeroVignetteProps = {
  variant?: "vertical"
  className?: string
}

/**
 * Background-only gold vignette overlay for a crest-green hero section,
 * previously hand-duplicated as an inline gradient div on each hero page.
 * Deliberately narrow (background layer only, not a full Hero wrapper) since
 * the pages using it differ too much structurally to templatize further.
 */
function HeroVignette({ variant = "vertical", className }: HeroVignetteProps) {
  if (variant === "vertical") {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,color-mix(in_oklch,var(--brand-gold)_16%,transparent)_0%,transparent_50%)]",
          className
        )}
      />
    )
  }

  return null
}

export { HeroVignette }
