// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { submitReview, getReviewsForLocation } from "@/services/reviews";

let verifiedUser: string;
let verifiedUser2: string;
let unverifiedUser: string;
let catId: string;
let locId: string;

describe("reviews service", () => {
  beforeAll(async () => {
    const v = await prisma.user.create({
      data: {
        email: `rev-v-${Date.now()}@example.com`,
        displayName: "Verified Vera",
        emailVerified: true,
      },
    });
    const v2 = await prisma.user.create({
      data: {
        email: `rev-v2-${Date.now()}@example.com`,
        displayName: "Phone Phil",
        phoneVerified: true,
      },
    });
    const u = await prisma.user.create({
      data: {
        email: `rev-u-${Date.now()}@example.com`,
        displayName: "Unverified Uma",
      },
    });
    verifiedUser = v.id;
    verifiedUser2 = v2.id;
    unverifiedUser = u.id;

    const cat = await prisma.category.create({
      data: { slug: `rev-cat-${Date.now()}`, nameEn: "Rev Cat" },
    });
    catId = cat.id;
    const loc = await prisma.location.create({
      data: { name: "Reviewed Place", primaryCategoryId: catId, status: "PUBLISHED" },
    });
    locId = loc.id;
  });

  afterAll(async () => {
    await prisma.review.deleteMany({ where: { locationId: locId } });
    await prisma.location.delete({ where: { id: locId } });
    await prisma.category.delete({ where: { id: catId } });
    await prisma.user.deleteMany({
      where: { id: { in: [verifiedUser, verifiedUser2, unverifiedUser] } },
    });
    await prisma.$disconnect();
  });

  it("lets a phone- or email-verified user post a review", async () => {
    const r = await submitReview({
      userId: verifiedUser,
      locationId: locId,
      rating: 4,
      text: "Solid",
    });
    expect(r.rating).toBe(4);
  });

  it("rejects reviews from unverified accounts", async () => {
    await expect(
      submitReview({ userId: unverifiedUser, locationId: locId, rating: 5 }),
    ).rejects.toThrow();
  });

  it("rejects out-of-range ratings", async () => {
    await expect(
      submitReview({ userId: verifiedUser2, locationId: locId, rating: 9 }),
    ).rejects.toThrow();
  });

  it("edits the single review on re-submit without duplicating", async () => {
    await submitReview({ userId: verifiedUser, locationId: locId, rating: 4 });
    await submitReview({ userId: verifiedUser, locationId: locId, rating: 2 });
    const count = await prisma.review.count({
      where: { userId: verifiedUser, locationId: locId },
    });
    expect(count).toBe(1);
    const r = await prisma.review.findFirst({
      where: { userId: verifiedUser, locationId: locId },
    });
    expect(r?.rating).toBe(2);
  });

  it("recomputes the location's denormalized rating average and count", async () => {
    await submitReview({ userId: verifiedUser, locationId: locId, rating: 2 });
    await submitReview({ userId: verifiedUser2, locationId: locId, rating: 4 });
    const loc = await prisma.location.findUnique({ where: { id: locId } });
    expect(loc?.ratingCount).toBe(2);
    expect(loc?.ratingAvg).toBe(3);
  });

  it("returns visible reviews with public author info, never contact details", async () => {
    const reviews = await getReviewsForLocation(locId);
    expect(reviews.length).toBeGreaterThan(0);
    const sample = reviews[0];
    expect(sample.author.displayName).toBeTruthy();
    expect(sample.author).not.toHaveProperty("email");
    expect(sample.author).not.toHaveProperty("phoneNumber");
  });
});
