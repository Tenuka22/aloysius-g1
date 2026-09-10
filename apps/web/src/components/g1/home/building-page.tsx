import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@aloysius-admissions/ui/components/button";
import { INTAKE_YEAR_DEFAULT } from "@/lib/g1/intake-year";
import { useTranslation } from "@/lib/i18n";

// Placeholder landing page for the school website while the real site is
// being built. The Grade 1 admissions portal lives at /g1-admissions and is
// linked from here so the working part of the site stays reachable.
export function BuildingPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-svh flex-col" data-surface="school-home-building">
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12 sm:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_55%)]"
        />
        <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-6 text-center">
          <img
            src="/logo.png"
            alt={t("building.crestAlt")}
            className="h-32 w-32 object-contain drop-shadow-md sm:h-40 sm:w-40"
            width={160}
            height={160}
          />
          <div className="grid gap-1">
            <p className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t("building.schoolName")}
            </p>
            <p className="text-sm text-muted-foreground">{t("building.location")}</p>
            <p className="font-heading text-xs tracking-[0.25em] text-brand-gold uppercase">
              {t("auth.hero.motto")}
            </p>
          </div>

          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            {t("building.description")}
          </p>

          <Link to="/g1-admissions" className="contents">
            <Button type="button" className="shadow-md shadow-primary/15">
              {t("building.admissionsCta", { year: INTAKE_YEAR_DEFAULT })}
              <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
