import { Link } from "@tanstack/react-router";

import { useTranslation } from "@/lib/i18n";
import UserMenu from "./user-menu";

export default function Header() {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-sm supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2.5 no-underline">
          <img
            src="/logo.png"
            alt=""
            className="h-9 w-9 shrink-0 object-contain"
            width={36}
            height={36}
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-heading text-sm font-semibold text-foreground sm:text-base">
              {t("header.brand")}
            </span>
            <span className="hidden truncate text-[0.68rem] text-muted-foreground sm:block">
              {t("header.brand.school")}
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
