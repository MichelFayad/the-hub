-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ListingStatus" ADD VALUE 'SUSPENDED';
ALTER TYPE "ListingStatus" ADD VALUE 'ARCHIVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'LISTING_SUSPENDED';
ALTER TYPE "NotificationType" ADD VALUE 'LISTING_REINSTATED';
ALTER TYPE "NotificationType" ADD VALUE 'LISTING_ARCHIVED';
ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_SUSPENDED';
ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_REINSTATED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "suspendedAt" TIMESTAMP(3);
