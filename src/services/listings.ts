import { prisma } from "@/lib/db";
import { assertAdmin, logAdminAction as logAction } from "@/lib/admin-log";
import { createNotification } from "@/services/notifications";

// Listing lifecycle (scope §5). Business users self-register a listing or
// claim an existing one; both land in a PENDING state. An admin approves or
// rejects. Every privileged decision is written to the AdminActionLog audit
// trail. RBAC is enforced server-side here, never in the UI alone.

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

/** Admin: suspend a published listing — reversible via reinstateLocation. */
export async function suspendLocation(args: {
  adminUserId: string;
  locationId: string;
  reason?: string;
}) {
  await assertAdmin(args.adminUserId);
  const loc = await prisma.location.findUnique({ where: { id: args.locationId } });
  if (!loc) throw new Error("location not found");
  if (loc.status !== "PUBLISHED") {
    throw new Error("only published listings can be suspended");
  }
  const updated = await prisma.location.update({
    where: { id: args.locationId },
    data: { status: "SUSPENDED" },
  });
  await logAction(args.adminUserId, "SUSPEND_LISTING", "Location", updated.id, {
    reason: args.reason ?? null,
  });
  if (updated.ownerUserId) {
    await createNotification({
      userId: updated.ownerUserId,
      type: "LISTING_SUSPENDED",
      title: "Your listing was suspended",
      body: args.reason,
    });
  }
  return updated;
}

/** Admin: reinstate a suspended listing back to PUBLISHED. */
export async function reinstateLocation(args: { adminUserId: string; locationId: string }) {
  await assertAdmin(args.adminUserId);
  const loc = await prisma.location.findUnique({ where: { id: args.locationId } });
  if (!loc) throw new Error("location not found");
  if (loc.status !== "SUSPENDED") {
    throw new Error("only suspended listings can be reinstated");
  }
  const updated = await prisma.location.update({
    where: { id: args.locationId },
    data: { status: "PUBLISHED" },
  });
  await logAction(args.adminUserId, "REINSTATE_LISTING", "Location", updated.id);
  if (updated.ownerUserId) {
    await createNotification({
      userId: updated.ownerUserId,
      type: "LISTING_REINSTATED",
      title: "Your listing was reinstated",
    });
  }
  return updated;
}

/** Admin: archive a listing — terminal, no path back via approval flow. */
export async function archiveLocation(args: {
  adminUserId: string;
  locationId: string;
  reason?: string;
}) {
  await assertAdmin(args.adminUserId);
  const loc = await prisma.location.findUnique({ where: { id: args.locationId } });
  if (!loc) throw new Error("location not found");
  if (loc.status === "ARCHIVED") throw new Error("listing is already archived");
  const updated = await prisma.location.update({
    where: { id: args.locationId },
    data: { status: "ARCHIVED" },
  });
  await logAction(args.adminUserId, "ARCHIVE_LISTING", "Location", updated.id, {
    reason: args.reason ?? null,
  });
  if (updated.ownerUserId) {
    await createNotification({
      userId: updated.ownerUserId,
      type: "LISTING_ARCHIVED",
      title: "Your listing was archived",
      body: args.reason,
    });
  }
  return updated;
}
