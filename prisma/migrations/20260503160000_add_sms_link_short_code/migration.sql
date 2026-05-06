-- AlterTable
ALTER TABLE "SmsLinkToken" ADD COLUMN "shortCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SmsLinkToken_shortCode_key" ON "SmsLinkToken"("shortCode");
