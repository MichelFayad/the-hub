import { describe, it, expect } from "vitest";
import { parseEnv } from "@/lib/env";

const valid = {
  DATABASE_URL: "postgresql://hub:hub@localhost:5432/hub",
  AUTH_SECRET: "x".repeat(32),
  SENTRY_DSN: "",
  DEFAULT_LOCALE: "en",
};

describe("parseEnv", () => {
  it("parses a valid environment", () => {
    const env = parseEnv(valid);
    expect(env.DATABASE_URL).toContain("postgresql://");
    expect(env.DEFAULT_LOCALE).toBe("en");
  });

  it("throws when DATABASE_URL is missing", () => {
    const { DATABASE_URL, ...rest } = valid;
    expect(() => parseEnv(rest as Record<string, string>)).toThrow();
  });

  it("rejects an unsupported default locale", () => {
    expect(() => parseEnv({ ...valid, DEFAULT_LOCALE: "de" })).toThrow();
  });
});
