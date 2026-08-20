import { createFileRoute } from "@tanstack/react-router";
import { ApplicationForm } from "@/components/application/application-form";
import { loadAdministrativeData } from "@/lib/administrative-data";

export const Route = createFileRoute("/")({ loader: loadAdministrativeData, component: HomeComponent });

function HomeComponent() {
  const administrativeData = Route.useLoaderData();
  return (
    <div className="form-starter-route" data-surface="g1-2026-application">
      <ApplicationForm administrativeData={administrativeData} />
    </div>
  );
}
