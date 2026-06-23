import { describe, it, expect, vi } from "vitest";
import { initMonitoring } from "@/lib/monitoring";

describe("initMonitoring", () => {
  it("returns false and does not throw when no DSN is set", () => {
    expect(initMonitoring("")).toBe(false);
  });

  it("returns true when a DSN is provided", () => {
    const spy = vi.fn();
    expect(initMonitoring("https://abc@o0.ingest.sentry.io/1", spy)).toBe(true);
    expect(spy).toHaveBeenCalledOnce();
  });
});
