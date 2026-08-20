import PhoneInputPrimitive from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";

export function PhoneInput({ value, onChange, placeholder = "Contact phone number" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <PhoneInputPrimitive className="reui-phone-input" defaultCountry="LK" international flags={flags} value={value || undefined} onChange={(next) => onChange(next ?? "")} placeholder={placeholder} />;
}
