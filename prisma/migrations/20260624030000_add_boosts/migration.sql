-- Pay-per-boost (scope §7).
ALTER TABLE "User" ADD COLUMN "boostDiscountRate" DOUBLE PRECISION;

CREATE TYPE "BoostPlacement" AS ENUM ('SEARCH_BOOST', 'CATEGORY_TOP', 'HOMEPAGE');

CREATE TABLE "Boost" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "purchasedByUserId" TEXT NOT NULL,
    "placement" "BoostPlacement" NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Boost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Boost_locationId_idx" ON "Boost"("locationId");
CREATE INDEX "Boost_endsAt_idx" ON "Boost"("endsAt");

ALTER TABLE "Boost" ADD CONSTRAINT "Boost_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Boost" ADD CONSTRAINT "Boost_purchasedByUserId_fkey" FOREIGN KEY ("purchasedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
