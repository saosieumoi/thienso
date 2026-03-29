-- CreateTable
CREATE TABLE "vietlott_prizes" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "winners" INTEGER NOT NULL DEFAULT 0,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vietlott_prizes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vietlott_prizes_drawId_idx" ON "vietlott_prizes"("drawId");

-- AddForeignKey
ALTER TABLE "vietlott_prizes" ADD CONSTRAINT "vietlott_prizes_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "draws"("id") ON DELETE CASCADE ON UPDATE CASCADE;
