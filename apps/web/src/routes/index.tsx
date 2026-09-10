import { createFileRoute } from "@tanstack/react-router";
import { BuildingPage } from "@/components/g1/home/building-page";
import { ErrorState } from "@/components/error-state";

// School website landing page - currently a "Building..." placeholder. The
// Grade 1 admissions dashboard moved to /g1-admissions (routes/g1-admissions.tsx).
export const Route = createFileRoute("/")({
  errorComponent: (props) => <ErrorState {...props} />,
  component: BuildingPage,
});
