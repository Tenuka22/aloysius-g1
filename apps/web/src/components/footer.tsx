import { Heart } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="mt-auto">
      <div className="h-1 bg-gradient-to-r from-primary/80 via-primary to-primary/80" />
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
              <span className="text-muted-foreground">{t("footer.project.portal")}</span>
              <span className="text-muted-foreground">{t("footer.project.intake")}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-foreground">{t("footer.school.heading")}</span>
              <span className="text-muted-foreground">{t("footer.school.name")}</span>
              <span className="text-muted-foreground">{t("footer.school.location")}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-foreground">{t("footer.developers.heading")}</span>
              <span className="text-muted-foreground">{t("footer.developers.name")}</span>
            </div>
          </div>
        </div>

        <div className="border-t">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-1 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6 sm:py-4">
            <span>
              {t("footer.copyright", { year: new Date().getFullYear() })}
            </span>
            <span className="flex items-center gap-1">
              {t("footer.builtWith")}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
