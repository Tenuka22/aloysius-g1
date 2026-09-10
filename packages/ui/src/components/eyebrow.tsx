import { cn } from "@aloysius-admissions/ui/lib/utils"
import { badgeVariants } from "@aloysius-admissions/ui/components/badge"

type EyebrowProps = {
  variant?: "rule" | "dot"
  children: React.ReactNode
  className?: string
}

/**
 * Small gold uppercase label used above hero headlines. `variant="rule"`
 * flanks the text with hairlines on both sides; `variant="dot"` prefixes a
 * single dot instead - both patterns were previously hand-duplicated per page.
 */
function Eyebrow({ variant = "rule", children, className }: EyebrowProps) {
  const text = <span className={cn(badgeVariants({ variant: "eyebrow" }))}>{children}</span>

  if (variant === "dot") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="h-1 w-1 shrink-0 rounded-full bg-brand-gold" aria-hidden="true" />
        {text}
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="h-px w-6 shrink-0 bg-brand-gold/60" aria-hidden="true" />
      {text}
      <span className="h-px w-6 shrink-0 bg-brand-gold/60" aria-hidden="true" />
    </div>
  )
}

export { Eyebrow }
