export function normalizeSriLankanMobile(value: string): string {
  const compact = value.replace(/[\s()\-]/g, "");
  if (compact.startsWith("+9407")) {
    const rest = compact.slice(4);
    return `+94${rest}`;
  }
  if (compact.startsWith("07") && compact.length >= 10) {
    const rest = compact.slice(1);
    return `+94${rest}`;
  }
  return value;
}

export function isLikelySriLankanMobile(value: string): boolean {
  const compact = value.replace(/[\s()\-]/g, "");
  return compact.startsWith("+94") || compact.startsWith("07");
}

export function formatPhoneDisplay(value: string): string {
  if (!value) return "";
  const compact = value.replace(/[\s()\-]/g, "");
  if (compact.startsWith("+94") && compact.length === 12) {
    const rest = compact.slice(3);
    return `+94 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`;
  }
  if (compact.startsWith("+")) {
    return compact.replace(/(\+\d{1,3})(\d{1,3})?(\d+)?/, (_, code, mid, rest) =>
      [code, mid, rest].filter(Boolean).join(" ")
    );
  }
  return compact;
}