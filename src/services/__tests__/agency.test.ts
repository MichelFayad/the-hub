// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { listAgencyLocations, getAgencyDashboard, bulkPurchaseBoost } from "@/services/agency";
import { ForbiddenError } from "@/lib/rbac";

let agency: string;
let plainUser: string;
let catId: string;
const locIds: string[] = [];

async function makeEligibleLocation(ownerUserId: string, name: string) {
  const loc = await prisma.location.create({
    data: { name, primaryCategoryId: catId, status: "PUBLISHED", ownerUserId },
  });
  locIds.push(loc.id);
  for (let i = 0; i < 3; i++) {
    const u = await prisma.user.create({
      data: { email: `ag-rev-${Date.now()}-${i}-${Math.random()}@e.com`, displayName: "R", role: "USER" },
    });
    await prisma.review.create({ data: { userId: u.id, locationId: loc.id, rating: 5, moderationStatus: "VISIBLE" } });
  }
  await prisma.location.update({ where: { id: loc.id }, data: { ratingAvg: 5, ratingCount: 3 } });
  return loc.id;
}

describe("agency console", () => {
  beforeAll(async () => {
    const a = await prisma.user.create({
      data: { email: `ag-${Date.now()}@e.com`, displayName: "Agency", role: "AGENCY" },
    });
    const u = await prisma.user.create({
      data: { email: `ag-plain-${Date.now()}@e.com`, displayName: "Plain", role: "BUSINESS_OWNER" },
    });
    agency = a.id;
    plainUser = u.id;
    const cat = await prisma.category.create({
      data: { slug: `ag-cat-${Date.now()}`, nameEn: "Agency Cat" },
    });
    catId = cat.id;
  });

  afterAll(async () => {
    await prisma.boost.deleteMany({ where: { locationId: { in: locIds } } });
    await prisma.review.deleteMany({ where: { locationId: { in: locIds } } });
    await prisma.favorite.deleteMany({ where: { locationId: { in: locIds } } });
    await prisma.location.deleteMany({ where: { id: { in: locIds } } });
    await prisma.category.delete({ where: { id: catId } });
    await prisma.user.deleteMany({ where: { id: { in: [agency, plainUser] } } });
    await prisma.$disconnect();
  });

  it("rejects non-AGENCY accounts from the agency console", async () => {
    await expect(listAgencyLocations(plainUser)).rejects.toThrow(ForbiddenError);
  });

  it("lists every location the agency owns with per-location metrics", async () => {
    const locA = await makeEligibleLocation(agency, "Agency Spot A");
    const locB = await makeEligibleLocation(agency, "Agency Spot B");
    const rows = await listAgencyLocations(agency);
    const ids = rows.map((r) => r.location.id);
    expect(ids).toEqual(expect.arrayContaining([locA, locB]));
    expect(rows[0]).toHaveProperty("favoriteCount");
    expect(rows[0]).toHaveProperty("reviewCount", 3);
    expect(rows[0]).toHaveProperty("activeBoost");
  });

  it("reports aggregated totals and the agency's discount rate", async () => {
    const dashboard = await getAgencyDashboard(agency);
    expect(dashboard.discountRate).toBeCloseTo(0.2);
    expect(dashboard.locationCount).toBe(2);
    expect(dashboard.totalReviews).toBe(6);
  });

  it("applies a boost campaign across several owned locations, reporting per-location results", async () => {
    const rows = await listAgencyLocations(agency);
    const ids = rows.map((r) => r.location.id);
    const results = await bulkPurchaseBoost({
      agencyUserId: agency,
      locationIds: ids,
      placement: "SEARCH_BOOST",
      durationDays: 7,
    });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.ok)).toBe(true);

    const dashboard = await getAgencyDashboard(agency);
    expect(dashboard.activeBoostCount).toBe(2);
    expect(dashboard.totalBoostSpendCents).toBe(1600); // 2 * (1000 * 0.8)
  });

  it("reports a per-location failure without blocking the others", async () => {
    const ineligible = await prisma.location.create({
      data: { name: "Too New", primaryCategoryId: catId, status: "PUBLISHED", ownerUserId: agency },
    });
    locIds.push(ineligible.id);
    const eligible = await makeEligibleLocation(agency, "Agency Spot C");

    const results = await bulkPurchaseBoost({
      agencyUserId: agency,
      locationIds: [ineligible.id, eligible],
      placement: "SEARCH_BOOST",
      durationDays: 7,
    });
    const failed = results.find((r) => r.locationId === ineligible.id);
    const ok = results.find((r) => r.locationId === eligible);
    expect(failed?.ok).toBe(false);
    expect(ok?.ok).toBe(true);
  });
});
