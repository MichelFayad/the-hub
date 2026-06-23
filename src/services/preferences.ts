import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// Onboarding questionnaire persistence (scope §4.1) + the launch rule-based
// recommender (scope §8, step 1): profile interests -> category match,
// budget-filtered, rating-ranked. Deterministic, no data dependency. The ML
// hybrid (content + collaborative) replaces this engine later; behavioral
// data is already logged via interaction-log from day one.

export interface QuestionnaireInput {
  userId: string;
  interestCategoryIds?: string[];
  budgetMax?: number | null;
  companions?: string[];
  travelScope?: string | null;
  dietary?: string[];
  accessibility?: string[];
  frequency?: string | null;
  preferredLocale?: string | null;
}

/** Create or update a user's questionnaire answers (editable any time). */
export async function saveQuestionnaire(input: QuestionnaireInput) {
  const data: Prisma.UserPreferenceUncheckedCreateInput = {
    userId: input.userId,
    interestCategoryIds: input.interestCategoryIds ?? [],
    budgetMax: input.budgetMax ?? null,
    companions: input.companions ?? [],
    travelScope: input.travelScope ?? null,
    dietary: input.dietary ?? [],
    accessibility: input.accessibility ?? [],
    frequency: input.frequency ?? null,
    preferredLocale: input.preferredLocale ?? null,
  };
  return prisma.userPreference.upsert({
    where: { userId: input.userId },
    create: data,
    update: data,
  });
}

/** A user's saved questionnaire answers, or null if never completed. */
export async function getPreferences(userId: string) {
  return prisma.userPreference.findUnique({ where: { userId } });
}

export interface Recommendation {
  id: string;
  name: string;
  primaryCategoryId: string;
  ratingAvg: number | null;
  priceLevel: number | null;
}

/**
 * Rule-based recommendations (scope §8 launch step). Match published
 * locations to the user's interest categories within budget, ranked by
 * rating. With no preferences (cold start) fall back to top-rated published
 * locations so a brand-new user still sees something useful.
 */
export async function recommendForUser(
  userId: string,
  limit = 20,
): Promise<Recommendation[]> {
  const prefs = await getPreferences(userId);
  const select = {
    id: true,
    name: true,
    primaryCategoryId: true,
    ratingAvg: true,
    priceLevel: true,
  } as const;

  const where: Prisma.LocationWhereInput = { status: "PUBLISHED" };
  if (prefs?.interestCategoryIds.length) {
    where.OR = [
      { primaryCategoryId: { in: prefs.interestCategoryIds } },
      { secondaryCategories: { some: { id: { in: prefs.interestCategoryIds } } } },
    ];
  }
  if (prefs?.budgetMax != null) {
    // Keep locations within budget; unpriced locations are still eligible.
    where.AND = [{ OR: [{ priceLevel: null }, { priceLevel: { lte: prefs.budgetMax } }] }];
  }

  return prisma.location.findMany({
    where,
    select,
    orderBy: [{ ratingAvg: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: Math.min(limit, 100),
  });
}
