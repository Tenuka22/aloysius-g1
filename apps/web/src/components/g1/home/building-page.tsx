import { Link } from "@tanstack/react-router";
import { ArrowRight, HardHat } from "lucide-react";
import { Button } from "@aloysius-admissions/ui/components/button";
import { Eyebrow } from "@aloysius-admissions/ui/components/eyebrow";
import { HeroVignette } from "@aloysius-admissions/ui/components/hero-vignette";
import { INTAKE_YEAR_DEFAULT } from "@/lib/g1/intake-year";
import { useTranslation } from "@/lib/i18n";

// Placeholder landing page for the school website while the real site is
// being built. The Grade 1 admissions portal lives at /admissions and is
// linked from here so the working part of the site stays reachable. Built as
// a full-bleed crest-green hero (not a small centered card) so it carries
// the same visual weight and brand language as the admissions dashboard.
export function BuildingPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-svh flex-col bg-primary text-primary-foreground" data-surface="school-home-building">
      <main className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* Layered lighting: a soft gold vignette from the top and a faint
            radial lift behind the crest - both scale with the viewport
            instead of anchoring to fixed pixel coordinates, so the effect
            holds from a 320px phone through an 8K display. */}
        <HeroVignette variant="vertical" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_38%,color-mix(in_oklch,var(--primary-foreground)_8%,transparent),transparent_70%)]"
        />

        <div className="relative z-10 mx-auto grid w-full max-w-(--breakpoint-lg) place-items-center gap-[clamp(1.5rem,2vw+1rem,2.5rem)] px-[clamp(1.25rem,5vw,4rem)] py-[clamp(3rem,6vw+2rem,6rem)] text-center">
          <img
            src="/logo.png"
            alt={t("building.crestAlt")}
            className="h-[clamp(6rem,8vw+3rem,11rem)] w-[clamp(6rem,8vw+3rem,11rem)] object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            width={176}
            height={176}
          />

          <div className="grid gap-3">
            <h1 className="font-display text-6xl font-semibold tracking-tight leading-[1.05]">
              {t("building.schoolName")}
            </h1>
            <p className="text-primary-foreground/75 text-[clamp(0.95rem,0.85rem+0.4vw,1.25rem)] tracking-wide">
              {t("building.location")}
            </p>
            <Eyebrow variant="rule" className="mx-auto pt-1">
              {t("auth.hero.motto")}
            </Eyebrow>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/6 px-3.5 py-1.5 backdrop-blur-sm">
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-gold opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-gold" />
            </span>
            <HardHat size={13} strokeWidth={2.25} className="text-brand-gold" />
            <span className="text-[0.75rem] font-medium tracking-wide text-primary-foreground/85">
              {t("building.status")}
            </span>
          </div>

          <p className="max-w-[38rem] text-[clamp(0.9rem,0.85rem+0.2vw,1.0625rem)] leading-relaxed text-primary-foreground/70">
            {t("building.description")}
          </p>

          <Link to="/admissions" className="contents">
            <Button
              type="button"
              variant="premium"
              size="lg"
              className="group h-auto gap-2.5 rounded-full px-[clamp(1.5rem,2vw+1rem,2.25rem)] py-[clamp(0.75rem,1vw+0.5rem,1rem)] text-[clamp(0.9rem,0.85rem+0.15vw,1.0625rem)] font-semibold"
            >
              {t("building.admissionsCta", { year: INTAKE_YEAR_DEFAULT })}
              <ArrowRight size={18} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
