import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AdminApplicationEditor, AdminApplicationView } from "@/components/admin/admin-application-editor";

export const Route = createFileRoute("/_auth/admin/applications/$id")({ component: AdminApplicationPage });

function AdminApplicationPage() {
  const { session } = Route.useRouteContext(); const { id } = Route.useParams(); const editing = (Route.useSearch() as { mode?: string }).mode === "edit";
  if (session.data?.user.role !== "admin") return <main className="admin-shell admin-denied-shell"><section className="admin-card admin-denied-card"><h1>Admin access required</h1><Link className="primary-button" to="/dashboard"><ArrowLeft size={17} /> Back to dashboard</Link></section></main>;
  if (editing) return <AdminApplicationEditor id={id} />;
  return <AdminApplicationView id={id} />;
}
