export const locales = ["en", "ar", "fr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

const RTL: Locale[] = ["ar"];

export function getDirection(locale: Locale): "rtl" | "ltr" {
  return RTL.includes(locale) ? "rtl" : "ltr";
}
