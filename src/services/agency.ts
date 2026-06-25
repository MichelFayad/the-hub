import { prisma } from "@/lib/db";
import { ForbiddenError } from "@/lib/rbac";
import { purchaseBoost, getActiveBoost, DEFAULT_AGENCY_DISCOUNT, BoostError } from "@/services/boosts";
import type { BoostPlacement } from "@/generated/prisma/client";

// Agency console (scope §4.8): single login managing every Location the
// Agency owns. Volume-tiered discounts were considered but not adopted for
// V1 (see boosts.ts) — the console surfaces the flat rate actually in
// effect rather than a tier the platform doesn't implement.

async function assertAgency(agencyUserId: string) {
  const actor = await prisma.user.findUnique({
    where: { id: agencyUserId },
    select: { role: true, boostDiscountRate: true },
  });
  if (!actor) throw new Error("user not found");
  if (actor.role !== "AGENCY") {
    throw new ForbiddenError("the agency console is only available to AGENCY accounts");
  }
  return actor;
}

/** Per-location metrics + the location's currently active boost, if any. */
async function locationSummary(locationId: string) {
  const [favoriteCount, reviewCount, activeBoost] = await Promise.all([
    prisma.favorite.count({ where: { locationId } }),
    prisma.review.count({ where: { locationId, moderationStatus: "VISIBLE" } }),
    getActiveBoost(locationId),
  ]);
  return { favoriteCount, reviewCount, activeBoost };
}

/** Every Location this Agency owns, each with aggregated metrics + drill-down data. */
export async function listAgencyLocations(agencyUserId: string) {
  await assertAgency(agencyUserId);
  const locations = await prisma.location.findMany({
    where: { ownerUserId: agencyUserId },
    orderBy: { createdAt: "asc" },
  });
  return Promise.all(
    locations.map(async (location) => ({
      location,
      ...(await locationSummary(location.id)),
    })),
  );
}

/** Aggregated totals across every Location the Agency owns, plus its discount rate. */
export async function getAgencyDashboard(agencyUserId: string) {
  const actor = await assertAgency(agencyUserId);
  const locations = await listAgencyLocations(agencyUserId);

  const totalSpentCents = await prisma.boost.aggregate({
    where: { purchasedByUserId: agencyUserId },
    _sum: { priceCents: true },
  });

  return {
    discountRate: actor.boostDiscountRate ?? DEFAULT_AGENCY_DISCOUNT,
    locationCount: locations.length,
    totalFavorites: locations.reduce((sum, l) => sum + l.favoriteCount, 0),
    totalReviews: locations.reduce((sum, l) => sum + l.reviewCount, 0),
    activeBoostCount: locations.filter((l) => l.activeBoost !== null).length,
    totalBoostSpendCents: totalSpentCents._sum.priceCents ?? 0,
    locations,
  };
}

export interface BulkBoostInput {
  agencyUserId: string;
  locationIds: string[];
  placement: BoostPlacement;
  durationDays: 7 | 14 | 30;
}

export type BulkBoostResult =
  | { locationId: string; ok: true; boostId: string }
  | { locationId: string; ok: false; error: string };

/**
 * Apply the same boost campaign across several owned locations in one call.
 * Each location is purchased independently — one ineligible/unowned
 * location does not block the others (scope §4.8 "bulk actions where
 * sensible"); per-location failures are reported, not thrown.
 */
export async function bulkPurchaseBoost(input: BulkBoostInput): Promise<BulkBoostResult[]> {
  await assertAgency(input.agencyUserId);
  return Promise.all(
    input.locationIds.map(async (locationId): Promise<BulkBoostResult> => {
      try {
        const boost = await purchaseBoost({
          userId: input.agencyUserId,
          locationId,
          placement: input.placement,
          durationDays: input.durationDays,
        });
        return { locationId, ok: true, boostId: boost.id };
      } catch (err) {
        const message = err instanceof BoostError ? err.message : "unexpected error";
        return { locationId, ok: false, error: message };
      }
    }),
  );
}
