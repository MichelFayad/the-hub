// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { purchaseBoost, getActiveBoost, BoostError } from "@/services/boosts";

let owner: string;
let agency: string;
let catId: string;
let eligibleLoc: string;
let ineligibleLoc: string;
const locIds: string[] = [];

async function addReviews(locationId: string, count: number, rating: number) {
  for (let i = 0; i < count; i++) {
    const u = await prisma.user.create({
      data: { email: `boost-rev-${Date.now()}-${i}-${Math.random()}@e.com`, displayName: "R", role: "USER" },
    });
    await prisma.review.create({ data: { userId: u.id, locationId, rating, moderationStatus: "VISIBLE" } });
  }
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

describe("pay-per-boost", () => {
  beforeAll(async () => {
    const o = await prisma.user.create({
      data: { email: `boost-owner-${Date.now()}@e.com`, displayName: "Owner", role: "BUSINESS_OWNER" },
    });
    const a = await prisma.user.create({
      data: { email: `boost-agency-${Date.now()}@e.com`, displayName: "Agency", role: "AGENCY" },
    });
    owner = o.id;
    agency = a.id;
    const cat = await prisma.category.create({
      data: { slug: `boost-cat-${Date.now()}`, nameEn: "Boost Cat" },
    });
    catId = cat.id;
    const el = await prisma.location.create({
      data: { name: "Eligible Spot", primaryCategoryId: catId, status: "PUBLISHED", ownerUserId: owner },
    });
    eligibleLoc = el.id;
    locIds.push(el.id);
    await addReviews(eligibleLoc, 3, 5);

    const inel = await prisma.location.create({
      data: { name: "Ineligible Spot", primaryCategoryId: catId, status: "PUBLISHED", ownerUserId: owner },
    });
    ineligibleLoc = inel.id;
    locIds.push(inel.id);
    await addReviews(ineligibleLoc, 1, 5); // only 1 review, below the floor
  });

  afterAll(async () => {
    await prisma.boost.deleteMany({ where: { locationId: { in: locIds } } });
    await prisma.review.deleteMany({ where: { locationId: { in: locIds } } });
    await prisma.location.deleteMany({ where: { id: { in: locIds } } });
    await prisma.category.delete({ where: { id: catId } });
    await prisma.user.deleteMany({ where: { id: { in: [owner, agency] } } });
    await prisma.$disconnect();
  });

  it("purchases a boost at full price for an Individual Location owner", async () => {
    const boost = await purchaseBoost({
      userId: owner,
      locationId: eligibleLoc,
      placement: "SEARCH_BOOST",
      durationDays: 7,
    });
    expect(boost.priceCents).toBe(1000);
    expect(boost.endsAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("applies the flat agency discount", async () => {
    const loc = await prisma.location.create({
      data: { name: "Agency Spot", primaryCategoryId: catId, status: "PUBLISHED", ownerUserId: agency },
    });
    locIds.push(loc.id);
    await addReviews(loc.id, 3, 5);
    const boost = await purchaseBoost({
      userId: agency,
      locationId: loc.id,
      placement: "SEARCH_BOOST",
      durationDays: 7,
    });
    expect(boost.priceCents).toBe(800); // 1000 * 0.8
  });

  it("rejects a purchase below the rating/review-count eligibility floor", async () => {
    await expect(
      purchaseBoost({
        userId: owner,
        locationId: ineligibleLoc,
        placement: "SEARCH_BOOST",
        durationDays: 7,
      }),
    ).rejects.toThrow(BoostError);
  });

  it("rejects a purchase from a non-owner", async () => {
    const stranger = await prisma.user.create({
      data: { email: `boost-stranger-${Date.now()}@e.com`, displayName: "Stranger", role: "BUSINESS_OWNER" },
    });
    await expect(
      purchaseBoost({
        userId: stranger.id,
        locationId: eligibleLoc,
        placement: "SEARCH_BOOST",
        durationDays: 7,
      }),
    ).rejects.toThrow(BoostError);
    await prisma.user.delete({ where: { id: stranger.id } });
  });

  it("reports the active boost for a location", async () => {
    const active = await getActiveBoost(eligibleLoc);
    expect(active?.placement).toBe("SEARCH_BOOST");
  });

  it("reports no active boost for an unboosted location", async () => {
    const active = await getActiveBoost(ineligibleLoc);
    expect(active).toBeNull();
  });
});
