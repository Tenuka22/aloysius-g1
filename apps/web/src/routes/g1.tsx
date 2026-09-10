import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy alias: the G1 dashboard used to be served here. Keep old links working.
export const Route = createFileRoute("/g1")({
  beforeLoad: () => {
    throw redirect({ to: "/g1-admissions" });
  },
});
