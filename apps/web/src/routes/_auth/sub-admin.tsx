import { useState } from "react";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { ArrowLeft, FileWarning, KeyRound, LayoutDashboard, ShieldCheck, Trash2, X } from "lucide-react";
import { cn } from "@aloysius-g1/ui/lib/utils";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@aloysius-g1/ui/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@aloysius-g1/ui/components/card";
import { Button } from "@aloysius-g1/ui/components/button";

export const Route = createFileRoute("/_auth/sub-admin")({ component: SubAdminPage });

function SubAdminPage() {
  const { session } = Route.useRouteContext();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (session.data?.user.role !== "admin" && session.data?.user.role !== "sub-admin") {
    return (
      <main className="grid place-items-center min-h-svh p-6">
        <Card className="w-full max-w-md gap-5 p-8">
          <div className="grid place-items-center w-13 h-13 rounded-xl text-primary bg-primary/10"><ShieldCheck size={28} /></div>
          <CardHeader className="p-0">
            <CardTitle className="font-heading text-[clamp(1.8rem,4vw,2.5rem)]">Access required</CardTitle>
            <CardDescription className="leading-relaxed">Your account does not have permission to view this page.</CardDescription>
          </CardHeader>
          <Button variant="default" className="w-fit" render={<Link to="/dashboard" />}><ArrowLeft size={17} /> Back to dashboard</Button>
        </Card>
      </main>
    );
  }

  const sidebarNav = <>
    <SidebarHeader>
      <div className="flex items-center gap-2.5">
        <div className="grid place-items-center w-9 h-9 rounded-lg text-primary-foreground bg-primary"><ShieldCheck size={24} /></div>
        <div>
          <strong className="block">G1 Intake</strong>
          <span className="block text-muted-foreground text-xs mt-0.5">Sub-admin console</span>
        </div>
      </div>
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Requests</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton href="/sub-admin" isActive={location.pathname === "/sub-admin"} onClick={() => setSidebarOpen(false)}><LayoutDashboard size={20} /> Overview</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href="/sub-admin/forgot-requests" isActive={location.pathname === "/sub-admin/forgot-requests"} onClick={() => setSidebarOpen(false)}><KeyRound size={20} /> Forgot key requests</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href="/sub-admin/removal-requests" isActive={location.pathname === "/sub-admin/removal-requests"} onClick={() => setSidebarOpen(false)}><Trash2 size={20} /> Removal requests</SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <Link className="flex items-center gap-2.5 min-h-10 px-2.5 rounded-lg text-muted-foreground text-sm no-underline hover:text-foreground hover:bg-muted transition-colors" to="/dashboard">
        <ArrowLeft size={18} /> Back to dashboard
      </Link>
    </SidebarFooter>
  </>;

  return (
    <SidebarProvider>
      <Sidebar>{sidebarNav}</Sidebar>
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-xs md:hidden" onClick={() => setSidebarOpen(false)} />}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200 md:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          className="absolute top-3 right-3 p-1 rounded-md hover:bg-sidebar-accent text-sidebar-foreground z-50"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
        {sidebarNav}
      </div>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger onClick={() => setSidebarOpen(!sidebarOpen)} />
          <span className="text-sm font-medium">Sub-admin console</span>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
