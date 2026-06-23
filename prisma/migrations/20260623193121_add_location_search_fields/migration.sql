-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "priceLevel" INTEGER,
ADD COLUMN     "ratingAvg" DOUBLE PRECISION,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0;
