-- CreateEnum
CREATE TYPE "PrizeName" AS ENUM ('DB', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'JP1', 'JP2', 'VL1', 'VL2', 'VL3', 'VL4', 'VL5', 'KENO');

-- CreateEnum
CREATE TYPE "LotteryRegion" AS ENUM ('MIEN_BAC', 'MIEN_NAM', 'MIEN_TRUNG', 'VIETLOTT');

-- CreateEnum
CREATE TYPE "LotteryCategory" AS ENUM ('XSKT', 'MEGA645', 'POWER655', 'MAX3D', 'MAX3DPRO', 'KENO');

-- CreateTable
CREATE TABLE "lottery_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "category" "LotteryCategory" NOT NULL,
    "region" "LotteryRegion" NOT NULL,
    "drawDays" INTEGER[],
    "drawTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lottery_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provinces" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "region" "LotteryRegion" NOT NULL,
    "lotteryTypeId" TEXT NOT NULL,
    "drawDayOfWeek" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draws" (
    "id" TEXT NOT NULL,
    "drawDate" TIMESTAMP(3) NOT NULL,
    "drawNumber" INTEGER,
    "lotteryTypeId" TEXT NOT NULL,
    "provinceId" TEXT,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "crawledAt" TIMESTAMP(3),
    "crawlSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "draws_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "prizeName" "PrizeName" NOT NULL,
    "numbers" TEXT[],
    "headNums" INTEGER[],
    "tailNums" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loto_results" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "head0" INTEGER[],
    "head1" INTEGER[],
    "head2" INTEGER[],
    "head3" INTEGER[],
    "head4" INTEGER[],
    "head5" INTEGER[],
    "head6" INTEGER[],
    "head7" INTEGER[],
    "head8" INTEGER[],
    "head9" INTEGER[],
    "allTwoDigits" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loto_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stat_cache" (
    "id" TEXT NOT NULL,
    "lotteryTypeId" TEXT NOT NULL,
    "statType" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stat_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_logs" (
    "id" TEXT NOT NULL,
    "lotteryTypeId" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsInserted" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "executionMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lottery_types_code_key" ON "lottery_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "provinces_code_key" ON "provinces"("code");

-- CreateIndex
CREATE INDEX "provinces_lotteryTypeId_idx" ON "provinces"("lotteryTypeId");

-- CreateIndex
CREATE INDEX "provinces_region_idx" ON "provinces"("region");

-- CreateIndex
CREATE INDEX "draws_drawDate_idx" ON "draws"("drawDate");

-- CreateIndex
CREATE INDEX "draws_lotteryTypeId_idx" ON "draws"("lotteryTypeId");

-- CreateIndex
CREATE INDEX "draws_lotteryTypeId_drawDate_idx" ON "draws"("lotteryTypeId", "drawDate");

-- CreateIndex
CREATE INDEX "draws_drawDate_lotteryTypeId_idx" ON "draws"("drawDate", "lotteryTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "draws_drawDate_lotteryTypeId_provinceId_key" ON "draws"("drawDate", "lotteryTypeId", "provinceId");

-- CreateIndex
CREATE INDEX "results_drawId_idx" ON "results"("drawId");

-- CreateIndex
CREATE INDEX "results_drawId_prizeName_idx" ON "results"("drawId", "prizeName");

-- CreateIndex
CREATE INDEX "results_tailNums_idx" ON "results"("tailNums");

-- CreateIndex
CREATE INDEX "loto_results_drawId_idx" ON "loto_results"("drawId");

-- CreateIndex
CREATE UNIQUE INDEX "loto_results_drawId_key" ON "loto_results"("drawId");

-- CreateIndex
CREATE INDEX "stat_cache_lotteryTypeId_idx" ON "stat_cache"("lotteryTypeId");

-- CreateIndex
CREATE INDEX "stat_cache_validUntil_idx" ON "stat_cache"("validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "stat_cache_lotteryTypeId_statType_key" ON "stat_cache"("lotteryTypeId", "statType");

-- CreateIndex
CREATE INDEX "crawl_logs_lotteryTypeId_idx" ON "crawl_logs"("lotteryTypeId");

-- CreateIndex
CREATE INDEX "crawl_logs_createdAt_idx" ON "crawl_logs"("createdAt");

-- CreateIndex
CREATE INDEX "crawl_logs_status_idx" ON "crawl_logs"("status");

-- AddForeignKey
ALTER TABLE "provinces" ADD CONSTRAINT "provinces_lotteryTypeId_fkey" FOREIGN KEY ("lotteryTypeId") REFERENCES "lottery_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draws" ADD CONSTRAINT "draws_lotteryTypeId_fkey" FOREIGN KEY ("lotteryTypeId") REFERENCES "lottery_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draws" ADD CONSTRAINT "draws_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "draws"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loto_results" ADD CONSTRAINT "loto_results_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "draws"("id") ON DELETE CASCADE ON UPDATE CASCADE;
