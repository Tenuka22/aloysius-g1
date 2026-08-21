import { applicantSectionComplete } from "./eligibility";
import type { ApplicationDraft, LocationDraft } from "./application-store";

export type CompletionData = {
  location?: Partial<LocationDraft>;
  applicant?: Partial<ApplicationDraft["applicant"]>;
  guardian?: Partial<ApplicationDraft["guardian"]>;
  residence?: Partial<ApplicationDraft["residence"]>;
  declaration?: Partial<ApplicationDraft["declaration"]>;
};

export function completionPercent(data: CompletionData | null | undefined): number {
  if (!data) return 0;
  const checks = [
    Boolean(data.location?.address || data.location?.latitude != null),
    applicantSectionComplete(data.applicant),
    Boolean(
      data.guardian?.relationship &&
        data.guardian?.fullName &&
        data.guardian?.nic &&
        data.guardian?.phone &&
        data.guardian?.email,
    ),
    Boolean(
      data.residence?.permanentAddress &&
        data.residence?.district &&
        data.residence?.dsDivision &&
        data.residence?.gnDivision &&
        data.residence?.electoralDistrict,
    ),
    Boolean(data.declaration?.confirmed && data.declaration?.consent),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}