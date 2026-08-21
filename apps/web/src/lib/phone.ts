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