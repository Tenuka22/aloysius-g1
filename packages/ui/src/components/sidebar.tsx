import * as React from "react"
import { cn } from "@aloysius-g1/ui/lib/utils"
import { PanelLeftIcon } from "lucide-react"

function SidebarProvider({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="sidebar-provider" className={cn("flex min-h-svh w-full", className)} {...props}>
      {children}
    </div>
  )
}

function Sidebar({ className, children, ...props }: React.ComponentProps<"aside"> & { "data-open"?: boolean }) {
  return (
    <aside
      data-slot="sidebar"
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex",
        className
      )}
      {...props}
    >
      {children}
    </aside>
  )
}

function SidebarInset({ className, children, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn("flex min-h-svh flex-1 flex-col bg-background md:ml-64", className)}
      {...props}
    >
      {children}
    </main>
  )
}

function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      data-slot="sidebar-trigger"
      className={cn(
        "inline-flex items-center justify-center h-7 w-7 rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:hidden",
        className
      )}
      onClick={onClick}
      {...props}
    >
      <PanelLeftIcon className="h-4 w-4" />
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

function SidebarMenuButton({ className, isActive = false, ...props }: React.ComponentProps<"a"> & { isActive?: boolean }) {
  return (
    <a
      data-slot="sidebar-menu-button"
      data-active={isActive || undefined}
      className={cn(
        "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "[&>svg]:size-4 [&>svg]:shrink-0",
        isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
        className
      )}
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
}
