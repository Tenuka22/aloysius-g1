import { Link } from "@tanstack/react-router";
import { INTAKE_YEAR_DEFAULT } from "@/lib/g1/intake-year";
import { useTranslation } from "@/lib/i18n";

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="mt-auto">
      <div className="h-1 bg-gradient-to-r from-primary-dark via-primary to-primary-dark" />
      <div className="border-t bg-muted/40">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div className="flex flex-col gap-1.5">
            <span className="text-base font-semibold tracking-tight sm:text-lg">
              {t("footer.brand")}
            </span>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {t("footer.tagline")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-5 text-sm sm:grid-cols-3 sm:gap-x-16 sm:gap-y-6">
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-foreground">{t("footer.project.heading")}</span>
              <Link to="/admissions" className="text-muted-foreground no-underline hover:text-foreground">{t("footer.project.portal")}</Link>
              <span className="text-muted-foreground">{t("footer.project.intake", { year: INTAKE_YEAR_DEFAULT })}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-foreground">{t("footer.school.heading")}</span>
              <span className="text-muted-foreground">{t("footer.school.name")}</span>
              <span className="text-muted-foreground">{t("footer.school.location")}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-foreground">{t("footer.developers.heading")}</span>
              <span className="text-muted-foreground">{t("footer.developers.name1")}</span>
              <span className="text-muted-foreground">{t("footer.developers.name2")}</span>
            </div>
          </div>
        </div>

        <div className="border-t">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-1 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6 sm:py-4">
            <span>
              {t("footer.copyright", { year: new Date().getFullYear() })}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
