import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@aloysius-g1/ui/components/card";
import { Button } from "@aloysius-g1/ui/components/button";

export const Route = createFileRoute("/_auth/sub-admin/")({ component: SubAdminOverviewPage });

function SubAdminOverviewPage() {
  return (
    <main className="min-h-svh p-12.5 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
      <div className="mb-8">
        <p className="text-primary font-bold tracking-widest uppercase text-xs">Sub-admin workspace</p>
        <h1 className="font-heading text-[clamp(2rem,4vw,3.6rem)] mt-1 mb-3">Request handler</h1>
        <p className="text-muted-foreground">Review and process access and removal requests. You can only see verification numbers – full application data is restricted to administrators.</p>
      </div>
      <div className="grid gap-4 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound size={18} /> Forgot key requests</CardTitle>
            <CardDescription>Parents who lost their access key. Generate a new key or QR code after verification.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" render={<Link to="/sub-admin/forgot-requests" />}>View forgot key requests</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trash2 size={18} /> Removal requests</CardTitle>
            <CardDescription>Parents requesting record deletion. Only available during the application open period.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" render={<Link to="/sub-admin/removal-requests" />}>View removal requests</Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
