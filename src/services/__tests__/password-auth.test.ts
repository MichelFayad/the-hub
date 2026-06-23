// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  registerWithPassword,
  authenticateWithPassword,
  AuthError,
} from "@/services/password-auth";
import { beginEnrollment, confirmEnrollment } from "@/services/mfa";
import { authenticator } from "otplib";

const userIds: string[] = [];

describe("email/password auth", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("registers a user with a hashed password, never plaintext", async () => {
    const email = `pw-${Date.now()}@e.com`;
    const user = await registerWithPassword({ email, password: "Sup3rSecret!", displayName: "PW" });
    userIds.push(user.id);
    const row = await prisma.user.findUnique({ where: { id: user.id } });
    expect(row?.passwordHash).not.toBe("Sup3rSecret!");
    expect(row?.passwordHash).not.toBeNull();
  });

  it("authenticates with the correct password", async () => {
    const email = `pw-${Date.now()}@e.com`;
    const user = await registerWithPassword({ email, password: "Correct1!", displayName: "PW2" });
    userIds.push(user.id);
    const authed = await authenticateWithPassword({ email, password: "Correct1!" });
    expect(authed.id).toBe(user.id);
  });

  it("rejects an incorrect password", async () => {
    const email = `pw-${Date.now()}@e.com`;
    await registerWithPassword({ email, password: "Correct1!", displayName: "PW3" }).then((u) =>
      userIds.push(u.id),
    );
    await expect(authenticateWithPassword({ email, password: "Wrong1!" })).rejects.toThrow(AuthError);
  });

  it("locks the account after repeated failed attempts", async () => {
    const email = `pw-${Date.now()}@e.com`;
    const user = await registerWithPassword({ email, password: "Correct1!", displayName: "PW4" });
    userIds.push(user.id);
    for (let i = 0; i < 5; i++) {
      await authenticateWithPassword({ email, password: "Wrong1!" }).catch(() => {});
    }
    await expect(authenticateWithPassword({ email, password: "Correct1!" })).rejects.toThrow(
      /locked/i,
    );
  });

  it("resets the failure counter on a successful login", async () => {
    const email = `pw-${Date.now()}@e.com`;
    const user = await registerWithPassword({ email, password: "Correct1!", displayName: "PW5" });
    userIds.push(user.id);
    await authenticateWithPassword({ email, password: "Wrong1!" }).catch(() => {});
    await authenticateWithPassword({ email, password: "Correct1!" });
    const row = await prisma.user.findUnique({ where: { id: user.id } });
    expect(row?.failedLoginAttempts).toBe(0);
  });

  it("requires a valid TOTP code for an MFA-enabled admin", async () => {
    const email = `pw-admin-${Date.now()}@e.com`;
    const user = await registerWithPassword({
      email,
      password: "Correct1!",
      displayName: "PWAdmin",
      role: "ADMIN",
    });
    userIds.push(user.id);
    const { otpauthUrl } = await beginEnrollment(user.id);
    const secret = decodeURIComponent(otpauthUrl).match(/secret=([A-Z0-9]+)/)![1];
    await confirmEnrollment({ userId: user.id, code: authenticator.generate(secret) });

    await expect(authenticateWithPassword({ email, password: "Correct1!" })).rejects.toThrow(
      AuthError,
    );
    const ok = await authenticateWithPassword({
      email,
      password: "Correct1!",
      mfaCode: authenticator.generate(secret),
    });
    expect(ok.id).toBe(user.id);
  });
});
