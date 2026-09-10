import { cn } from "@aloysius-admissions/ui/lib/utils"

type IconBadgeProps = {
  icon: React.ReactNode
  tone?: "gold" | "primary"
  size?: "default" | "lg"
  className?: string
}

const toneClasses = {
  gold: "bg-brand-gold text-brand-gold-foreground",
  primary: "bg-primary text-primary-foreground",
} as const

const sizeClasses = {
  default: "h-11 w-11",
  lg: "h-14 w-14",
} as const

/** Circular icon-in-colored-circle badge, previously hand-duplicated per icon across quick-action buttons. */
function IconBadge({ icon, tone = "primary", size = "default", className }: IconBadgeProps) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        toneClasses[tone],
        sizeClasses[size],
        className
      )}
    >
      {icon}
    </span>
  )
}

export { IconBadge }
