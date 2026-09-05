/**
 * Shared color class constants for consistent theming across the app.
 *
 * All Tailwind color classes are centralised here so that:
 *  - contrast-safe values are enforced in one place
 *  - changing a semantic colour only requires one edit
 *  - components stay free of raw colour strings
 */

// ---------------------------------------------------------------------------
// Field type icon colours (used in admin field legends & scoring)
// ---------------------------------------------------------------------------

export const FIELD_ICON_COLORS = {
  name:     "text-blue-600",
  date:     "text-amber-600",
  phone:    "text-emerald-600",
  email:    "text-purple-600",
  nic:      "text-orange-600",
  address:  "text-sky-600",
  number:   "text-teal-600",
  document: "text-rose-600",
} as const

// ---------------------------------------------------------------------------
// Status / semantic colours
// ---------------------------------------------------------------------------

/** Emerald – success, submitted, verified, positive */
export const STATUS_SUCCESS = {
  text:          "text-emerald-600",
  textStrong:    "text-emerald-700",
  bg:            "bg-emerald-50",
  bgSoft:        "bg-emerald-500/5",
  bgIcon:        "bg-emerald-500/10",
  bgSolid:       "bg-emerald-600",
  border:        "border-emerald-500/20",
  borderStrong:  "border-emerald-500/30",
  hoverBg:       "hover:bg-emerald-200",
  badgeBg:       "bg-emerald-600",
  badgeHover:    "hover:bg-emerald-700",
} as const

/** Amber – warning, pending, caution */
export const STATUS_WARNING = {
  text:          "text-amber-700",
  textStrong:    "text-amber-800",
  textVeryStrong:"text-amber-950",
  bg:            "bg-amber-50",
  bgSoft:        "bg-amber-500/5",
  bgIcon:        "bg-amber-500/10",
  bgIcon12:      "bg-amber-500/12",
  bgSolid:       "bg-amber-500",
  border:        "border-amber-500/20",
  borderStrong:  "border-amber-500/30",
  borderDash:    "border-dashed border-amber-400",
  hoverBg:       "hover:bg-amber-200",
} as const

/** Red / Rose – error, destructive, flagged */
export const STATUS_ERROR = {
  text:          "text-red-600",
  textStrong:    "text-red-700",
  textVeryStrong:"text-red-800",
  bg:            "bg-red-50",
  bgSoft:        "bg-red-500/5",
  bgIcon:        "bg-red-500/10",
  bgSolid:       "bg-red-100",
  border:        "border-red-200",
  borderSoft:    "border-red-500/20",
  hoverBg:       "hover:bg-red-200",
  hoverText:     "hover:text-red-700",
  focusRing:     "focus-visible:ring-red-500",
} as const

/** Blue – info, notes, interview edits */
export const STATUS_INFO = {
  text:          "text-blue-600",
  textStrong:    "text-blue-700",
  bg:            "bg-blue-50",
  bgSoft:        "bg-blue-500/5",
  bgIcon:        "bg-blue-500/10",
  border:        "border-blue-200",
  borderSoft:    "border-blue-500/20",
  borderLine:    "border-blue-200/50",
  borderIcon:    "border-blue-500/10",
} as const

/** Violet – incomplete, neutral-positive */
export const STATUS_INCOMPLETE = {
  text:          "text-violet-600",
  bgIcon:        "bg-violet-500/10",
} as const

/** Rose (lighter red) – used for document field icons */
export const STATUS_ROSE = {
  text:          "text-rose-600",
  bgIcon:        "bg-rose-500/10",
} as const

// ---------------------------------------------------------------------------
// Progress bar colours
// ---------------------------------------------------------------------------

export const BAR_COLORS = {
  high:   "bg-emerald-500",
  medium: "bg-amber-500",
  low:    "bg-red-400",
  empty:  "bg-muted",
} as const

// ---------------------------------------------------------------------------
// Section / card colours (admin review panels)
// ---------------------------------------------------------------------------

export const SECTION_COLORS = {
  success: {
    card:    "border-emerald-500/30 bg-emerald-500/8",
    header:  "bg-emerald-600 text-white",
    label:   "text-emerald-600",
  },
  warning: {
    card:    "border-amber-500/30 bg-amber-500/8",
    header:  "bg-amber-500 text-white",
    label:   "text-amber-600",
  },
  info: {
    card:    "border-blue-500/20 bg-blue-50/20",
    label:   "text-blue-600",
  },
} as const

// ---------------------------------------------------------------------------
// Stat card icon containers (home dashboard)
// ---------------------------------------------------------------------------

export const STAT_ICON_COLORS = {
  success:  "bg-emerald-500/10 text-emerald-600",
  warning:  "bg-amber-500/10 text-amber-600",
  error:    "bg-rose-500/10 text-rose-600",
  info:     "bg-violet-500/10 text-violet-600",
} as const

// ---------------------------------------------------------------------------
// Submission status badge (home dashboard)
// ---------------------------------------------------------------------------

export const SUBMITTED_badge = "text-emerald-600 font-medium"

// ---------------------------------------------------------------------------
// Invitation status badges (organization)
// ---------------------------------------------------------------------------

export const INVITATION_STATUS = {
  pending:  "bg-amber-500/10 text-amber-600",
  accepted: "bg-emerald-500/10 text-emerald-600",
} as const

// ---------------------------------------------------------------------------
// Score row background (scoring table)
// ---------------------------------------------------------------------------

export const SCORE_ROW_BG = {
  exceeds:  "bg-red-50",
  mismatch: "bg-amber-50",
  match:    "bg-emerald-50",
} as const

// ---------------------------------------------------------------------------
// Marking tooltip badge
// ---------------------------------------------------------------------------

export const MARK_TOOLTIP =
  "inline-flex rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white"

// ---------------------------------------------------------------------------
// Flag pill (clickable tag for flagged inputs)
// ---------------------------------------------------------------------------

export const FLAG_PILL =
  "inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[0.7rem] text-red-700 hover:bg-red-200 transition-colors"

// ---------------------------------------------------------------------------
// Admin badge (small label)
// ---------------------------------------------------------------------------

export const ADMIN_BADGE =
  "border-amber-500 text-amber-600"

// ---------------------------------------------------------------------------
// Form window warning banner
// ---------------------------------------------------------------------------

export const FORM_WINDOW_WARNING = {
  card:  "border-amber-500/30 bg-amber-500/5",
  icon:  "bg-amber-500/12 text-amber-600",
  text:  "text-amber-600 font-semibold text-sm",
}
