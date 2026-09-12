"use client";

import { useMemo } from "react";
import { isChunkLoadError } from "@/lib/chunk-reload";
import { STATUS_ERROR } from "@/lib/color-classes";
import { useTranslation } from "@/lib/i18n";
import { SUPPORT_CONTACT } from "@/lib/g1/school-config";
import { Button } from "@aloysius-admissions/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@aloysius-admissions/ui/components/empty";
import { MessageCircle, TriangleAlert } from "lucide-react";

interface ErrorStateProps {
  error?: unknown;
  reset?: () => void;
}

function buildErrorWhatsAppLink(error: unknown, pagePath: string): string {
  const url = new URL(window.location.href);
  const sessionCode = url.searchParams.get("code") || url.searchParams.get("key") || "-";
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  const timestamp = new Date().toISOString();

  const message =
    `Hello, I encountered an error on the Grade 1 admissions portal.\n\n` +
    `Page: ${pagePath}\n` +
    `Session/Key: ${sessionCode}\n` +
    `Time: ${timestamp}\n` +
    `Error: ${errorMessage}\n\n` +
    `Please help me resolve this issue.`;

  return `https://wa.me/${SUPPORT_CONTACT.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export function ErrorState({ error, reset }: ErrorStateProps) {
  const { t } = useTranslation();

  const handleRetry = () => {
    if (isChunkLoadError(error)) {
      window.location.reload();
    } else if (reset) {
      reset();
    } else {
      window.location.reload();
    }
  };

  const handleHome = () => {
    window.location.href = "/";
  };

  const errorMessage = error instanceof Error ? error.message : undefined;
  const pagePath = typeof window !== "undefined" ? window.location.pathname : "/";
  const whatsappHref = useMemo(() => buildErrorWhatsAppLink(error, pagePath), [error, pagePath]);

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
            <Button
              variant="outline"
              className="gap-1.5"
              render={
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" />
              }
              nativeButton={false}
            >
              <MessageCircle size={14} />
              {t("error.boundary.whatsapp")}
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
