import * as React from "react"
import { cn } from "@aloysius-g1/ui/lib/utils"

function SidebarProvider({ className, children, ...props }: React.ComponentProps<"div">) { return <div data-slot="sidebar-provider" className={cn("flex min-h-svh w-full", className)} {...props}>{children}</div> }
function Sidebar({ className, children, ...props }: React.ComponentProps<"aside">) { return <aside data-slot="sidebar" className={cn("admin-sidebar", className)} {...props}>{children}</aside> }
function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sidebar-header" className={cn("admin-sidebar-header", className)} {...props} /> }
function SidebarContent({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sidebar-content" className={cn("admin-sidebar-content", className)} {...props} /> }
function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sidebar-footer" className={cn("admin-sidebar-footer", className)} {...props} /> }
function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sidebar-group" className={cn("admin-sidebar-group", className)} {...props} /> }
function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sidebar-group-label" className={cn("admin-sidebar-group-label", className)} {...props} /> }
function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) { return <ul data-slot="sidebar-menu" className={cn("admin-sidebar-menu", className)} {...props} /> }
function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) { return <li data-slot="sidebar-menu-item" className={cn("admin-sidebar-menu-item", className)} {...props} /> }
function SidebarMenuButton({ className, active = false, ...props }: React.ComponentProps<"a"> & { active?: boolean }) { return <a data-slot="sidebar-menu-button" data-active={active || undefined} className={cn("admin-sidebar-menu-button", className)} {...props} /> }

export { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider }
