import { describe, it, expect } from "vitest";
import { hasRole, assertRole, ForbiddenError } from "@/lib/rbac";

describe("rbac", () => {
  it("grants access when the user's role meets the requirement", () => {
    expect(hasRole("ADMIN", "ADMIN")).toBe(true);
  });

  it("grants higher roles access to lower-required actions", () => {
    expect(hasRole("SUPER_ADMIN", "ADMIN")).toBe(true);
  });

  it("denies lower roles", () => {
    expect(hasRole("END_USER", "ADMIN")).toBe(false);
  });

  it("assertRole throws ForbiddenError when denied", () => {
    expect(() => assertRole("END_USER", "ADMIN")).toThrow(ForbiddenError);
  });

  it("assertRole passes silently when allowed", () => {
    expect(() => assertRole("ADMIN", "ADMIN")).not.toThrow();
  });
});
