// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  flagReview,
  getModerationQueue,
  moderateReview,
  enqueueConflictOfInterest,
} from "@/services/moderation";
import { ForbiddenError } from "@/lib/rbac";

let admin: string;
let owner: string;
let reporter: string;
let catId: string;
let locId: string;
const reviewIds: string[] = [];
const extraUserIds: string[] = [];

/** Create a review by a fresh author (one review per user per location). */
async function makeReview(rating = 4, userId?: string) {
  let author = userId;
  if (!author) {
    const u = await prisma.user.create({
      data: { email: `mod-a-${Date.now()}-${Math.random()}@e.com`, displayName: "A", role: "USER" },
    });
    extraUserIds.push(u.id);
    author = u.id;
  }
  const r = await prisma.review.create({
    data: { userId: author, locationId: locId, rating, text: "x" },
  });
  reviewIds.push(r.id);
  return r;
}

describe("moderation queue", () => {
  beforeAll(async () => {
    const a = await prisma.user.create({
      data: { email: `mod-admin-${Date.now()}@e.com`, displayName: "Admin", role: "ADMIN" },
    });
    const o = await prisma.user.create({
      data: { email: `mod-owner-${Date.now()}@e.com`, displayName: "Owner", role: "BUSINESS_OWNER" },
    });
    const rp = await prisma.user.create({
      data: { email: `mod-rep-${Date.now()}@e.com`, displayName: "Reporter", role: "USER" },
    });
    admin = a.id;
    owner = o.id;
    reporter = rp.id;
    const cat = await prisma.category.create({
      data: { slug: `mod-cat-${Date.now()}`, nameEn: "Mod Cat" },
    });
    catId = cat.id;
    const loc = await prisma.location.create({
      data: { name: "Mod Spot", primaryCategoryId: catId, status: "PUBLISHED", ownerUserId: owner, claimed: true },
    });
    locId = loc.id;
  });

  afterAll(async () => {
    await prisma.reviewFlag.deleteMany({ where: { reviewId: { in: reviewIds } } });
    await prisma.review.deleteMany({ where: { id: { in: reviewIds } } });
    await prisma.adminActionLog.deleteMany({ where: { adminUserId: admin } });
    await prisma.location.delete({ where: { id: locId } });
    await prisma.category.delete({ where: { id: catId } });
    await prisma.user.deleteMany({ where: { id: { in: [admin, owner, reporter, ...extraUserIds] } } });
    await prisma.$disconnect();
  });

  it("flagging a visible review moves it to PENDING", async () => {
    const r = await makeReview();
    const flag = await flagReview({ reporterId: reporter, reviewId: r.id, reason: "SPAM" });
    expect(flag.reviewId).toBe(r.id);
    const after = await prisma.review.findUnique({ where: { id: r.id } });
    expect(after?.moderationStatus).toBe("PENDING");
  });

  it("lists pending reviews for an admin with flag counts", async () => {
    const queue = await getModerationQueue({ adminUserId: admin });
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.every((q) => q.moderationStatus === "PENDING")).toBe(true);
    expect(queue[0].flagCount).toBeGreaterThanOrEqual(1);
  });

  it("denies the queue to a non-admin actor", async () => {
    await expect(getModerationQueue({ adminUserId: reporter })).rejects.toThrow(ForbiddenError);
  });

  it("KEEP restores a review to VISIBLE and logs it", async () => {
    const r = await makeReview();
    await flagReview({ reporterId: reporter, reviewId: r.id, reason: "OTHER" });
    const res = await moderateReview({ adminUserId: admin, reviewId: r.id, decision: "KEEP" });
    expect(res.moderationStatus).toBe("VISIBLE");
    const log = await prisma.adminActionLog.findFirst({
      where: { adminUserId: admin, action: "MODERATE_REVIEW", targetId: r.id },
    });
    expect(log?.metadata).toMatchObject({ decision: "KEEP" });
  });

  it("REMOVE hides a review and recomputes the location rating", async () => {
    const r = await makeReview(1);
    await flagReview({ reporterId: reporter, reviewId: r.id, reason: "FAKE" });
    const res = await moderateReview({ adminUserId: admin, reviewId: r.id, decision: "REMOVE", reason: "fake" });
    expect(res.moderationStatus).toBe("REMOVED");
    const visible = await prisma.review.count({
      where: { id: r.id, moderationStatus: "VISIBLE" },
    });
    expect(visible).toBe(0);
  });

  it("denies moderation to a non-admin actor", async () => {
    const r = await makeReview();
    await expect(
      moderateReview({ adminUserId: reporter, reviewId: r.id, decision: "REMOVE" }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("auto-flags a conflict of interest when an owner reviews their own listing", async () => {
    const r = await makeReview(4, owner);
    const flagged = await enqueueConflictOfInterest(r.id);
    expect(flagged).toBe(true);
    const after = await prisma.review.findUnique({ where: { id: r.id } });
    expect(after?.moderationStatus).toBe("PENDING");
    const flag = await prisma.reviewFlag.findFirst({
      where: { reviewId: r.id, reason: "CONFLICT_OF_INTEREST" },
    });
    expect(flag).not.toBeNull();
  });

  it("does not flag a normal reviewer who is not the owner", async () => {
    const r = await makeReview();
    const flagged = await enqueueConflictOfInterest(r.id);
    expect(flagged).toBe(false);
  });
});
