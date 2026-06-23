import { prisma } from "@/lib/db";

// Likes/dislikes on reviews and the reviewer-score roll-up (scope §4.4).
// One vote per user per review, changeable; self-votes are rejected.
// Votes and moderation feed the author's public reviewer score.

export interface VoteInput {
  userId: string;
  reviewId: string;
  value: 1 | -1;
}

/** Recompute and persist a review's denormalized like/dislike counts. */
async function recomputeReviewCounts(reviewId: string): Promise<void> {
  const [likes, dislikes] = await Promise.all([
    prisma.reviewVote.count({ where: { reviewId, value: 1 } }),
    prisma.reviewVote.count({ where: { reviewId, value: -1 } }),
  ]);
  await prisma.review.update({
    where: { id: reviewId },
    data: { likesCount: likes, dislikesCount: dislikes },
  });
}

/**
 * Recompute a user's reviewer score (scope §4.4): rewards review volume and
 * net votes received, penalizes moderated-away reviews. Never negative.
 */
export async function recomputeReviewerScore(userId: string): Promise<void> {
  const [visible, removed, votes] = await Promise.all([
    prisma.review.count({ where: { userId, moderationStatus: "VISIBLE" } }),
    prisma.review.count({ where: { userId, moderationStatus: "REMOVED" } }),
    prisma.reviewVote.aggregate({
      where: { review: { userId } },
      _sum: { value: true },
    }),
  ]);
  const netVotes = votes._sum.value ?? 0;
  const score = Math.max(0, 2 * visible + netVotes - 5 * removed);
  await prisma.user.update({ where: { id: userId }, data: { reviewerScore: score } });
}

/** Cast or change a like/dislike on a review. Rejects voting on own review. */
export async function voteOnReview(input: VoteInput) {
  if (input.value !== 1 && input.value !== -1) {
    throw new Error("vote value must be 1 or -1");
  }
  const review = await prisma.review.findUnique({
    where: { id: input.reviewId },
    select: { userId: true },
  });
  if (!review) throw new Error("review not found");
  if (review.userId === input.userId) {
    throw new Error("cannot vote on your own review");
  }

  const vote = await prisma.reviewVote.upsert({
    where: {
      userId_reviewId: { userId: input.userId, reviewId: input.reviewId },
    },
    create: { userId: input.userId, reviewId: input.reviewId, value: input.value },
    update: { value: input.value },
  });

  await recomputeReviewCounts(input.reviewId);
  await recomputeReviewerScore(review.userId);
  return vote;
}
