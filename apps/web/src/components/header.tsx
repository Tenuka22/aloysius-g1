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
            className="h-8 w-8 shrink-0 object-contain"
            width={32}
            height={32}
          />
          <span className="truncate font-heading text-sm font-semibold text-foreground sm:text-base">
            {t("header.brand")}
          </span>
        </Link>

        <UserMenu />
      </div>
    </header>
  );
}
