import { prisma } from "@/lib/db";

// Reviews & ratings (scope §4.4). One review per user per location,
// editable but not duplicable. Posting requires a verified account
// (phone and/or email) — the main lever against fake reviews. Author
// contact details are never exposed; only public display info is.
//
// Votes and reviewer-score roll-up are a separate slice; this slice
// covers posting/editing, the verification gate, and keeping the
// Location's denormalized rating (used by search) in sync.

export interface SubmitReviewInput {
  userId: string;
  locationId: string;
  rating: number;
  text?: string;
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

/** Create or edit the caller's single review for a location. */
export async function submitReview(input: SubmitReviewInput) {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error("rating must be an integer from 1 to 5");
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { phoneVerified: true, emailVerified: true },
  });
  if (!user) throw new Error("user not found");
  if (!user.phoneVerified && !user.emailVerified) {
    throw new Error("a verified phone or email is required to post a review");
  }

  const review = await prisma.review.upsert({
    where: {
      userId_locationId: {
        userId: input.userId,
        locationId: input.locationId,
      },
    },
    create: {
      userId: input.userId,
      locationId: input.locationId,
      rating: input.rating,
      text: input.text,
    },
    update: { rating: input.rating, text: input.text },
  });

  await recomputeLocationRating(input.locationId);
  return review;
}

export interface PublicReview {
  id: string;
  rating: number;
  text: string | null;
  likesCount: number;
  dislikesCount: number;
  createdAt: Date;
  author: { id: string; displayName: string; reviewerScore: number };
}

/** Visible reviews for a location with public author info only (§4.4). */
export async function getReviewsForLocation(
  locationId: string,
): Promise<PublicReview[]> {
  const reviews = await prisma.review.findMany({
    where: { locationId, moderationStatus: "VISIBLE" },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, displayName: true, reviewerScore: true } },
    },
  });

  return reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    text: r.text,
    likesCount: r.likesCount,
    dislikesCount: r.dislikesCount,
    createdAt: r.createdAt,
    author: {
      id: r.user.id,
      displayName: r.user.displayName,
      reviewerScore: r.user.reviewerScore,
    },
  }));
}
