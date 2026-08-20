import { createFileRoute } from "@tanstack/react-router";
import { ApplicationForm } from "@/components/application/application-form";
import { loadAdministrativeData } from "@/lib/administrative-data";

export const Route = createFileRoute("/application")({ loader: loadAdministrativeData, component: ApplicationPage });

function ApplicationPage() {
  return <ApplicationForm administrativeData={Route.useLoaderData()} />;
}
