import { createFileRoute } from "@tanstack/react-router";
import { ApplicationForm } from "@/components/application/application-form";

export const Route = createFileRoute("/application/")({ component: ApplicationIndexPage });

function ApplicationIndexPage() {
  return <ApplicationForm />;
}
