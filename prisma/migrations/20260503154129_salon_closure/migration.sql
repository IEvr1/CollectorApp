-- CreateTable
CREATE TABLE "public"."SalonClosure" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalonClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalonClosure_salonId_startDate_endDate_idx" ON "public"."SalonClosure"("salonId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "public"."SalonClosure" ADD CONSTRAINT "SalonClosure_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "public"."Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
