import PhoneInputPrimitive from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";

function normalizeSriLankanMobile(value: string) {
  const compact = value.replace(/[\s()-]/g, "");
  if (compact.startsWith("+9407")) return `+94${compact.slice(4)}`;
  if (compact.startsWith("07") && compact.length >= 10) return `+94${compact.slice(1)}`;
  return value;
}

export function PhoneInput({ value, onChange, placeholder = "Contact phone number" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <div className="phone-input-field"><PhoneInputPrimitive className="reui-phone-input" defaultCountry="LK" international flags={flags} value={value || undefined} onChange={(next) => onChange(normalizeSriLankanMobile(next ?? ""))} placeholder={placeholder} /><p className="field-help">Saved as +94 70 191 1350</p></div>;
}
