-- Review flagging + moderation queue (scope §13). A flag drives a review
-- into PENDING; the auto-COI heuristic raises system flags too.
CREATE TYPE "FlagReason" AS ENUM ('SPAM', 'OFFENSIVE', 'FAKE', 'CONFLICT_OF_INTEREST', 'OTHER');

CREATE TABLE "ReviewFlag" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "FlagReason" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReviewFlag_reviewId_reporterId_key" ON "ReviewFlag"("reviewId", "reporterId");
CREATE INDEX "ReviewFlag_reviewId_idx" ON "ReviewFlag"("reviewId");

ALTER TABLE "ReviewFlag" ADD CONSTRAINT "ReviewFlag_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewFlag" ADD CONSTRAINT "ReviewFlag_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
