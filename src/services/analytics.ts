import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/admin-log";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";

// Platform analytics dashboard (scope §4.7, §14). Conversion/funnel metrics
// (search→view, view→favorite, DAU/MAU/retention) come from the
// InteractionEvent log, since they have no other source — these are window
// totals, not session-correlated (events carry no session id), so they're
// directional rather than a precise per-session funnel. Metrics with an
// authoritative source elsewhere (listing claim rate, questionnaire
// completion, boost conversion) are computed directly from their own
// tables instead of duplicating them into events.

const DAY_MS = 24 * 60 * 60 * 1000;

function eventCount(type: string, since: Date) {
  return prisma.interactionEvent.count({ where: { type, createdAt: { gte: since } } });
}

export async function distinctUserCount(type: string, since: Date): Promise<number> {
  const rows = await prisma.interactionEvent.findMany({
    where: { type, createdAt: { gte: since }, userId: { not: null } },
    distinct: ["userId"],
    select: { userId: true },
  });
  return rows.length;
}

export async function signupToQuestionnaireRate(): Promise<number> {
  const [users, completed] = await Promise.all([
    prisma.user.count(),
    prisma.userPreference.count(),
  ]);
  return users === 0 ? 0 : completed / users;
}

export async function listingClaimRate(): Promise<number> {
  const [total, claimed] = await Promise.all([
    prisma.location.count(),
    prisma.location.count({ where: { claimed: true } }),
  ]);
  return total === 0 ? 0 : claimed / total;
}

export async function reviewSubmissionRatePerActiveUser(since: Date): Promise<number> {
  const [reviews, activeUsers] = await Promise.all([
    prisma.review.count({ where: { createdAt: { gte: since } } }),
    distinctUserCount(ANALYTICS_EVENTS.LOGIN, since),
  ]);
  return activeUsers === 0 ? 0 : reviews / activeUsers;
}

export async function searchToViewConversion(since: Date): Promise<number> {
  const [searches, views] = await Promise.all([
    eventCount(ANALYTICS_EVENTS.SEARCH_PERFORMED, since),
    eventCount(ANALYTICS_EVENTS.LOCATION_VIEWED, since),
  ]);
  return searches === 0 ? 0 : views / searches;
}

export async function viewToFavoriteConversion(since: Date): Promise<number> {
  const [views, favorites] = await Promise.all([
    eventCount(ANALYTICS_EVENTS.LOCATION_VIEWED, since),
    eventCount(ANALYTICS_EVENTS.FAVORITE_ADDED, since),
  ]);
  return views === 0 ? 0 : favorites / views;
}

interface BoostSegmentStats {
  buyerCount: number;
  /** Buyers as a fraction of all users with this role. */
  conversionRate: number;
  /** Buyers who purchased more than once, as a fraction of all buyers. */
  repeatPurchaseRate: number;
}

/** Boost conversion/repeat-purchase, segmented Individual Location vs. Agency (scope §7, §14). */
export async function boostStatsForRole(role: "BUSINESS_OWNER" | "AGENCY"): Promise<BoostSegmentStats> {
  const roleUsers = await prisma.user.findMany({ where: { role }, select: { id: true } });
  const roleUserIds = roleUsers.map((u) => u.id);
  if (roleUserIds.length === 0) {
    return { buyerCount: 0, conversionRate: 0, repeatPurchaseRate: 0 };
  }

  const grouped = await prisma.boost.groupBy({
    by: ["purchasedByUserId"],
    where: { purchasedByUserId: { in: roleUserIds } },
    _count: { _all: true },
  });
  const buyerCount = grouped.length;
  const repeatBuyers = grouped.filter((g) => g._count._all > 1).length;
  return {
    buyerCount,
    conversionRate: buyerCount / roleUserIds.length,
    repeatPurchaseRate: buyerCount === 0 ? 0 : repeatBuyers / buyerCount,
  };
}

/**
 * Classic 30-day cohort retention: of users whose first-ever LOGIN fell
 * 30-60 days before `now`, what fraction logged in again in the most
 * recent 30 days.
 */
export async function retention30Day(now: Date): Promise<number> {
  const cohortStart = new Date(now.getTime() - 60 * DAY_MS);
  const cohortEnd = new Date(now.getTime() - 30 * DAY_MS);

  const firstLogins = await prisma.interactionEvent.groupBy({
    by: ["userId"],
    where: { type: ANALYTICS_EVENTS.LOGIN, userId: { not: null } },
    _min: { createdAt: true },
  });
  const cohortUserIds = firstLogins
    .filter((f) => {
      const first = f._min.createdAt;
      return first !== null && first >= cohortStart && first < cohortEnd;
    })
    .map((f) => f.userId as string);
  if (cohortUserIds.length === 0) return 0;

  const retained = await prisma.interactionEvent.findMany({
    where: {
      type: ANALYTICS_EVENTS.LOGIN,
      userId: { in: cohortUserIds },
      createdAt: { gte: cohortEnd },
    },
    distinct: ["userId"],
    select: { userId: true },
  });
  return retained.length / cohortUserIds.length;
}

/** Admin-only platform analytics dashboard (scope §4.7, §11, §14). */
export async function getAnalyticsDashboard(adminUserId: string, now: Date = new Date()) {
  await assertAdmin(adminUserId);

  const since1d = new Date(now.getTime() - DAY_MS);
  const since30d = new Date(now.getTime() - 30 * DAY_MS);

  const [
    signupQuestionnaire,
    claimRate,
    reviewRate,
    searchToView,
    viewToFavorite,
    dau,
    mau,
    retention,
    individual,
    agency,
  ] = await Promise.all([
    signupToQuestionnaireRate(),
    listingClaimRate(),
    reviewSubmissionRatePerActiveUser(since30d),
    searchToViewConversion(since30d),
    viewToFavoriteConversion(since30d),
    distinctUserCount(ANALYTICS_EVENTS.LOGIN, since1d),
    distinctUserCount(ANALYTICS_EVENTS.LOGIN, since30d),
    retention30Day(now),
    boostStatsForRole("BUSINESS_OWNER"),
    boostStatsForRole("AGENCY"),
  ]);

  return {
    signupToQuestionnaireRate: signupQuestionnaire,
    listingClaimRate: claimRate,
    reviewSubmissionRatePerActiveUser: reviewRate,
    searchToViewConversion: searchToView,
    viewToFavoriteConversion: viewToFavorite,
    dau,
    mau,
    retention30Day: retention,
    boosts: { individual, agency },
  };
}
