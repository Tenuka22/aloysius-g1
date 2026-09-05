import { useState } from "react";
import { Globe } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "@aloysius-g1/ui/components/popover";

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);

  const select = (next: "en" | "si") => {
    setLocale(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Change language"
        className="fixed bottom-4 right-4 z-50 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg h-11 w-11 hover:bg-primary/90 transition-colors"
      >
        <Globe size={20} />
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-44 p-1">
        <button
          type="button"
          onClick={() => select("en")}
          className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground outline-none ${locale === "en" ? "bg-accent text-accent-foreground font-medium" : ""}`}
        >
          <span className="text-base">🇬🇧</span> English
        </button>
        <button
          type="button"
          onClick={() => select("si")}
          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground outline-none ${locale === "si" ? "bg-accent text-accent-foreground font-medium" : ""}`}
        >
          <span className="flex items-center gap-2">
            <span className="text-base">🇱🇰</span> සිංහල
          </span>
          {locale === "si" && <span className="text-xs text-primary">●</span>}
        </button>
      </PopoverContent>
    </Popover>
  );
}
