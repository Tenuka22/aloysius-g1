import { createFileRoute } from "@tanstack/react-router";
import { AdmissionsInfoPage } from "@/components/g1/home/admissions-info-page";
import { ErrorState } from "@/components/error-state";

// Landing page for admissions.aloysiuscollege.lk - shows the admissions info
// (demo video, interview schedule, contact). The application dashboard lives
// at /admissions instead.
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "St. Aloysius' College - Grade 1 Admissions" },
      {
        name: "description",
        content: "Online admissions portal for Grade 1 applications to St. Aloysius' College, Galle.",
      },
    ],
  }),
  errorComponent: (props) => <ErrorState {...props} />,
  component: AdmissionsInfoPage,
});
