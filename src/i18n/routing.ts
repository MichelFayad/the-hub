import { defineRouting } from "next-intl/routing";
import { locales, defaultLocale } from "@/i18n/direction";

export const routing = defineRouting({
  locales: [...locales],
  defaultLocale,
});
