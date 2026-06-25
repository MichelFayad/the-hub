// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  issueMobileToken,
  verifyMobileToken,
  requireMobileUser,
  optionalMobileUser,
  MobileAuthError,
} from "@/lib/mobile-auth";

describe("mobile auth tokens", () => {
  it("issues a token that verifies back to the same user/role", async () => {
    const token = await issueMobileToken({ sub: "u1", role: "USER" });
    const session = await verifyMobileToken(token);
    expect(session).toEqual({ userId: "u1", role: "USER" });
  });

  it("rejects a garbage token", async () => {
    expect(await verifyMobileToken("not-a-jwt")).toBeNull();
  });

  it("extracts a valid bearer token from a request", async () => {
    const token = await issueMobileToken({ sub: "u2", role: "ADMIN" });
    const req = new Request("https://e.com", { headers: { authorization: `Bearer ${token}` } });
    const session = await requireMobileUser(req);
    expect(session).toEqual({ userId: "u2", role: "ADMIN" });
  });

  it("throws MobileAuthError for a missing bearer token", async () => {
    const req = new Request("https://e.com");
    await expect(requireMobileUser(req)).rejects.toThrow(MobileAuthError);
  });

  it("throws MobileAuthError for an invalid bearer token", async () => {
    const req = new Request("https://e.com", { headers: { authorization: "Bearer garbage" } });
    await expect(requireMobileUser(req)).rejects.toThrow(MobileAuthError);
  });

  it("optionalMobileUser returns null instead of throwing when absent", async () => {
    const req = new Request("https://e.com");
    expect(await optionalMobileUser(req)).toBeNull();
  });

  it("optionalMobileUser returns the session when present", async () => {
    const token = await issueMobileToken({ sub: "u3", role: "AGENCY" });
    const req = new Request("https://e.com", { headers: { authorization: `Bearer ${token}` } });
    expect(await optionalMobileUser(req)).toEqual({ userId: "u3", role: "AGENCY" });
  });
});
