import { describe, it, expect } from "vitest";
import { attachRole, roleLabel } from "@/lib/auth-helpers";

describe("attachRole", () => {
  it("copies the role from token onto session.user", () => {
    const session = { user: { email: "a@b.com", name: "A" } } as any;
    const token = { role: "ADMIN" } as any;
    const result = attachRole(session, token);
    expect(result.user.role).toBe("ADMIN");
  });

  it("defaults to USER when token has no role", () => {
    const session = { user: { email: "a@b.com", name: "A" } } as any;
    const result = attachRole(session, {} as any);
    expect(result.user.role).toBe("USER");
  });
});

describe("roleLabel", () => {
  it("maps each role to its human-readable display name", () => {
    expect(roleLabel("SUPER_ADMIN")).toBe("SuperAdmin");
    expect(roleLabel("ADMIN")).toBe("Admin");
    expect(roleLabel("USER")).toBe("User");
    expect(roleLabel("AGENCY")).toBe("Agency");
    expect(roleLabel("BUSINESS_OWNER")).toBe("Business Owner");
  });
});
