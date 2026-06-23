-- TOTP second factor (scope §12.1). Mandatory for ADMIN/SUPER_ADMIN.
ALTER TABLE "User" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
