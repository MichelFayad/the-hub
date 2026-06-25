import { prisma } from "@/lib/db";
import { assertAdmin, logAdminAction } from "@/lib/admin-log";
import { assertRole, hasRole } from "@/lib/rbac";
import type { AppRole } from "@/lib/auth-helpers";
import { createNotification } from "@/services/notifications";

// Admin end-user management (scope §4.7): suspend blocks login (enforced
// in password-auth.ts) without touching review history, unlike the
// user-initiated soft-delete (isDeleted). Reversible via reinstateUser.
// Suspending an ADMIN/SUPER_ADMIN account requires the actor to be
// SUPER_ADMIN — a plain ADMIN cannot suspend a peer or superior.

async function assertCanActOnTarget(actorRole: AppRole, targetRole: AppRole): Promise<void> {
  if (hasRole(targetRole, "ADMIN")) {
    assertRole(actorRole, "SUPER_ADMIN");
  }
}

/** Admin: suspend a user account, blocking login until reinstated. */
export async function suspendUser(args: {
  adminUserId: string;
  userId: string;
  reason?: string;
}) {
  const actorRole = await assertAdmin(args.adminUserId);
  const target = await prisma.user.findUnique({ where: { id: args.userId } });
  if (!target) throw new Error("user not found");
  await assertCanActOnTarget(actorRole, target.role as AppRole);
  if (target.suspendedAt) throw new Error("user is already suspended");

  const updated = await prisma.user.update({
    where: { id: args.userId },
    data: { suspendedAt: new Date() },
  });
  await logAdminAction(args.adminUserId, "SUSPEND_USER", "User", updated.id, {
    reason: args.reason ?? null,
  });
  await createNotification({
    userId: updated.id,
    type: "ACCOUNT_SUSPENDED",
    title: "Your account was suspended",
    body: args.reason,
  });
  return updated;
}

/** Admin: reinstate a suspended user account. */
export async function reinstateUser(args: { adminUserId: string; userId: string }) {
  const actorRole = await assertAdmin(args.adminUserId);
  const target = await prisma.user.findUnique({ where: { id: args.userId } });
  if (!target) throw new Error("user not found");
  await assertCanActOnTarget(actorRole, target.role as AppRole);
  if (!target.suspendedAt) throw new Error("user is not suspended");

  const updated = await prisma.user.update({
    where: { id: args.userId },
    data: { suspendedAt: null },
  });
  await logAdminAction(args.adminUserId, "REINSTATE_USER", "User", updated.id);
  await createNotification({
    userId: updated.id,
    type: "ACCOUNT_REINSTATED",
    title: "Your account was reinstated",
  });
  return updated;
}
