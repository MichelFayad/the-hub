// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { submitReview } from "@/services/reviews";
import {
  voteOnReview,
  recomputeReviewerScore,
} from "@/services/review-votes";

let author: string;
let voter1: string;
let voter2: string;
let catId: string;
let locId: string;
let reviewId: string;

describe("review votes and reviewer score", () => {
  beforeAll(async () => {
    const a = await prisma.user.create({
      data: { email: `rv-a-${Date.now()}@e.com`, displayName: "Author", emailVerified: true },
    });
    const v1 = await prisma.user.create({
      data: { email: `rv-v1-${Date.now()}@e.com`, displayName: "Voter1" },
    });
    const v2 = await prisma.user.create({
      data: { email: `rv-v2-${Date.now()}@e.com`, displayName: "Voter2" },
    });
    author = a.id;
    voter1 = v1.id;
    voter2 = v2.id;

    const cat = await prisma.category.create({
      data: { slug: `rv-cat-${Date.now()}`, nameEn: "RV Cat" },
    });
    catId = cat.id;
    const loc = await prisma.location.create({
      data: { name: "Voted Place", primaryCategoryId: catId, status: "PUBLISHED" },
    });
    locId = loc.id;
    const r = await submitReview({ userId: author, locationId: locId, rating: 5 });
    reviewId = r.id;
  });

  afterAll(async () => {
    await prisma.review.deleteMany({ where: { locationId: locId } });
    await prisma.location.delete({ where: { id: locId } });
    await prisma.category.delete({ where: { id: catId } });
    await prisma.user.deleteMany({ where: { id: { in: [author, voter1, voter2] } } });
    await prisma.$disconnect();
  });

  it("records a like and updates denormalized counts", async () => {
    await voteOnReview({ userId: voter1, reviewId, value: 1 });
    const r = await prisma.review.findUnique({ where: { id: reviewId } });
    expect(r?.likesCount).toBe(1);
    expect(r?.dislikesCount).toBe(0);
  });

  it("changes a vote in place without duplicating", async () => {
    await voteOnReview({ userId: voter1, reviewId, value: -1 });
    const votes = await prisma.reviewVote.count({ where: { userId: voter1, reviewId } });
    expect(votes).toBe(1);
    const r = await prisma.review.findUnique({ where: { id: reviewId } });
    expect(r?.likesCount).toBe(0);
    expect(r?.dislikesCount).toBe(1);
  });

  it("rejects self-votes", async () => {
    await expect(
      voteOnReview({ userId: author, reviewId, value: 1 }),
    ).rejects.toThrow();
  });

  it("raises the author's reviewer score with net positive votes", async () => {
    await voteOnReview({ userId: voter1, reviewId, value: 1 });
    await voteOnReview({ userId: voter2, reviewId, value: 1 });
    const a = await prisma.user.findUnique({ where: { id: author } });
    // 2 * 1 visible review + 2 net votes = 4
    expect(a?.reviewerScore).toBe(4);
  });

  it("penalizes removed reviews and never goes negative", async () => {
    await prisma.review.update({
      where: { id: reviewId },
      data: { moderationStatus: "REMOVED" },
    });
    await recomputeReviewerScore(author);
    const a = await prisma.user.findUnique({ where: { id: author } });
    // 0 visible + 2 votes - 5 removed = -3 -> clamped to 0
    expect(a?.reviewerScore).toBe(0);
  });
});
