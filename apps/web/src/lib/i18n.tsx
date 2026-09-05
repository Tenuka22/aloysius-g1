import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export type Locale = "en" | "si";

const LOCALE_KEY = "aloysius-g1-locale";

function isLocale(value: string): value is Locale {
  return value === "en" || value === "si";
}

function getSavedLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (saved && isLocale(saved)) return saved;
  } catch {}
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
  const [locale, setLocaleState] = useState<Locale>(getSavedLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(LOCALE_KEY, newLocale);
    } catch {}
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

let translations: Record<Locale, Record<string, string>> | null = null;

async function loadTranslations() {
  if (translations) return translations;
  const [enMod, siMod] = await Promise.all([
    import("@/i18n/en"),
    import("@/i18n/si"),
  ]);
  translations = { en: enMod.default, si: siMod.default };
  return translations;
}

export function useTranslation() {
  const { locale } = useLocale();
  const [loaded, setLoaded] = useState(translations !== null);
  const [currentTranslations, setCurrentTranslations] = useState<Record<string, string>>(() => translations?.[locale] ?? {});

  useEffect(() => {
    void loadTranslations().then((t) => {
      setCurrentTranslations(t[locale]);
      setLoaded(true);
    });
  }, [locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = currentTranslations[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return value;
    },
    [currentTranslations],
  );

  return { t, locale, loaded };
}
