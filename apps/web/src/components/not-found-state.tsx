"use client";

import { useTranslation } from "@/lib/i18n";
import { Button } from "@aloysius-admissions/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@aloysius-admissions/ui/components/empty";
import { MapPinOff } from "lucide-react";

export function NotFoundState() {
  const { t } = useTranslation();

  const handleHome = () => {
    window.location.href = "/";
  };

  return (
    <div className="flex h-svh items-center justify-center p-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <MapPinOff className="text-muted-foreground" size={32} />
          </EmptyMedia>
          <EmptyTitle>{t("error.notFound.title")}</EmptyTitle>
          <EmptyDescription>{t("error.notFound.description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button onClick={handleHome}>{t("error.notFound.home")}</Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
