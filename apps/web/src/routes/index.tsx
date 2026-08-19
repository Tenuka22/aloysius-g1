import { createFileRoute } from "@tanstack/react-router";
import { ApplicationForm } from "@/components/application/application-form";

export const Route = createFileRoute("/")({ component: HomeComponent });

function HomeComponent() {
  return (
    <div className="form-starter-route" data-surface="g1-2026-application">
      <ApplicationForm />
    </div>
  );
}
