-- AlterTable
ALTER TABLE "Salon" ALTER COLUMN "timezone" SET DEFAULT 'Europe/Nicosia';

-- Update existing seeded value if present
UPDATE "Salon"
SET "timezone" = 'Europe/Nicosia'
WHERE "timezone" = 'Asia/Riyadh';
