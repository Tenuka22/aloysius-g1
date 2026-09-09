"use client";

import { STATUS_ERROR } from "@/lib/color-classes";
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
import { TriangleAlert } from "lucide-react";

interface ErrorStateProps {
  error?: unknown;
  reset?: () => void;
}

export function ErrorState({ error, reset }: ErrorStateProps) {
  const { t } = useTranslation();

  const handleRetry = () => {
    if (reset) {
      reset();
    } else {
      window.location.reload();
    }
  };

  const handleHome = () => {
    window.location.href = "/";
  };

  // Extract error message if error is an Error instance
  const errorMessage = error instanceof Error ? error.message : undefined;

  return (
    <div className="flex h-svh items-center justify-center p-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <TriangleAlert className={STATUS_ERROR.text} size={32} />
          </EmptyMedia>
          <EmptyTitle>{t("error.boundary.title")}</EmptyTitle>
          <EmptyDescription>{t("error.boundary.description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {errorMessage && (
            <details className="mb-4 w-full max-w-sm text-left">
              <summary className="cursor-pointer font-medium text-sm">
                {t("error.boundary.details")}
              </summary>
              <pre className="mt-2 rounded bg-muted p-2 text-xs overflow-auto max-h-48 whitespace-pre-wrap break-words">
                {errorMessage}
              </pre>
            </details>
          )}
          <div className="flex gap-2 justify-center flex-wrap">
            <Button onClick={handleRetry}>{t("error.boundary.retry")}</Button>
            <Button variant="outline" onClick={handleHome}>
              {t("error.boundary.home")}
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
