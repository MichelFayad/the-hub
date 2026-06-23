import { describe, it, expect } from "vitest";
import { getDirection, locales, defaultLocale } from "@/i18n/direction";

describe("locale direction", () => {
  it("returns rtl for Arabic", () => {
    expect(getDirection("ar")).toBe("rtl");
  });

  it("returns ltr for English and French", () => {
    expect(getDirection("en")).toBe("ltr");
    expect(getDirection("fr")).toBe("ltr");
  });

  it("exposes the three supported locales", () => {
    expect(locales).toEqual(["en", "ar", "fr"]);
    expect(defaultLocale).toBe("en");
  });
});
