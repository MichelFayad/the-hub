// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { suspendUser, reinstateUser } from "@/services/users";
import { ForbiddenError } from "@/lib/rbac";

let superAdmin: string;
let admin: string;
let user: string;
let peerAdmin: string;
const userIds: string[] = [];

describe("admin user management", () => {
  beforeAll(async () => {
    const sa = await prisma.user.create({
      data: { email: `um-sa-${Date.now()}@e.com`, displayName: "SuperAdmin", role: "SUPER_ADMIN" },
    });
    const a = await prisma.user.create({
      data: { email: `um-admin-${Date.now()}@e.com`, displayName: "Admin", role: "ADMIN" },
    });
    const u = await prisma.user.create({
      data: { email: `um-user-${Date.now()}@e.com`, displayName: "User", role: "USER" },
    });
    const pa = await prisma.user.create({
      data: { email: `um-peer-${Date.now()}@e.com`, displayName: "PeerAdmin", role: "ADMIN" },
    });
    superAdmin = sa.id;
    admin = a.id;
    user = u.id;
    peerAdmin = pa.id;
    userIds.push(superAdmin, admin, user, peerAdmin);
  });

  afterAll(async () => {
    await prisma.adminActionLog.deleteMany({ where: { adminUserId: { in: userIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("suspends a user, blocking until reinstated, and logs + notifies", async () => {
    const updated = await suspendUser({ adminUserId: admin, userId: user, reason: "spam" });
    expect(updated.suspendedAt).not.toBeNull();
    const log = await prisma.adminActionLog.findFirst({
      where: { adminUserId: admin, action: "SUSPEND_USER", targetId: user },
    });
    expect(log?.metadata).toMatchObject({ reason: "spam" });
    const notif = await prisma.notification.findFirst({
      where: { userId: user, type: "ACCOUNT_SUSPENDED" },
    });
    expect(notif).not.toBeNull();
  });

  it("refuses to suspend an already-suspended user", async () => {
    await expect(suspendUser({ adminUserId: admin, userId: user })).rejects.toThrow(/already suspended/);
  });

  it("reinstates a suspended user and notifies", async () => {
    const updated = await reinstateUser({ adminUserId: admin, userId: user });
    expect(updated.suspendedAt).toBeNull();
    const notif = await prisma.notification.findFirst({
      where: { userId: user, type: "ACCOUNT_REINSTATED" },
    });
    expect(notif).not.toBeNull();
  });

  it("refuses to reinstate a user who isn't suspended", async () => {
    await expect(reinstateUser({ adminUserId: admin, userId: user })).rejects.toThrow(/not suspended/);
  });

  it("rejects suspension attempts from a non-admin actor", async () => {
    await expect(suspendUser({ adminUserId: user, userId: admin })).rejects.toThrow(ForbiddenError);
  });

  it("requires SUPER_ADMIN to suspend an ADMIN account", async () => {
    await expect(suspendUser({ adminUserId: admin, userId: peerAdmin })).rejects.toThrow(ForbiddenError);
    const updated = await suspendUser({ adminUserId: superAdmin, userId: peerAdmin });
    expect(updated.suspendedAt).not.toBeNull();
  });
});
