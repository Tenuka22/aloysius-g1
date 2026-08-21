import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@aloysius-g1/ui/components/card";
import { Button } from "@aloysius-g1/ui/components/button";
import { AdminApplicationEditor, AdminApplicationView } from "@/components/admin/admin-application-editor";

export const Route = createFileRoute("/_auth/admin/applications/$id")({ component: AdminApplicationPage });

function AdminApplicationPage() {
  const { session } = Route.useRouteContext(); const { id } = Route.useParams(); const editing = (Route.useSearch() as { mode?: string }).mode === "edit";
  if (session.data?.user.role !== "admin") return <main className="grid place-items-center min-h-svh p-6"><Card className="w-full max-w-md gap-5 p-8"><CardHeader className="p-0"><CardTitle className="font-heading text-[clamp(1.8rem,4vw,2.5rem)]">Admin access required</CardTitle></CardHeader><Button variant="default" className="w-fit" render={<Link to="/dashboard" />}><ArrowLeft size={17} /> Back to dashboard</Button></Card></main>;
  if (editing) return <AdminApplicationEditor id={id} />;
  return <AdminApplicationView id={id} />;
}
