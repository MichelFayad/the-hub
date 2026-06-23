-- Onboarding/profile questionnaire (scope §4.1). One preference row per
-- user, seeding the rule-based cold-start recommender (scope §8).
CREATE TABLE "UserPreference" (
    "userId" TEXT NOT NULL,
    "interestCategoryIds" TEXT[],
    "budgetMax" INTEGER,
    "companions" TEXT[],
    "travelScope" TEXT,
    "dietary" TEXT[],
    "accessibility" TEXT[],
    "frequency" TEXT,
    "preferredLocale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
