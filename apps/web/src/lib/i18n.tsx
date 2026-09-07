import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import en from "@/i18n/en";
import si from "@/i18n/si";
import { getAppCookie, setAppCookie } from "./cookies";

export type Locale = "en" | "si";

const LOCALE_COOKIE = "aloysius-g1-locale";

// Statically imported (not dynamically loaded on mount) so the very first
// server-rendered response already contains real translated text — the
// previous dynamic `import()` in a client-only effect meant SSR always shipped
// raw translation keys until hydration swapped them in.
const translations: Record<Locale, Record<string, string>> = { en, si };

function isLocale(value: string): value is Locale {
  return value === "en" || value === "si";
}

function getSavedLocale(): Locale {
  const saved = getAppCookie(LOCALE_COOKIE);
  if (saved && isLocale(saved)) return saved;
  return "en";
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  // Cookie-backed (not localStorage) so the server renders the same locale the
  // client would have picked — no post-hydration locale flash/mismatch.
  const [locale, setLocaleState] = useState<Locale>(getSavedLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setAppCookie(LOCALE_COOKIE, newLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useLocale() {
  return useContext(I18nContext);
}

export function useTranslation() {
  const { locale } = useLocale();

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = translations[locale][key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return value;
    },
    [locale],
  );

  return { t, locale, loaded: true };
}
