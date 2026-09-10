import * as React from "react"
import { cn } from "@aloysius-admissions/ui/lib/utils"
import { PanelLeftIcon, XIcon } from "lucide-react"

type SidebarContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

/**
 * Owns the mobile drawer's open/closed state so `Sidebar`, `SidebarTrigger`,
 * and any in-menu close action share one source of truth instead of each
 * consumer route hand-rolling its own `useState` + backdrop (as the admin
 * and sub-admin shells used to before this became a shared primitive).
 */
function SidebarProvider({ className, children, ...props }: React.ComponentProps<"div">) {
  const [open, setOpen] = React.useState(false)
  const toggle = React.useCallback(() => setOpen((prev) => !prev), [])
  const value = React.useMemo(() => ({ open, setOpen, toggle }), [open])

  return (
    <SidebarContext.Provider value={value}>
      <div data-slot="sidebar-provider" className={cn("flex min-h-svh w-full", className)} {...props}>
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

/**
 * Static column on `md:`+ (unchanged behaviour). Below `md:`, renders as a
 * translating drawer plus backdrop driven by `SidebarProvider`'s context,
 * closing on backdrop tap, Escape, or navigation (via `SidebarMenuButton`'s
 * `onClick`, which calls `setOpen(false)` automatically - see below).
 */
function Sidebar({ className, children, ...props }: React.ComponentProps<"aside">) {
  const { open, setOpen } = useSidebar()

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, setOpen])

  return (
    <>
      <div
        aria-hidden="true"
        data-slot="sidebar-backdrop"
        className={cn(
          "fixed inset-0 z-40 bg-black/20 backdrop-blur-xs transition-opacity md:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setOpen(false)}
      />
      <aside
        data-slot="sidebar"
        data-state={open ? "open" : "closed"}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200 md:sticky md:top-0 md:z-40 md:h-svh md:w-64 md:translate-x-0 md:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
          className
        )}
        {...props}
      >
        <button
          type="button"
          data-slot="sidebar-mobile-close"
          className="absolute top-2.5 right-2.5 flex size-8 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent md:hidden"
          onClick={() => setOpen(false)}
        >
          <XIcon className="size-4" />
          <span className="sr-only">Close sidebar</span>
        </button>
        {children}
      </aside>
    </>
  )
}

function SidebarInset({ className, children, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn("flex min-h-svh flex-1 flex-col bg-background md:min-w-0", className)}
      {...props}
    >
      {children}
    </main>
  )
}

/** Opens/closes the mobile drawer. Hidden at `md:`+ where the sidebar is a static column. */
function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<"button">) {
  const { toggle } = useSidebar()
  return (
    <button
      data-slot="sidebar-trigger"
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:hidden",
        className
      )}
      onClick={(event) => {
        onClick?.(event)
        toggle()
      }}
      {...props}
    >
      <PanelLeftIcon className="h-4.5 w-4.5" />
      <span className="sr-only">Toggle Sidebar</span>
    </button>
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-header" className={cn("flex flex-col gap-2 p-2", className)} {...props} />
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-content" className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-auto", className)} {...props} />
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-footer" className={cn("flex flex-col gap-2 border-t border-sidebar-border p-2", className)} {...props} />
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-group" className={cn("relative flex w-full min-w-0 flex-col p-2", className)} {...props} />
}

function SidebarGroupLabel({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn("flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground select-none", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-group-content" className={cn("w-full text-sm", className)} {...props} />
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="sidebar-menu" className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="sidebar-menu-item" className={cn("group/menu-item relative", className)} {...props} />
}

/**
 * Closes the mobile drawer on navigation automatically (in addition to
 * whatever `onClick` the caller passes), so routes no longer need to thread
 * their own `setSidebarOpen(false)` into every menu button.
 */
function SidebarMenuButton({
  className,
  isActive = false,
  onClick,
  ...props
}: React.ComponentProps<"a"> & { isActive?: boolean }) {
  const { setOpen } = useSidebar()
  return (
    <a
      data-slot="sidebar-menu-button"
      data-active={isActive || undefined}
      className={cn(
        "flex min-h-10 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "[&>svg]:size-4 [&>svg]:shrink-0",
        isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
        className
      )}
      onClick={(event) => {
        onClick?.(event)
        setOpen(false)
      }}
      {...props}
    />
  )
}

function SidebarMenuAction({ className, ...props }: React.ComponentProps<"button">) {
  return <button data-slot="sidebar-menu-action" className={cn("flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0", className)} {...props} />
}

function SidebarMenuBadge({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-menu-badge" className={cn("absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground select-none", className)} {...props} />
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="sidebar-menu-sub" className={cn("mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5", className)} {...props} />
}

function SidebarMenuSubItem({ ...props }: React.ComponentProps<"li">) {
  return <li {...props} />
}

function SidebarMenuSubButton({ className, ...props }: React.ComponentProps<"a">) {
  return <a data-slot="sidebar-menu-sub-button" className={cn("flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sm text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0", className)} {...props} />
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
}
