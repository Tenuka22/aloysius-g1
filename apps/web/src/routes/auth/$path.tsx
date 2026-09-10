import { viewPaths } from "@better-auth-ui/core";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { Auth } from "@/components/auth/auth";
import { useTranslation } from "@/lib/i18n";

const validAuthPaths = new Set(Object.values(viewPaths.auth));

export const Route = createFileRoute("/auth/$path")({
  beforeLoad({ params: { path } }) {
    if (!validAuthPaths.has(path)) {
      throw redirect({ to: "/" });
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const { path } = Route.useParams();
  const { t } = useTranslation();

  return (
    <div className="grid min-h-svh md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground md:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,color-mix(in_oklch,var(--brand-gold)_28%,transparent),transparent_45%)]"
        />
        <Link to="/" className="relative z-10 flex items-center gap-3 no-underline">
          <img src="/logo.png" alt="" className="h-12 w-12 object-contain" width={48} height={48} />
          <span className="font-heading text-lg font-semibold text-primary-foreground">
            {t("header.brand")}
          </span>
        </Link>
        <div className="relative z-10 grid gap-3">
          <p className="font-heading text-[clamp(1.75rem,3vw,2.75rem)] leading-tight">
            {t("auth.hero.title")}
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-primary-foreground/80">
            {t("auth.hero.subtitle")}
          </p>
        </div>
        <p className="relative z-10 font-heading text-sm tracking-[0.25em] text-brand-gold uppercase">
          {t("auth.hero.motto")}
        </p>
      </div>

      <div className="flex flex-col justify-center gap-6 p-4 sm:p-6">
        <Link to="/" className="flex items-center justify-center gap-2.5 no-underline md:hidden">
          <img src="/logo.png" alt="" className="h-9 w-9 object-contain" width={36} height={36} />
          <span className="font-heading text-base font-semibold text-foreground">
            {t("header.brand")}
          </span>
        </Link>
        <div className="flex justify-center">
          <Auth path={path} />
        </div>
      </div>
    </div>
  );
}
