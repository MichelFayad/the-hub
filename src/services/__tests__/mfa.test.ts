// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { authenticator } from "otplib";
import { prisma } from "@/lib/db";
import {
  beginEnrollment,
  confirmEnrollment,
  verifyMfaCode,
  disableMfa,
  assertMfaSatisfied,
  MfaError,
} from "@/services/mfa";

let userId: string;
let adminId: string;

describe("TOTP MFA", () => {
  beforeAll(async () => {
    const u = await prisma.user.create({
      data: { email: `mfa-${Date.now()}@e.com`, displayName: "MFA", role: "USER" },
    });
    userId = u.id;
    const a = await prisma.user.create({
      data: { email: `mfa-admin-${Date.now()}@e.com`, displayName: "MFA Admin", role: "ADMIN" },
    });
    adminId = a.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userId, adminId] } } });
    await prisma.$disconnect();
  });

  it("begins enrollment with a fresh secret, not yet enabled", async () => {
    const { otpauthUrl } = await beginEnrollment(userId);
    expect(otpauthUrl).toContain("otpauth://totp/");
    const u = await prisma.user.findUnique({ where: { id: userId } });
    expect(u?.mfaEnabled).toBe(false);
    expect(u?.mfaSecret).not.toBeNull();
    // Secret is encrypted at rest — never the raw base32 seed in the column.
    const rawSecretInUrl = decodeURIComponent(otpauthUrl).match(/secret=([A-Z0-9]+)/)?.[1];
    expect(u?.mfaSecret).not.toBe(rawSecretInUrl);
  });

  it("rejects confirmation with a wrong code", async () => {
    await expect(confirmEnrollment({ userId, code: "000000" })).rejects.toThrow(MfaError);
    const u = await prisma.user.findUnique({ where: { id: userId } });
    expect(u?.mfaEnabled).toBe(false);
  });

  it("confirms enrollment with a valid code and enables MFA", async () => {
    const { otpauthUrl } = await beginEnrollment(userId);
    const secret = decodeURIComponent(otpauthUrl).match(/secret=([A-Z0-9]+)/)![1];
    const code = authenticator.generate(secret);
    await confirmEnrollment({ userId, code });
    const u = await prisma.user.findUnique({ where: { id: userId } });
    expect(u?.mfaEnabled).toBe(true);
  });

  it("verifies a correct code once enrolled", async () => {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    const { decryptSecret } = await import("@/lib/crypto");
    const secret = decryptSecret(u!.mfaSecret!);
    const code = authenticator.generate(secret);
    expect(await verifyMfaCode({ userId, code })).toBe(true);
  });

  it("rejects an incorrect code once enrolled", async () => {
    expect(await verifyMfaCode({ userId, code: "111111" })).toBe(false);
  });

  it("disables MFA with a valid code", async () => {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    const { decryptSecret } = await import("@/lib/crypto");
    const secret = decryptSecret(u!.mfaSecret!);
    const code = authenticator.generate(secret);
    await disableMfa({ userId, code });
    const after = await prisma.user.findUnique({ where: { id: userId } });
    expect(after?.mfaEnabled).toBe(false);
    expect(after?.mfaSecret).toBeNull();
  });

  it("blocks an admin without MFA from privileged access", async () => {
    await expect(assertMfaSatisfied(adminId)).rejects.toThrow(MfaError);
  });

  it("allows an admin with MFA enabled", async () => {
    const { otpauthUrl } = await beginEnrollment(adminId);
    const secret = decodeURIComponent(otpauthUrl).match(/secret=([A-Z0-9]+)/)![1];
    const code = authenticator.generate(secret);
    await confirmEnrollment({ userId: adminId, code });
    await expect(assertMfaSatisfied(adminId)).resolves.not.toThrow();
  });

  it("allows a regular user without MFA (optional, not mandatory)", async () => {
    await expect(assertMfaSatisfied(userId)).resolves.not.toThrow();
  });
});
