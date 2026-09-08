import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@aloysius-admissions/ui/components/card";
import { Button } from "@aloysius-admissions/ui/components/button";
import { useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/_auth/sub-admin/")({ component: SubAdminOverviewPage });

function SubAdminOverviewPage() {
  const { t } = useTranslation();
  return (
    <main className="min-h-svh p-12.5 bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_32rem)]">
      <div className="mb-8">
        <p className="text-primary font-bold tracking-widest uppercase text-xs">{t("subAdminOverview.badge")}</p>
        <h1 className="font-heading text-[clamp(2rem,4vw,3.6rem)] mt-1 mb-3">{t("subAdminOverview.title")}</h1>
        <p className="text-muted-foreground">{t("subAdminOverview.description")}</p>
      </div>
      <div className="grid gap-4 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound size={18} /> {t("subAdminOverview.forgotKey.title")}</CardTitle>
            <CardDescription>{t("subAdminOverview.forgotKey.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" render={<Link to="/sub-admin/forgot-requests" />}>{t("subAdminOverview.forgotKey.viewButton")}</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trash2 size={18} /> {t("subAdminOverview.removal.title")}</CardTitle>
            <CardDescription>{t("subAdminOverview.removal.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" render={<Link to="/sub-admin/removal-requests" />}>{t("subAdminOverview.removal.viewButton")}</Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
