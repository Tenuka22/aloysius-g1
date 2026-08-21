import { useState } from "react";
import { getCountryCallingCode, type Country } from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@aloysius-g1/ui/components/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@aloysius-g1/ui/components/popover";
import { ChevronDownIcon, CheckIcon } from "lucide-react";
import { normalizeSriLankanMobile } from "@/lib/phone";

function formatPhoneDisplay(value: string, country: Country): string {
  if (!value.startsWith("+")) return value;
  const code = getCountryCallingCode(country);
  if (!value.startsWith(`+${code}`)) return value;
  const rest = value.slice(code.length + 1);
  const grouped = rest.replace(/(\d{3})(?=\d)/g, "$1 ");
  return `+${code} ${grouped}`;
}

const COUNTRIES: { value: Country; label: string }[] = [
  { value: "LK", label: "Sri Lanka" },
  { value: "IN", label: "India" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
  { value: "CA", label: "Canada" },
  { value: "SG", label: "Singapore" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "MY", label: "Malaysia" },
  { value: "JP", label: "Japan" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
];

function detectCountry(value: string): Country {
  if (value.startsWith("+94")) return "LK";
  if (value.startsWith("+91")) return "IN";
  if (value.startsWith("+1")) return "US";
  if (value.startsWith("+44")) return "GB";
  if (value.startsWith("+61")) return "AU";
  if (value.startsWith("+12")) return "CA";
  if (value.startsWith("+65")) return "SG";
  if (value.startsWith("+971")) return "AE";
  if (value.startsWith("+60")) return "MY";
  if (value.startsWith("+81")) return "JP";
  if (value.startsWith("+49")) return "DE";
  if (value.startsWith("+33")) return "FR";
  return "LK";
}

function CountrySelect({ value, onChange }: { value: Country; onChange: (country: Country) => void }) {
  const [open, setOpen] = useState(false);
  const current = COUNTRIES.find((c) => c.value === value) ?? COUNTRIES[0];
  const Flag = flags[current.value];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={
        <button
          type="button"
          className="inline-flex items-center gap-1.5 border-0 bg-transparent px-2 h-8 text-sm cursor-pointer hover:bg-muted/50 outline-none overflow-hidden"
        />
      }>
        {Flag && <span className="block w-5 h-4 overflow-hidden"><Flag title={current.label} /></span>}
        <ChevronDownIcon className="size-3 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" side="bottom" sideOffset={4}>
        <div className="max-h-64 overflow-y-auto">
          {COUNTRIES.map((country) => {
            const CountryFlag = flags[country.value];
            return (
              <button
                key={country.value}
                type="button"
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground outline-none ${country.value === value ? "bg-accent text-accent-foreground" : ""}`}
                onClick={() => { onChange(country.value); setOpen(false); }}
              >
                {CountryFlag && <span className="block w-5 h-4 overflow-hidden shrink-0"><CountryFlag title={country.label} /></span>}
                <span className="flex-1 text-left">{country.label}</span>
                {country.value === value && <CheckIcon className="size-4" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function PhoneInput({ value, onChange, placeholder = "Contact phone number" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const country = detectCountry(value);

  return (
    <div className="grid gap-1.5">
      <InputGroup>
        <InputGroupAddon align="inline-start" className="pl-0 border-r border-input">
          <CountrySelect
            value={country}
            onChange={(newCountry) => {
              const digits = value.replace(/^\+\d+/, "").replace(/\D/g, "");
              const code = getCountryCallingCode(newCountry);
              const raw = `+${code}${digits}`;
              onChange(raw);
            }}
          />
        </InputGroupAddon>
        <InputGroupInput
          type="tel"
          value={value}
          onChange={(e) => onChange(normalizeSriLankanMobile(e.target.value))}
          placeholder={placeholder}
          className="pl-2"
        />
      </InputGroup>
      {value && <p className="text-xs text-muted-foreground">Saved as {formatPhoneDisplay(value, country)}</p>}
    </div>
  );
}
