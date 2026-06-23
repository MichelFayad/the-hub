import { describe, it, expect } from "vitest";
import { attachRole } from "@/lib/auth-helpers";

describe("attachRole", () => {
  it("copies the role from token onto session.user", () => {
    const session = { user: { email: "a@b.com", name: "A" } } as any;
    const token = { role: "ADMIN" } as any;
    const result = attachRole(session, token);
    expect(result.user.role).toBe("ADMIN");
  });

  it("defaults to END_USER when token has no role", () => {
    const session = { user: { email: "a@b.com", name: "A" } } as any;
    const result = attachRole(session, {} as any);
    expect(result.user.role).toBe("END_USER");
  });
});
