import { prisma } from "@/lib/db";
import { assertRole } from "@/lib/rbac";
import type { AppRole } from "@/lib/auth-helpers";
import type { Prisma, FlagReason } from "@/generated/prisma/client";

// Review moderation queue + heuristics (scope §13). User or system flags
// push a review into PENDING; an admin then KEEPs (back to VISIBLE) or
// REMOVEs it. Every decision writes an AdminActionLog row. The one COI
// heuristic here auto-flags an owner reviewing their own listing.

async function assertAdmin(adminUserId: string): Promise<void> {
  const actor = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { role: true },
  });
  if (!actor) throw new Error("admin user not found");
  assertRole(actor.role as AppRole, "ADMIN");
}

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

export interface FlagReviewInput {
  reporterId: string;
  reviewId: string;
  reason: FlagReason;
  note?: string;
}

/** Record a flag and move the review into the moderation queue. */
export async function flagReview(input: FlagReviewInput) {
  const flag = await prisma.reviewFlag.upsert({
    where: {
      reviewId_reporterId: {
        reviewId: input.reviewId,
        reporterId: input.reporterId,
      },
    },
    create: {
      reviewId: input.reviewId,
      reporterId: input.reporterId,
      reason: input.reason,
      note: input.note,
    },
    update: { reason: input.reason, note: input.note },
  });
  await prisma.review.update({
    where: { id: input.reviewId },
    data: { moderationStatus: "PENDING" },
  });
  return flag;
}

export interface QueueItem {
  id: string;
  locationId: string;
  rating: number;
  text: string | null;
  moderationStatus: "PENDING";
  flagCount: number;
  reasons: FlagReason[];
  authorId: string;
  createdAt: Date;
}

/** Pending reviews awaiting a decision, newest first (admin only). */
export async function getModerationQueue(args: {
  adminUserId: string;
}): Promise<QueueItem[]> {
  await assertAdmin(args.adminUserId);
  const reviews = await prisma.review.findMany({
    where: { moderationStatus: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: { flags: { select: { reason: true } } },
  });
  return reviews.map((r) => ({
    id: r.id,
    locationId: r.locationId,
    rating: r.rating,
    text: r.text,
    moderationStatus: "PENDING" as const,
    flagCount: r.flags.length,
    reasons: r.flags.map((f) => f.reason),
    authorId: r.userId,
    createdAt: r.createdAt,
  }));
}

/** Recompute a Location's denormalized rating from its VISIBLE reviews. */
async function recomputeLocationRating(locationId: string): Promise<void> {
  const agg = await prisma.review.aggregate({
    where: { locationId, moderationStatus: "VISIBLE" },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.location.update({
    where: { id: locationId },
    data: { ratingAvg: agg._avg.rating, ratingCount: agg._count },
  });
}

export interface ModerateReviewInput {
  adminUserId: string;
  reviewId: string;
  decision: "KEEP" | "REMOVE";
  reason?: string;
}

/** Resolve a queued review: KEEP -> VISIBLE, REMOVE -> REMOVED. */
export async function moderateReview(input: ModerateReviewInput) {
  await assertAdmin(input.adminUserId);
  const status = input.decision === "KEEP" ? "VISIBLE" : "REMOVED";
  const review = await prisma.review.update({
    where: { id: input.reviewId },
    data: { moderationStatus: status },
  });
  await recomputeLocationRating(review.locationId);
  await logAction(input.adminUserId, "MODERATE_REVIEW", "Review", review.id, {
    decision: input.decision,
    ...(input.reason ? { reason: input.reason } : {}),
  });
  return review;
}

/**
 * COI heuristic (scope §13): if the review author owns the reviewed
 * location, raise a system CONFLICT_OF_INTEREST flag and enqueue it.
 * Returns whether a conflict was found. Idempotent via the flag unique key.
 */
export async function enqueueConflictOfInterest(
  reviewId: string,
): Promise<boolean> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { userId: true, locationId: true },
  });
  if (!review) throw new Error("review not found");
  const location = await prisma.location.findUnique({
    where: { id: review.locationId },
    select: { ownerUserId: true },
  });
  if (!location || location.ownerUserId !== review.userId) return false;

  await flagReview({
    reporterId: review.userId,
    reviewId,
    reason: "CONFLICT_OF_INTEREST",
    note: "auto: review author owns this listing",
  });
  return true;
}
