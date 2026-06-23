import { prisma } from "@/lib/db";
import { assertRole } from "@/lib/rbac";
import type { AppRole } from "@/lib/auth-helpers";
import type { Prisma } from "@/generated/prisma/client";
import { createNotification } from "@/services/notifications";

// Listing lifecycle (scope §5). Business users self-register a listing or
// claim an existing one; both land in a PENDING state. An admin approves or
// rejects. Every privileged decision is written to the AdminActionLog audit
// trail. RBAC is enforced server-side here, never in the UI alone.

/** Load an actor's role and assert it meets ADMIN, else throw ForbiddenError. */
async function assertAdmin(adminUserId: string): Promise<void> {
  const actor = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { role: true },
  });
  if (!actor) throw new Error("admin user not found");
  assertRole(actor.role as AppRole, "ADMIN");
}

/** Append one row to the privileged-action audit trail. */
async function logAction(
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

export interface RegisterLocationInput {
  ownerUserId: string;
  name: string;
  primaryCategoryId: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  priceLevel?: number;
  website?: string;
  phoneNumber?: string;
}

/** Self-register a listing: created PENDING and owned, awaiting approval. */
export async function registerLocation(input: RegisterLocationInput) {
  return prisma.location.create({
    data: {
      name: input.name,
      description: input.description,
      primaryCategoryId: input.primaryCategoryId,
      latitude: input.latitude,
      longitude: input.longitude,
      priceLevel: input.priceLevel,
      website: input.website,
      phoneNumber: input.phoneNumber,
      ownerUserId: input.ownerUserId,
      claimed: true,
      status: "PENDING",
    },
  });
}

/** Admin: publish a pending listing. */
export async function approveListing(args: { adminUserId: string; locationId: string }) {
  await assertAdmin(args.adminUserId);
  const loc = await prisma.location.update({
    where: { id: args.locationId },
    data: { status: "PUBLISHED" },
  });
  await logAction(args.adminUserId, "APPROVE_LISTING", "Location", loc.id);
  if (loc.ownerUserId) {
    await createNotification({
      userId: loc.ownerUserId,
      type: "LISTING_APPROVED",
      title: "Your listing was approved",
      body: loc.name,
    });
  }
  return loc;
}

/** Admin: reject a pending listing, recording the reason. */
export async function rejectListing(args: {
  adminUserId: string;
  locationId: string;
  reason?: string;
}) {
  await assertAdmin(args.adminUserId);
  const loc = await prisma.location.update({
    where: { id: args.locationId },
    data: { status: "REJECTED" },
  });
  await logAction(args.adminUserId, "REJECT_LISTING", "Location", loc.id, {
    reason: args.reason ?? null,
  });
  if (loc.ownerUserId) {
    await createNotification({
      userId: loc.ownerUserId,
      type: "LISTING_REJECTED",
      title: "Your listing was rejected",
      body: args.reason,
    });
  }
  return loc;
}

/** File an ownership claim on an unclaimed listing. */
export async function submitClaim(args: {
  userId: string;
  locationId: string;
  note?: string;
}) {
  const loc = await prisma.location.findUnique({
    where: { id: args.locationId },
    select: { claimed: true },
  });
  if (!loc) throw new Error("location not found");
  if (loc.claimed) throw new Error("location is already claimed");
  return prisma.locationClaim.create({
    data: { userId: args.userId, locationId: args.locationId, note: args.note },
  });
}

/** Admin: approve a claim, transferring ownership to the claimant. */
export async function approveClaim(args: { adminUserId: string; claimId: string }) {
  await assertAdmin(args.adminUserId);
  const claim = await prisma.locationClaim.findUnique({ where: { id: args.claimId } });
  if (!claim) throw new Error("claim not found");

  const [updatedClaim] = await prisma.$transaction([
    prisma.locationClaim.update({
      where: { id: claim.id },
      data: { status: "APPROVED", decidedBy: args.adminUserId, decidedAt: new Date() },
    }),
    prisma.location.update({
      where: { id: claim.locationId },
      data: { ownerUserId: claim.userId, claimed: true },
    }),
  ]);
  await logAction(args.adminUserId, "APPROVE_CLAIM", "LocationClaim", claim.id, {
    locationId: claim.locationId,
    userId: claim.userId,
  });
  await createNotification({
    userId: claim.userId,
    type: "CLAIM_APPROVED",
    title: "Your ownership claim was approved",
  });
  return updatedClaim;
}

/** Admin: reject a claim, leaving ownership unchanged. */
export async function rejectClaim(args: {
  adminUserId: string;
  claimId: string;
  reason?: string;
}) {
  await assertAdmin(args.adminUserId);
  const claim = await prisma.locationClaim.update({
    where: { id: args.claimId },
    data: { status: "REJECTED", decidedBy: args.adminUserId, decidedAt: new Date() },
  });
  await logAction(args.adminUserId, "REJECT_CLAIM", "LocationClaim", claim.id, {
    reason: args.reason ?? null,
  });
  await createNotification({
    userId: claim.userId,
    type: "CLAIM_REJECTED",
    title: "Your ownership claim was rejected",
    body: args.reason,
  });
  return claim;
}
