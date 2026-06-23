-- Rename Role enum values to the new account naming (scope §5).
-- END_USER -> USER, INDIVIDUAL_LOCATION -> BUSINESS_OWNER. Postgres
-- RENAME VALUE updates existing rows and the column default in place.
ALTER TYPE "Role" RENAME VALUE 'END_USER' TO 'USER';
ALTER TYPE "Role" RENAME VALUE 'INDIVIDUAL_LOCATION' TO 'BUSINESS_OWNER';
