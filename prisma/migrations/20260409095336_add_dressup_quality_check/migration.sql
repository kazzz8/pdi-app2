-- CreateEnum
CREATE TYPE "QualityCheckType" AS ENUM ('CHECKBOX', 'PHOTO', 'TEXT');

-- CreateTable
CREATE TABLE "DressUpQualityCheckItem" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "checkType" "QualityCheckType" NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DressUpQualityCheckItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DressUpQualityCheckLink" (
    "dressUpItemId" TEXT NOT NULL,
    "qualityCheckItemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DressUpQualityCheckLink_pkey" PRIMARY KEY ("dressUpItemId","qualityCheckItemId")
);

-- CreateTable
CREATE TABLE "DressUpQualityCheckSession" (
    "id" TEXT NOT NULL,
    "workPlanId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DressUpQualityCheckSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DressUpQualityCheckResult" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "checkItemId" TEXT NOT NULL,
    "passed" BOOLEAN,
    "photoUrl" TEXT,
    "textValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DressUpQualityCheckResult_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DressUpQualityCheckLink" ADD CONSTRAINT "DressUpQualityCheckLink_dressUpItemId_fkey" FOREIGN KEY ("dressUpItemId") REFERENCES "DressUpItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DressUpQualityCheckLink" ADD CONSTRAINT "DressUpQualityCheckLink_qualityCheckItemId_fkey" FOREIGN KEY ("qualityCheckItemId") REFERENCES "DressUpQualityCheckItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DressUpQualityCheckSession" ADD CONSTRAINT "DressUpQualityCheckSession_workPlanId_fkey" FOREIGN KEY ("workPlanId") REFERENCES "WorkPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DressUpQualityCheckSession" ADD CONSTRAINT "DressUpQualityCheckSession_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DressUpQualityCheckResult" ADD CONSTRAINT "DressUpQualityCheckResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DressUpQualityCheckSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DressUpQualityCheckResult" ADD CONSTRAINT "DressUpQualityCheckResult_checkItemId_fkey" FOREIGN KEY ("checkItemId") REFERENCES "DressUpQualityCheckItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
