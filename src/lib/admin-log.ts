import { prisma } from "@/lib/db";
import { assertRole } from "@/lib/rbac";
import type { AppRole } from "@/lib/auth-helpers";
import type { Prisma } from "@/generated/prisma/client";

// Shared by every admin-console action (scope §4.7): load the actor's role
// and assert ADMIN-or-above, then write the privileged-action audit trail.

/** Load an actor's role and assert it meets ADMIN, else throw ForbiddenError. */
export async function assertAdmin(adminUserId: string): Promise<AppRole> {
  const actor = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { role: true },
  });
  if (!actor) throw new Error("admin user not found");
  const role = actor.role as AppRole;
  assertRole(role, "ADMIN");
  return role;
}

/** Append one row to the privileged-action audit trail. */
export async function logAdminAction(
  adminUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Prisma.InputJsonValue = {},
): Promise<void> {
  await prisma.adminActionLog.create({
    data: { adminUserId, action, targetType, targetId, metadata },
  });
}
