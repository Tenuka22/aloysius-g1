import PhoneInputPrimitive from "react-phone-number-input";
import "react-phone-number-input/style.css";

export function PhoneInput({ value, onChange, placeholder = "Contact phone number" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <PhoneInputPrimitive className="reui-phone-input" defaultCountry="LK" international value={value || undefined} onChange={(next) => onChange(next ?? "")} placeholder={placeholder} />;
}
