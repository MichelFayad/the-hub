import { prisma } from "@/lib/db";
import type { BoostPlacement } from "@/generated/prisma/client";
import { manualPaymentProvider, type PaymentProvider } from "@/lib/payments";

// Pay-per-boost purchase (scope §7). Pricing is the illustrative table from
// the scope doc, in USD cents; the flat 20% agency discount is the chosen
// V1 model (volume-tiered is a documented future option — see
// User.boostDiscountRate). No refunds: there is no cancel/refund path.

export class BoostError extends Error {}

const ELIGIBILITY_MIN_RATING = 3.0;
const ELIGIBILITY_MIN_REVIEWS = 3;
export const DEFAULT_AGENCY_DISCOUNT = 0.2;

type Duration = 7 | 14 | 30;

const PRICING_CENTS: Record<BoostPlacement, Record<Duration, number>> = {
  SEARCH_BOOST: { 7: 1000, 14: 1800, 30: 3000 },
  CATEGORY_TOP: { 7: 2000, 14: 3500, 30: 6000 },
  HOMEPAGE: { 7: 4000, 14: 7000, 30: 12000 },
};

function computePrice(
  placement: BoostPlacement,
  durationDays: Duration,
  discountRate: number,
): number {
  const base = PRICING_CENTS[placement][durationDays];
  return Math.round(base * (1 - discountRate));
}

export interface PurchaseBoostInput {
  userId: string;
  locationId: string;
  placement: BoostPlacement;
  durationDays: Duration;
}

/** Purchase a boost: ownership + eligibility checked, charged, then recorded. */
export async function purchaseBoost(
  input: PurchaseBoostInput,
  provider: PaymentProvider = manualPaymentProvider,
) {
  const [location, actor] = await Promise.all([
    prisma.location.findUnique({ where: { id: input.locationId } }),
    prisma.user.findUnique({ where: { id: input.userId } }),
  ]);
  if (!location) throw new BoostError("location not found");
  if (!actor) throw new BoostError("user not found");
  if (location.ownerUserId !== input.userId) {
    throw new BoostError("only the listing's owner can purchase a boost");
  }
  if (
    (location.ratingAvg ?? 0) < ELIGIBILITY_MIN_RATING ||
    location.ratingCount < ELIGIBILITY_MIN_REVIEWS
  ) {
    throw new BoostError(
      `location does not meet the boost eligibility floor (>= ${ELIGIBILITY_MIN_RATING} rating, >= ${ELIGIBILITY_MIN_REVIEWS} reviews)`,
    );
  }

  const discountRate =
    actor.role === "AGENCY" ? actor.boostDiscountRate ?? DEFAULT_AGENCY_DISCOUNT : 0;
  const priceCents = computePrice(input.placement, input.durationDays, discountRate);

  const charge = await provider.charge({
    amountCents: priceCents,
    currency: "USD",
    description: `Boost: ${input.placement} / ${input.durationDays}d / ${location.name}`,
  });
  if (!charge.success) throw new BoostError("payment failed");

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + input.durationDays * 24 * 60 * 60 * 1000);

  return prisma.boost.create({
    data: {
      locationId: input.locationId,
      purchasedByUserId: input.userId,
      placement: input.placement,
      durationDays: input.durationDays,
      priceCents,
      startsAt,
      endsAt,
    },
  });
}

/** The currently-active boost for a location, if any (highest tier first). */
export async function getActiveBoost(locationId: string) {
  return prisma.boost.findFirst({
    where: { locationId, endsAt: { gt: new Date() } },
    orderBy: { endsAt: "desc" },
  });
}
