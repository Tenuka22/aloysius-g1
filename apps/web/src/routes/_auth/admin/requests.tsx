import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@aloysius-g1/ui/components/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@aloysius-g1/ui/components/card";
import { Button } from "@aloysius-g1/ui/components/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@aloysius-g1/ui/components/table";
import { client, orpc } from "@/utils/orpc";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/admin/requests")({ component: AdminRequestsPage });

function AdminRequestsPage() {
  const { session } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const requests = useQuery(orpc.admin.accessRequests.submissionRequests.queryOptions());

  const rows = useMemo(() => requests.data ?? [], [requests.data]);

  const approve = async (requestId: string) => {
    try {
      await client.admin.accessRequests.approveSubmission({ requestId });
      setApproveId(null);
      setMessage("Submission approved");
      toast.success("Application submitted successfully");
      await queryClient.invalidateQueries(orpc.admin.accessRequests.submissionRequests.queryOptions());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not approve request");
    }
  };

  const reject = async (requestId: string) => {
    try {
      await client.admin.accessRequests.rejectSubmission({ requestId });
      setRejectId(null);
      setMessage("Submission request rejected");
      await queryClient.invalidateQueries(orpc.admin.accessRequests.submissionRequests.queryOptions());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not reject request");
    }
  };

  if (session.data?.user.role !== "admin") return <main className="grid place-items-center min-h-svh p-6"><Card className="w-full max-w-md gap-5 p-8"><CardHeader className="p-0"><CardTitle className="font-heading text-[clamp(1.8rem,4vw,2.5rem)]">Admin access required</CardTitle><CardDescription className="leading-relaxed">Your account does not have permission to view requests.</CardDescription></CardHeader><Button variant="default" className="w-fit" render={<Link to="/dashboard" />}><ArrowLeft size={17} /> Back to dashboard</Button></Card></main>;

  return (
    <main className="min-h-svh p-12.5 max-w-[1240px] mx-auto bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
      <div className="flex items-end justify-between gap-8 mb-8">
        <div>
          <p className="text-primary font-bold tracking-widest uppercase text-xs">Workspace / Requests</p>
          <h1 className="font-heading text-[clamp(2rem,4vw,3.6rem)] mt-1 mb-3">Submission requests</h1>
          <p className="text-muted-foreground">Review and act on late submission requests from applicants.</p>
        </div>
        <Button variant="secondary" render={<Link to="/admin/applications" />}>Back to applications</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Pending requests</CardTitle>
          <CardDescription>These applicants requested approval after the submission window closed.</CardDescription>
        </CardHeader>
        <CardContent>
          {message && <p className="text-primary mb-4" role="status">{message}</p>}
          {rows.length === 0 ? (
            <p className="text-muted-foreground">No pending submission requests.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Birth certificate</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{request.applicantName || "Unnamed"}</TableCell>
                    <TableCell>{request.birthCertificateNumber}</TableCell>
                    <TableCell>
                      <div className="grid gap-0.5">
                        <span>{request.contactPhone || "—"}</span>
                        <span className="text-muted-foreground text-xs">{request.contactEmail}</span>
                      </div>
                    </TableCell>
                    <TableCell>{new Date(request.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" onClick={() => setApproveId(request.id)}>
                          <Check size={14} /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setRejectId(request.id)}>
                          <X size={14} /> Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={approveId !== null} onOpenChange={(open) => !open && setApproveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve submission request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the application as submitted. The applicant will be notified and the application will be locked for future edits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => approveId && approve(approveId)}>Approve</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectId !== null} onOpenChange={(open) => !open && setRejectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject submission request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will dismiss the request. The applicant will not be able to submit through this request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => rejectId && reject(rejectId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Reject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
